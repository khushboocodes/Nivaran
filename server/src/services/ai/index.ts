/**
 * AI service abstraction for complaint classification.
 *
 * Three providers ship today:
 *  - HeuristicService — deterministic keyword match. Always available.
 *    Used as the default and as the fallback when no API key is present.
 *  - GeminiService — calls the Google Gemini API (Gemini 2.5 Flash).
 *    Activated when `GEMINI_API_KEY` is set. Falls back to the heuristic
 *    on any network or parse failure so the citizen submission flow never
 *    breaks.
 *  - OpenAIService — calls the OpenAI Chat Completions REST API (legacy).
 *    Activated when `AI_PROVIDER=openai` and `OPENAI_API_KEY` is set.
 *
 * Selection is controlled via env vars:
 *   AI_PROVIDER=gemini|openai|heuristic  (default: gemini when key present, else heuristic)
 *   GEMINI_API_KEY=AIza...               (required for the gemini provider)
 *   GEMINI_MODEL=gemini-2.5-flash        (optional, defaults to flash)
 *   OPENAI_API_KEY=sk-...                (required for the openai provider)
 *   OPENAI_MODEL=gpt-4o-mini             (optional)
 *
 * A small in-memory cache keyed on a SHA-256 of the {description, language}
 * pair short-circuits repeated classify calls for ~24h.
 */

import { createHash } from 'node:crypto';
import type { Priority, Sentiment } from '@nivaran/shared';

export interface ClassifyInput {
  description: string;
  language?: string;
  /**
   * Optional complaint title. When supplied the heuristic weights its
   * keyword hits 2x — titles are by far the strongest signal in
   * civic-grievance text.
   */
  title?: string;
}

export interface ClassifyResult {
  category: string;
  department: string;
  priority: Priority;
  sentiment: Sentiment;
  /** 0..1 confidence the model is correct. */
  confidence: number;
  /** A one-line summary of the issue (always English). */
  summary: string;
  /** Detected ISO 639-1 language code of the complaint text. */
  detectedLanguage?: string;
  /** Which provider produced this result. */
  provider: 'gemini' | 'openai' | 'heuristic';
  /**
   * True when a non-heuristic provider failed and we returned the heuristic
   * fallback. The route uses this to tell the UI gracefully degrade.
   */
  degraded?: boolean;
}

export interface AIService {
  classify(input: ClassifyInput): Promise<ClassifyResult>;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  result: ClassifyResult;
  expiresAt: number;
}

const classifyCache = new Map<string, CacheEntry>();

function cacheKey(input: ClassifyInput): string {
  return createHash('sha256')
    // Bumping `v3` invalidates every cached result from the v1 / v2
    // heuristics. v3 adds title support, vernacular keywords, basic
    // stemming, and negation handling — keeping cached results from the
    // older versions would mask the improvements until the 24h TTL.
    .update(
      'v3|'
      + (input.language ?? 'en')
      + '|' + (input.title ?? '').trim().toLowerCase()
      + '|' + input.description.trim().toLowerCase(),
    )
    .digest('hex');
}

function withCache(provider: AIService): AIService {
  return {
    async classify(input) {
      const key = cacheKey(input);
      const hit = classifyCache.get(key);
      if (hit && hit.expiresAt > Date.now()) {
        return hit.result;
      }
      const result = await provider.classify(input);
      classifyCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Heuristic provider
// ---------------------------------------------------------------------------

/**
 * Civic-grievance heuristic classifier.
 *
 * The flow:
 *   1. Normalize: lowercase, strip punctuation, collapse whitespace, then
 *      apply a tiny stemmer that removes common English suffixes (`-s`,
 *      `-es`, `-ing`, `-ed`) and Hinglish plurals (`-ein`, `-on`).
 *   2. Score each category on the description and (separately) the title.
 *      Title hits are weighted 2x — titles are the strongest signal in
 *      civic complaints.
 *   3. Subtract negation matches. "no pothole" / "not a leak" should not
 *      vote for the same bucket as "huge pothole" / "major leak".
 *   4. Apply category-specific anti-patterns: phrases that look like
 *      keywords but actually mean something else. The classic case is
 *      "fills with water after rain", which is about a road, not water
 *      supply.
 *   5. Pick the highest-scoring rule. The margin between winner and
 *      runner-up drives the confidence number we ship to the UI.
 *
 * Implementation note: we use lemma keywords (`pothol`, `leak`, `pip`)
 * rather than full words. After stemming, `potholes`, `pothole`,
 * `potholed` all reduce to `pothol`. This catches plural / participle
 * forms without exploding the regex list.
 *
 * Vernacular: each rule includes a small set of Hinglish keywords so
 * descriptions written in transliterated Hindi (e.g. "kachra", "naala",
 * "bijli") still classify correctly. We don't try to be linguistically
 * thorough — these are the dozen or so words that show up everywhere in
 * Indian municipal complaint corpora.
 */

interface CategoryRule {
  category: string;
  department: string;
  /** Strong keywords (or stems). Each match adds 2 to the score. */
  strong: RegExp[];
  /** Weak keywords. Each match adds 1. */
  weak?: RegExp[];
  /** Anti-patterns: subtract score when these phrases appear. */
  anti?: RegExp[];
}

/**
 * Light stemmer: strip the most common suffixes so we can match on lemmas.
 * Order matters — strip the longest suffix first so `flooding` becomes
 * `flood` rather than `floodin`.
 */
function stem(word: string): string {
  const suffixes = ['ein', 'ies', 'ing', 'ed', 'es', 'on', 's'];
  for (const s of suffixes) {
    if (word.length > s.length + 2 && word.endsWith(s)) {
      return word.slice(0, -s.length);
    }
  }
  return word;
}

/**
 * Normalise free text into a single lowercased string of stemmed lemmas
 * separated by single spaces. Punctuation is replaced with spaces so
 * `pothole.` and `pothole` collapse to the same token.
 */
function normalise(text: string): string {
  const lowered = text.toLowerCase();
  const cleaned = lowered.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean).map(stem);
  return ' ' + tokens.join(' ') + ' ';
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    // Roads / potholes / footpaths. Lemmas: pothol, road, highway, footpath,
    // pavement. Hinglish: gaddha (pit), sadak (road), gali (lane).
    category: 'Roads & Infrastructure',
    department: 'Public Works Department',
    strong: [/\bpothol/, /\broad\b/, /\bhighway/, /\bfootpath/, /\bpavement/, /\bsidewalk/, /\bgaddha\b/, /\bsadak/, /\bgali\b/],
    weak: [/\bstreet\b/, /\binfrastructur/, /\btraffic/, /\bbridg/, /\bflyover/, /\basphalt/],
  },
  {
    // Streetlights are a separate bucket — they live with Electricity but
    // the citizen-facing department label is more specific.
    category: 'Street Lights',
    department: 'Electricity Department',
    strong: [/\bstreet ?light/, /\blamp ?post/, /\blamppost/, /\bstreetlamp/],
    weak: [/\bdark\b/, /\bunlit/],
  },
  {
    category: 'Electricity',
    department: 'Electricity Department',
    strong: [/\belectric/, /\btransformer/, /\bvoltag/, /\bload ?shed/, /\bbijli\b/, /\bcurrent\b/, /\bshock\b/],
    weak: [/\bpower\b/, /\bphas/, /\bmeter\b/],
  },
  {
    category: 'Water Supply',
    department: 'Water Supply Board',
    strong: [/\bwater (suppli|leak|pip|tank|shortag|cut)/, /\bpipelin/, /\bborewell/, /\btap\b/, /\bpaani\b/, /\bnal\b/],
    weak: [/\bleak\b/, /\bpip\b/, /\btank\b/, /\bjal\b/],
    // "Fills with water after rain" is a road / drainage signal, not a
    // water-supply one. Same for "water-logged" potholes.
    anti: [/\bfill with water/, /\bwater ?logg/, /\bafter rain/],
  },
  {
    category: 'Drainage',
    department: 'Municipal Corporation',
    strong: [/\bdrain\b/, /\bsewag/, /\bsewer/, /\bmanhol/, /\bclog/, /\boverflow/, /\bnaala\b/, /\bnali\b/],
    weak: [/\bblock\b/, /\bbackup\b/, /\bnal\b/],
  },
  {
    category: 'Waste Management',
    department: 'Sanitation Department',
    strong: [/\bgarbag/, /\btrash\b/, /\bwaste\b/, /\bdump\b/, /\blandfill/, /\bbin\b/, /\bkachra\b/, /\bkoodaa\b/, /\bkooda\b/],
    weak: [/\bdirt/, /\bsmell\b/, /\bstench\b/],
  },
  {
    category: 'Sanitation',
    department: 'Sanitation Department',
    strong: [/\bsanitation/, /\bsweep/, /\btoilet\b/, /\bpublic toilet/, /\bsafai\b/],
    weak: [/\bclean\b/, /\bhygien/],
  },
  {
    category: 'Public Health',
    department: 'Healthcare Department',
    strong: [/\bhospital/, /\bclinic/, /\bdengu/, /\bmalaria/, /\bepidemic/, /\bvaccin/, /\baspataal\b/],
    weak: [/\bhealth\b/, /\bsick\b/, /\bdiseas/, /\bmosquito/],
  },
];

/**
 * Negation pre-pass. We look for negation cues followed within ~3 tokens
 * by *any* of the keywords from any rule and remember the spans. Score
 * matches that fall inside one of those spans get zeroed out.
 *
 * The algorithm is token-window based rather than full regex re-anchoring
 * because regex-on-regex got brittle: cues like "no pothole" produced
 * escape sequences that didn't always re-match the original text.
 */
const NEGATION_CUES = ['no', 'not', 'never', 'without', 'nahi', 'nahin', 'nai'];

function negationWindows(text: string): { start: number; end: number }[] {
  // Token offsets are computed against the *normalised* (single-spaced,
  // leading-space-padded) string already passed in.
  const tokens: { word: string; index: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ word: m[0], index: m.index });
  }
  const windows: { start: number; end: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (NEGATION_CUES.includes(token.word)) {
      const start = token.index;
      const last = tokens[Math.min(tokens.length - 1, i + 3)]!;
      const end = last.index + last.word.length;
      windows.push({ start, end });
    }
  }
  return windows;
}

function isNegated(text: string, hit: RegExpMatchArray, windows: { start: number; end: number }[]): boolean {
  const idx = hit.index ?? 0;
  return windows.some((w) => idx >= w.start && idx <= w.end);
}

function scoreOne(rule: CategoryRule, text: string, weight: number): number {
  if (!text.trim()) return 0;
  const windows = negationWindows(text);
  let score = 0;

  const test = (re: RegExp, points: number) => {
    // Use a global flag scan so we can locate every hit, not just the first.
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let hit: RegExpExecArray | null;
    while ((hit = g.exec(text)) !== null) {
      if (!isNegated(text, hit, windows)) {
        score += points * weight;
      }
      // Avoid zero-width infinite loops.
      if (hit.index === g.lastIndex) g.lastIndex += 1;
    }
  };

  for (const re of rule.strong) test(re, 2);
  for (const re of rule.weak ?? []) test(re, 1);
  for (const re of rule.anti ?? []) {
    if (re.test(text)) score -= 2 * weight;
  }
  return score;
}

function scoreCategories(description: string, title: string): { rule: CategoryRule; score: number }[] {
  return CATEGORY_RULES.map((rule) => {
    // Title hits are weighted 2x because titles are the strongest signal.
    const score = scoreOne(rule, description, 1) + scoreOne(rule, title, 2);
    return { rule, score };
  });
}

export const heuristicService: AIService = {
  async classify({ description, title }) {
    const d = normalise(description);
    const t = normalise(title ?? '');

    // Pick the highest-scoring category. Ties resolve by the order in
    // CATEGORY_RULES, which puts the most specific buckets (Roads, Street
    // Lights) ahead of broader ones (Electricity, Water Supply).
    const scored = scoreCategories(d, t).sort((a, b) => b.score - a.score);
    const winner = scored[0];
    const useWinner = winner && winner.score >= 2;
    const category = useWinner ? winner.rule.category : 'Other';
    const department = useWinner ? winner.rule.department : 'Municipal Corporation';

    // Priority and sentiment look at description + title together.
    const combined = d + ' ' + t;

    // Sentiment / priority work on the *stemmed* combined text, so the
    // patterns must use lemma forms (e.g. `furiou` from "furious",
    // `unaccept` from "unacceptable") rather than full English words.
    let priority: Priority = 'Medium';
    if (/\b(urgent|danger|emergenc|critical|injur|fatal|akasmik|jaanleva)\b/.test(combined)) priority = 'Critical';
    else if (/\b(seriou|immediate|broken|hazard|risk|gaddha|tut|kharab)\b/.test(combined)) priority = 'High';
    else if (/\b(minor|cosmetic|small|chhota|halka)\b/.test(combined)) priority = 'Low';

    let sentiment: Sentiment = 'Neutral';
    if (/\b(angri|furiou|unaccept|disgust|gussa|bekaar|nikamma)\b/.test(combined)) sentiment = 'Highly Negative';
    else if (/\b(frustrat|annoy|upset|disappoint|pareshan|naraz)\b/.test(combined)) sentiment = 'Negative';
    else if (/\b(plea|kindly|request|appreciat|dhanyavad|shukriya|kripya)\b/.test(combined)) sentiment = 'Positive';

    // Confidence reflects how sure we are about the routing. Base of 0.7
    // is the tax on running a non-LLM heuristic; we add a chunk for a
    // clear winner over the runner-up, smaller bonuses for priority and
    // sentiment hits, and a tiny title-present bonus because titles
    // empirically help disambiguate.
    const runnerUp = scored[1]?.score ?? 0;
    const winnerScore = winner?.score ?? 0;
    const margin = useWinner ? Math.min(0.18, (winnerScore - runnerUp) * 0.04) : 0;
    const titleBonus = useWinner && (title ?? '').trim().length > 0 ? 0.03 : 0;
    const confidence = Math.min(
      0.94,
      0.7
        + (useWinner ? 0.07 : 0)
        + margin
        + titleBonus
        + (priority !== 'Medium' ? 0.04 : 0)
        + (sentiment !== 'Neutral' ? 0.03 : 0),
    );

    return {
      category,
      department,
      priority,
      sentiment,
      confidence,
      summary: `${priority} priority ${category.toLowerCase()} issue routed to ${department}.`,
      provider: 'heuristic',
    };
  },
};

// ---------------------------------------------------------------------------
// OpenAI provider
// ---------------------------------------------------------------------------

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const SYSTEM_PROMPT = [
  'You are NIVARAN, a civic-grievance triage assistant for Indian municipalities.',
  'Given a citizen complaint description, return a strict JSON object with these keys:',
  '  category   — short string (e.g. "Water Supply", "Electricity", "Roads & Infrastructure", "Sanitation", "Drainage", "Public Health", "Other").',
  '  department — receiving government department (e.g. "Water Supply Board", "Electricity Department", "Public Works Department", "Sanitation Department", "Healthcare Department", "Municipal Corporation").',
  '  priority   — one of: "Low", "Medium", "High", "Critical".',
  '  sentiment  — one of: "Positive", "Neutral", "Negative", "Highly Negative".',
  '  confidence — number between 0 and 1.',
  '  summary    — one short sentence (<= 24 words).',
  'Return ONLY the JSON object, no commentary, no code fences.',
].join('\n');

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/** Coerce arbitrary JSON to a `ClassifyResult` shape, defaulting any missing fields. */
function coerceClassifyResult(raw: unknown): ClassifyResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const allowedPriority: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
  const allowedSentiment: Sentiment[] = ['Positive', 'Neutral', 'Negative', 'Highly Negative'];
  const priority = allowedPriority.includes(r.priority as Priority)
    ? (r.priority as Priority)
    : 'Medium';
  const sentiment = allowedSentiment.includes(r.sentiment as Sentiment)
    ? (r.sentiment as Sentiment)
    : 'Neutral';
  const confidenceRaw = typeof r.confidence === 'number' ? r.confidence : 0.7;
  const confidence = Math.max(0, Math.min(1, confidenceRaw));
  return {
    category: typeof r.category === 'string' && r.category.trim() ? r.category : 'Other',
    department:
      typeof r.department === 'string' && r.department.trim()
        ? r.department
        : 'Municipal Corporation',
    priority,
    sentiment,
    confidence,
    summary: typeof r.summary === 'string' && r.summary.trim() ? r.summary : '',
    provider: 'openai',
  };
}

export function makeOpenAIService(apiKey: string, model: string): AIService {
  return {
    async classify({ description, language = 'en', title }) {
      const userContent = title && title.trim()
        ? `Language hint: ${language}\nTitle:\n${title}\n\nComplaint:\n${description}`
        : `Language hint: ${language}\nComplaint:\n${description}`;
      const body = {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0,
        response_format: { type: 'json_object' as const },
      };

      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as OpenAIChatResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('OpenAI returned empty content');

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error('OpenAI returned non-JSON content');
      }
      return coerceClassifyResult(parsed);
    },
  };
}

// ---------------------------------------------------------------------------
// Gemini provider (Google AI Studio)
// ---------------------------------------------------------------------------

const GEMINI_CLASSIFY_PROMPT = [
  'You are NIVARAN, a civic-grievance triage assistant for Indian municipalities.',
  'Given a citizen complaint description, return a strict JSON object with these keys:',
  '  category   — short string (e.g. "Water Supply", "Electricity", "Roads & Infrastructure", "Sanitation", "Drainage", "Public Health", "Waste Management", "Street Lights", "Other").',
  '  department — receiving government department (e.g. "Water Supply Board", "Electricity Department", "Public Works Department", "Sanitation Department", "Healthcare Department", "Municipal Corporation").',
  '  priority   — one of: "Low", "Medium", "High", "Critical".',
  '  sentiment  — one of: "Positive", "Neutral", "Negative", "Highly Negative".',
  '  confidence — number between 0 and 1.',
  '  summary    — one short sentence in English (<= 24 words).',
  '  language   — the ISO 639-1 code of the language the complaint is WRITTEN IN. One of: en, hi, ta, te, kn, ml, mr, bn, gu, pa, ur. Detect it from the text (e.g. Gujarati script → "gu", Devanagari Hindi → "hi", transliterated Hinglish → "hi").',
  'Return ONLY the JSON object, no commentary, no code fences.',
  'All field values except the detected language stay in English. The summary must always be in English regardless of the complaint language.',
].join('\n');

function geminiUrl(model: string, apiKey: string, stream = false): string {
  const action = stream ? 'streamGenerateContent' : 'generateContent';
  const alt = stream ? '&alt=sse' : '';
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}?key=${apiKey}${alt}`;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

export function makeGeminiService(apiKey: string, model: string): AIService {
  return {
    async classify({ description, language = 'en', title }) {
      const userContent = title && title.trim()
        ? `Language hint: ${language}\nTitle:\n${title}\n\nComplaint:\n${description}`
        : `Language hint: ${language}\nComplaint:\n${description}`;

      const body = {
        contents: [
          { role: 'user', parts: [{ text: GEMINI_CLASSIFY_PROMPT + '\n\n' + userContent }] },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      };

      const res = await fetch(geminiUrl(model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as GeminiResponse;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error('Gemini returned empty content');

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error('Gemini returned non-JSON content');
      }
      const raw = (parsed ?? {}) as Record<string, unknown>;
      const detectedLanguage = typeof raw.language === 'string' ? raw.language : undefined;
      return { ...coerceClassifyResult(parsed), detectedLanguage, provider: 'gemini' };
    },
  };
}

// ---------------------------------------------------------------------------
// Provider selection + fallback
// ---------------------------------------------------------------------------

/**
 * Decide which provider to use based on env vars. The Gemini/OpenAI provider
 * is wrapped in a fallback that catches any error and returns the heuristic
 * result with `degraded: true` so the citizen submission flow never fails
 * because of model issues.
 */
function buildService(): AIService {
  const explicit = (process.env.AI_PROVIDER ?? '').toLowerCase();
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Priority: explicit setting > gemini key present > openai key present > heuristic
  const useGemini = !!geminiKey && (explicit === 'gemini' || (explicit === '' && !openaiKey));
  const useOpenAI = !!openaiKey && (explicit === 'openai' || (explicit === '' && !geminiKey));

  if (useGemini && geminiKey) {
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    const gemini = makeGeminiService(geminiKey, model);
    console.log(`[ai] Using Gemini (${model}) for classification`);
    return {
      async classify(input) {
        try {
          return await gemini.classify(input);
        } catch (err) {
          console.warn('[ai] Gemini classify failed; falling back to heuristic.', err);
          const fallback = await heuristicService.classify(input);
          return { ...fallback, degraded: true };
        }
      },
    };
  }

  if (useOpenAI && openaiKey) {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const openai = makeOpenAIService(openaiKey, model);
    console.log(`[ai] Using OpenAI (${model}) for classification`);
    return {
      async classify(input) {
        try {
          return await openai.classify(input);
        } catch (err) {
          console.warn('[ai] OpenAI classify failed; falling back to heuristic.', err);
          const fallback = await heuristicService.classify(input);
          return { ...fallback, degraded: true };
        }
      },
    };
  }

  console.log('[ai] Using heuristic classifier (no API key configured)');
  return heuristicService;
}

const baseService = buildService();
/** Module-level singleton wrapped with the description-hash cache. */
export const aiService: AIService = withCache(baseService);

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const CHAT_SYSTEM_PROMPT = [
  'You are NIVARAN AI Assistant for citizens of Indian municipalities.',
  'Help with: filing complaints, tracking status, understanding civic processes, answering FAQs.',
  'Keep replies short, friendly, and use plain language. If asked something outside civic services, gently redirect.',
  'Do not make legal, medical, or financial recommendations.',
  '',
  'IMPORTANT: The conversation may begin with a user message starting with "[account context]" containing the citizen\'s personal complaint statistics (totals, resolved, pending, critical, latest complaint). When the citizen asks about *their own* complaints (e.g. "how many of mine are resolved?", "what\'s the status of my latest one?"), use those numbers directly to answer. Do not reveal any other citizen\'s data — that context is the only personal data you have.',
].join(' ');

/** Yield successive text chunks as the model streams its reply. */
export async function* chatStream(messages: ChatMessage[]): AsyncIterable<string> {
  const explicit = (process.env.AI_PROVIDER ?? '').toLowerCase();
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const useGemini = !!geminiKey && (explicit === 'gemini' || (explicit === '' && !openaiKey));
  const useOpenAI = !!openaiKey && (explicit === 'openai' || (explicit === '' && !geminiKey));

  if (useGemini && geminiKey) {
    yield* geminiChatStream(messages, geminiKey);
    return;
  }

  if (useOpenAI && openaiKey) {
    yield* openaiChatStream(messages, openaiKey);
    return;
  }

  yield heuristicChatReply(messages);
}

/**
 * Chat via Gemini. Uses the non-streaming generateContent endpoint for
 * reliability (streaming SSE through some hosts buffers or hangs), then
 * yields the full reply in one chunk. The browser accumulates chunks, so a
 * single chunk renders identically to a stream.
 */
async function* geminiChatStream(messages: ChatMessage[], apiKey: string): AsyncIterable<string> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  // Convert messages to Gemini format. System prompt goes via systemInstruction.
  const geminiContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    geminiContents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  const body = {
    systemInstruction: { parts: [{ text: CHAT_SYSTEM_PROMPT }] },
    contents: geminiContents,
    generationConfig: {
      temperature: 0.4,
    },
  };

  let res: Response;
  try {
    res = await fetch(geminiUrl(model, apiKey, false), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('[ai] Gemini chat fetch failed; falling back to heuristic.', err);
    yield heuristicChatReply(messages);
    return;
  }

  if (!res.ok) {
    console.warn('[ai] Gemini chat upstream returned', res.status);
    yield heuristicChatReply(messages);
    return;
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text && text.trim()) {
    yield text;
  } else {
    yield heuristicChatReply(messages);
  }
}

/** Stream chat via OpenAI API (legacy path) */
async function* openaiChatStream(messages: ChatMessage[], apiKey: string): AsyncIterable<string> {
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const body = {
    model,
    messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...messages],
    temperature: 0.4,
    stream: true,
  };

  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('[ai] OpenAI chat fetch failed; falling back to heuristic.', err);
    yield heuristicChatReply(messages);
    return;
  }
  if (!res.ok || !res.body) {
    console.warn('[ai] OpenAI chat upstream returned', res.status);
    yield heuristicChatReply(messages);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trimEnd();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Ignore malformed lines
      }
    }
  }
}

function heuristicChatReply(messages: ChatMessage[]): string {
  // The browser sneaks the citizen's stats in as the very first user turn
  // (`[account context]\n...`). Pull it out so we can reference real
  // numbers instead of generic FAQ copy.
  const ctxTurn = messages.find(
    (m) => m.role === 'user' && m.content.startsWith('[account context]'),
  );
  const ctx = ctxTurn?.content ?? '';
  const totalMatch = ctx.match(/filed (\d+) complaint/);
  const breakdownMatch = ctx.match(/(\d+) resolved, (\d+) pending, (\d+) at Critical/);
  const total = totalMatch ? Number(totalMatch[1]) : null;
  const resolved = breakdownMatch ? Number(breakdownMatch[1]) : null;
  const pending = breakdownMatch ? Number(breakdownMatch[2]) : null;
  const critical = breakdownMatch ? Number(breakdownMatch[3]) : null;

  // The actual user question is the last turn that isn't the context blob.
  const userTurns = messages.filter(
    (m) => m.role === 'user' && !m.content.startsWith('[account context]'),
  );
  const last = userTurns.slice(-1)[0]?.content ?? '';
  const lower = last.toLowerCase();

  // Account-aware answers — shape matches the client-side local handler.
  if (resolved !== null && total !== null && /resolved|how many.*hav.*been/.test(lower)) {
    if (total === 0) return "You haven't filed any complaints yet, so nothing has been resolved.";
    const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return `${resolved} of your ${total} complaint${total === 1 ? '' : 's'} ${
      resolved === 1 ? 'has' : 'have'
    } been resolved (${pct}% rate).`;
  }
  if (pending !== null && /pending|under review|awaiting/.test(lower)) {
    if (pending === 0) return 'You have no complaints currently pending review.';
    return `You have ${pending} pending complaint${pending === 1 ? '' : 's'}. Open My Complaints to see them.`;
  }
  if (critical !== null && /critical|escalat|urgent/.test(lower)) {
    if (critical === 0) return 'You have no critical-priority complaints right now.';
    return `${critical} of your complaints ${critical === 1 ? 'is' : 'are'} at Critical priority. Staff are reviewing them.`;
  }
  if (total !== null && /how many|number of|count/.test(lower) && /(complaint|file)/.test(lower)) {
    if (total === 0) return "You haven't filed any complaints yet.";
    return `You have filed ${total} complaint${total === 1 ? '' : 's'} so far.`;
  }

  // Generic civic FAQs — the original behaviour, preserved as a fallback.
  if (/file|submit|complaint/.test(lower)) {
    return 'To file a complaint, click "Submit Complaint" in the sidebar. Add a title and description, optionally attach photos, then run AI analysis to suggest the right department.';
  }
  if (/track|status|progress/.test(lower)) {
    return 'Open "Track Complaint" in the sidebar and paste your complaint ID. You will see the current status, the assigned department, and a step-by-step timeline.';
  }
  if (/category|categories|department/.test(lower)) {
    return 'NIVARAN currently routes to: Water Supply Board, Electricity, Public Works, Sanitation, Drainage, and Healthcare. The AI picks the right one for you on submission.';
  }
  if (/resolution|how long|days/.test(lower)) {
    return 'Most complaints resolve within 3–5 business days. Critical-priority items are escalated to senior officers automatically.';
  }
  if (/ai|classification|how it work/.test(lower)) {
    return 'When you submit a complaint, NIVARAN reads the description and predicts the category, priority, and sentiment. You can review the classification before sending.';
  }
  return 'I can help with filing, tracking, and understanding NIVARAN. Try asking "How many of my complaints are resolved?" or "What is the status of my latest complaint?"';
}

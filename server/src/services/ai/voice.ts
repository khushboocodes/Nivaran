/**
 * Voice complaint intake via Gemini multimodal audio.
 *
 * WHY GEMINI RATHER THAN CLOUD SPEECH-TO-TEXT
 * -------------------------------------------
 * Cloud Speech-to-Text and the Translation API both require a Google Cloud
 * project with billing enabled, even to stay inside their free quotas. The
 * Gemini API needs only the AI Studio key this project already uses.
 *
 * More importantly it collapses four steps into one request: transcribe the
 * audio, identify the language, translate to English, and classify the
 * complaint. A pipeline of separate services would compound latency and give
 * three more places to fail.
 *
 * WHAT IS DELIBERATELY PRESERVED
 * ------------------------------
 * The original-language transcript is returned and stored alongside the English
 * translation. A citizen who reports a problem in Bhojpuri-inflected Hindi
 * should be able to see their own words in the record, and an officer reviewing
 * it should be able to check the translation rather than trust it. Discarding
 * the source text would make the system unauditable in exactly the situations
 * where language is most likely to be mishandled.
 */
import { z } from 'zod';
import { geminiUrl } from './index';

/**
 * Formats Gemini documents as supported for audio input.
 *
 * Browser MediaRecorder overwhelmingly produces `audio/webm;codecs=opus`
 * (Chrome, Edge) or `audio/mp4` (Safari), and webm is NOT on Google's published
 * list. Rather than reject a recording the browser just made, we pass it through
 * and let the API decide: the list appears to be conservative rather than
 * exhaustive. If the API does reject a container, the error surfaces verbatim so
 * the cause is obvious instead of looking like a transcription failure.
 */
const DOCUMENTED_FORMATS = [
  'audio/wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
];

/** Inline request payloads are capped at 20 MB including the prompt. */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export const VoiceResultSchema = z.object({
  /** Verbatim transcript in the language actually spoken. */
  transcript: z.string().trim().min(1).max(5000),
  /** ISO 639-1 code of the detected language. */
  detectedLanguage: z.string().trim().min(2).max(10),
  /** English rendering. Equal to the transcript when English was spoken. */
  englishText: z.string().trim().min(1).max(5000),
  /** A short complaint title in English. */
  title: z.string().trim().min(3).max(120),
  /** Cleaned-up complaint body in English, suitable for the form. */
  description: z.string().trim().min(3).max(2000),
  category: z.string().trim().min(2).max(60),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  sentiment: z.enum(['Positive', 'Neutral', 'Negative', 'Highly Negative']),
  /** Whether intelligible speech was found at all. */
  speechDetected: z.boolean(),
});

export type VoiceResult = z.infer<typeof VoiceResultSchema>;

const PROMPT = [
  'You process voice complaints for an Indian civic grievance platform.',
  'The attached audio is a citizen describing a local infrastructure problem. It may be in any Indian language, in English, or in a mixture such as Hinglish.',
  '',
  'Do all of the following in one pass:',
  '1. Transcribe the speech verbatim, in the language and script actually spoken. Do not translate this field.',
  '2. Identify that language as an ISO 639-1 code (en, hi, ta, te, kn, ml, mr, bn, gu, pa, ur).',
  '3. Provide a faithful English rendering. If the speech was already English, repeat it.',
  '4. Write a short English title and a clear English description suitable for a complaint form. Keep the citizen\'s meaning; do not invent detail they did not say.',
  '5. Classify into exactly one category: Water Supply, Electricity, Sanitation, Drainage, Waste Management, Street Lights, Roads & Infrastructure, Public Health.',
  '6. Assign priority (Low, Medium, High, Critical) and sentiment (Positive, Neutral, Negative, Highly Negative) based on the urgency and tone actually expressed.',
  '',
  'If the audio contains no intelligible speech — silence, noise, or music — set speechDetected to false, put whatever you can in transcript (or the word "unintelligible"), and use Public Health, Low, Neutral as placeholders. Never fabricate a complaint that was not spoken.',
  '',
  'Return ONLY a JSON object with keys: transcript, detectedLanguage, englishText, title, description, category, priority, sentiment, speechDetected.',
  'No commentary, no code fences.',
].join('\n');

export interface TranscribeInput {
  /** Base64-encoded audio, without a data: URI prefix. */
  base64: string;
  /** MIME type as reported by the browser, e.g. 'audio/webm;codecs=opus'. */
  mimeType: string;
}

export interface TranscribeOutcome {
  result: VoiceResult | null;
  modelName: string;
  /** True when transcription could not be completed. */
  failed: boolean;
  error?: string;
  /** Set when the container is outside Google's documented list. */
  formatWarning?: string;
}

/**
 * Transcribe, translate, and classify a voice complaint.
 *
 * Never throws. The caller is a citizen submitting a complaint, and a model
 * failure must degrade to "type it in yourself" rather than block the
 * submission — the same posture the text classifier already takes.
 */
export async function transcribeComplaintAudio(input: TranscribeInput): Promise<TranscribeOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  if (!apiKey) {
    return {
      result: null,
      modelName: 'none',
      failed: true,
      error: 'Voice transcription needs GEMINI_API_KEY to be configured.',
    };
  }

  // Strip any codec parameter: Gemini wants a bare container type.
  const baseMime = input.mimeType.split(';')[0]?.trim().toLowerCase() ?? 'audio/webm';
  const formatWarning = DOCUMENTED_FORMATS.includes(baseMime)
    ? undefined
    : `${baseMime} is not on Google's documented list of supported audio formats; attempting anyway.`;

  try {
    const res = await fetch(geminiUrl(model, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType: baseMime, data: input.base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new Error(`Gemini ${res.status}: ${detail}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned no content for the audio');

    const parsed = VoiceResultSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(
        `response failed schema: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
      );
    }

    return { result: parsed.data, modelName: model, failed: false, formatWarning };
  } catch (err) {
    console.warn('[voice] transcription failed:', err);
    return {
      result: null,
      modelName: 'none',
      failed: true,
      error: err instanceof Error ? err.message : String(err),
      formatWarning,
    };
  }
}

/**
 * Generate a modelled citizen-demand corpus for the national planning layer.
 *
 *   npm --prefix server run ingest:demand
 *   npm --prefix server run ingest:demand -- --count 50000
 *
 * WHY THIS EXISTS, STATED PLAINLY
 * -------------------------------
 * Nivaran has no access to real national grievance microdata. CPGRAMS, India's
 * central grievance portal, publishes only aggregate monthly PDFs. Demonstrating
 * district-level demand hotspots therefore requires modelled demand.
 *
 * The honest way to do that is to make the model's structure explicit:
 *
 *   expected complaints(district, category)
 *       ∝ households(district)
 *       × deprivation(district, category)      <- REAL Census 2011 figures
 *       × propensity(category)                 <- stated assumption
 *
 * So the *volume* is synthetic but the *spatial distribution* is driven by real
 * census deprivation. Hotspots land where infrastructure gaps genuinely are, not
 * where a random number generator put them. A district with 99% of households
 * lacking tap water generates proportionally more water complaints than one at
 * 14%, because that is what the census says about those districts.
 *
 * Every row is written with `isSynthetic = true`, is badged in the UI, and is
 * disclosed in ATTRIBUTIONS.md. Complaints filed through the app by real users
 * are never flagged, so the two can always be separated.
 *
 * The generator is deterministic: a fixed seed means re-running produces the
 * same corpus, so a demo is reproducible and a reviewer can audit it.
 */
import { PrismaClient, Priority, Sentiment, Status } from '@prisma/client';
import { CATEGORY_SPECS, REFERENCED_METRICS } from '../../src/services/planning/categories';

const prisma = new PrismaClient();

const SYNTHETIC_EMAIL = 'modelled.demand@synthetic.nivaran.invalid';
const DEFAULT_COUNT = 150_000;
/** Fixed so the corpus is reproducible across runs and machines. */
const SEED = 20260821;
/** Complaints are spread across this many days ending today. */
const WINDOW_DAYS = 180;

/**
 * mulberry32 — a small, fast, seedable PRNG.
 *
 * `Math.random()` cannot be seeded, which would make the corpus irreproducible
 * and the demo unrepeatable. Thirty-two bits of state is ample here; this is
 * demo data, not cryptography.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);

/** Pick a random element. */
function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(rand() * xs.length)];
}

/**
 * Complaint text templates per category, in several Indian languages.
 *
 * These exist so the corpus exercises the real multilingual code paths —
 * language filters, script rendering, the classifier — rather than being 150,000
 * identical English strings. They are illustrative phrasings, not transcriptions
 * of anything a real person said.
 */
interface Template {
  language: string;
  title: string;
  description: string;
}

const TEMPLATES: Record<string, Template[]> = {
  'Water Supply': [
    { language: 'en', title: 'No piped water for several days', description: 'Our household has had no piped water supply for several days. We are walking to a handpump some distance away to collect drinking water.' },
    { language: 'hi', title: 'नल में पानी नहीं आ रहा है', description: 'कई दिनों से नल में पानी नहीं आ रहा है। पीने का पानी लाने के लिए दूर हैंडपंप तक जाना पड़ता है।' },
    { language: 'ta', title: 'குழாயில் தண்ணீர் வரவில்லை', description: 'பல நாட்களாக குழாயில் தண்ணீர் வரவில்லை. குடிநீருக்காக வெகு தூரம் நடந்து செல்ல வேண்டியிருக்கிறது.' },
    { language: 'bn', title: 'পাইপে জল আসছে না', description: 'কয়েক দিন ধরে পাইপে জল আসছে না। পানীয় জলের জন্য অনেক দূরে যেতে হচ্ছে।' },
    { language: 'en', title: 'Water supply is contaminated', description: 'The water coming from the tap is muddy and has a smell. Several people in the neighbourhood have fallen ill.' },
    { language: 'mr', title: 'नळाला पाणी येत नाही', description: 'अनेक दिवसांपासून नळाला पाणी येत नाही. पिण्याच्या पाण्यासाठी लांब जावे लागते.' },
  ],
  Electricity: [
    { language: 'en', title: 'Frequent power cuts through the day', description: 'Electricity goes off for many hours every day. Children cannot study in the evening and stored food spoils.' },
    { language: 'hi', title: 'दिन भर बिजली कटौती', description: 'हर दिन कई घंटे बिजली नहीं रहती। शाम को बच्चे पढ़ नहीं पाते।' },
    { language: 'te', title: 'రోజంతా విద్యుత్ కోతలు', description: 'ప్రతిరోజూ చాలా గంటలు కరెంటు ఉండదు. సాయంత్రం పిల్లలు చదవలేకపోతున్నారు.' },
    { language: 'en', title: 'Transformer has failed again', description: 'The local transformer has failed for the third time this month and the whole lane is without power.' },
  ],
  Sanitation: [
    { language: 'en', title: 'No public toilet in the settlement', description: 'There is no usable public toilet nearby. Women in particular have no safe or private option.' },
    { language: 'hi', title: 'बस्ती में शौचालय नहीं है', description: 'आसपास कोई चालू सार्वजनिक शौचालय नहीं है। महिलाओं के लिए कोई सुरक्षित व्यवस्था नहीं है।' },
    { language: 'bn', title: 'এলাকায় শৌচাগার নেই', description: 'কাছাকাছি কোনো ব্যবহারযোগ্য শৌচাগার নেই। মহিলাদের জন্য নিরাপদ ব্যবস্থা নেই।' },
  ],
  Drainage: [
    { language: 'en', title: 'Open drain overflowing into the lane', description: 'The open drain has been overflowing for weeks. Sewage is standing in the lane and mosquitoes have multiplied.' },
    { language: 'hi', title: 'नाला सड़क पर बह रहा है', description: 'खुला नाला हफ्तों से बह रहा है। गली में गंदा पानी जमा है और मच्छर बहुत बढ़ गए हैं।' },
    { language: 'ta', title: 'கழிவுநீர் தெருவில் பெருகுகிறது', description: 'திறந்த கால்வாய் வாரங்களாக நிரம்பி வழிகிறது. தெருவில் கழிவுநீர் தேங்கி கொசுக்கள் பெருகிவிட்டன.' },
  ],
  'Waste Management': [
    { language: 'en', title: 'Garbage not collected for weeks', description: 'Waste has not been collected for weeks. The pile at the corner is attracting stray animals and the smell is unbearable.' },
    { language: 'hi', title: 'हफ्तों से कचरा नहीं उठा', description: 'कई हफ्तों से कचरा नहीं उठाया गया। कोने पर ढेर लगा है और बहुत बदबू आती है।' },
    { language: 'mr', title: 'कचरा उचलला जात नाही', description: 'अनेक आठवड्यांपासून कचरा उचलला गेला नाही. दुर्गंधी पसरली आहे.' },
  ],
  'Street Lights': [
    { language: 'en', title: 'Street lights not working on the main road', description: 'None of the street lights on the approach road work. It is completely dark after sunset and unsafe to walk.' },
    { language: 'hi', title: 'सड़क की लाइटें बंद हैं', description: 'मुख्य सड़क की सभी लाइटें बंद हैं। अंधेरे में चलना असुरक्षित है।' },
    { language: 'te', title: 'వీధి దీపాలు పనిచేయడం లేదు', description: 'రోడ్డుపై వీధి దీపాలు ఏవీ పనిచేయడం లేదు. చీకటిలో నడవడం ప్రమాదకరం.' },
  ],
  'Roads & Infrastructure': [
    { language: 'en', title: 'Road full of potholes after the rain', description: 'The road has large potholes that fill with water after every rain. Two-wheelers have fallen and buses avoid the route entirely.' },
    { language: 'hi', title: 'बारिश के बाद सड़क पर गड्ढे', description: 'सड़क पर बड़े गड्ढे हैं जो बारिश के बाद पानी से भर जाते हैं। दोपहिया वाहन फिसल कर गिरते हैं।' },
    { language: 'bn', title: 'বৃষ্টির পরে রাস্তায় বড় গর্ত', description: 'রাস্তায় বড় বড় গর্ত তৈরি হয়েছে যা বৃষ্টির পরে জলে ভরে যায়। দুর্ঘটনা ঘটছে।' },
    { language: 'ta', title: 'மழைக்குப் பிறகு சாலையில் பள்ளங்கள்', description: 'சாலையில் பெரிய பள்ளங்கள் உள்ளன, மழைக்குப் பிறகு தண்ணீர் நிரம்புகிறது. விபத்துகள் நடக்கின்றன.' },
  ],
  'Public Health': [
    { language: 'en', title: 'No functioning primary health centre nearby', description: 'The nearest health centre has no doctor on most days. Patients travel a long distance for basic treatment.' },
    { language: 'hi', title: 'नजदीक स्वास्थ्य केंद्र काम नहीं कर रहा', description: 'नजदीकी स्वास्थ्य केंद्र में अक्सर डॉक्टर नहीं होते। इलाज के लिए दूर जाना पड़ता है।' },
  ],
};

interface Args {
  count: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--count');
  const fromFlag = i >= 0 ? Number(argv[i + 1]) : NaN;
  const fromEnv = Number(process.env.DEMAND_COUNT);
  const count = Number.isFinite(fromFlag) ? fromFlag : Number.isFinite(fromEnv) ? fromEnv : DEFAULT_COUNT;
  if (!Number.isFinite(count) || count <= 0) throw new Error('[demand] --count must be a positive number');
  return { count: Math.round(count) };
}

/**
 * Map a deprivation rate (0..100) to a plausible priority.
 *
 * Deliberately probabilistic rather than a hard threshold: real complaint
 * severity varies even within an equally deprived district, and a hard cutoff
 * would produce suspiciously clean bands in the analytics.
 */
function priorityFor(gap: number): Priority {
  const r = rand();
  if (gap > 75) return r < 0.3 ? Priority.Critical : r < 0.7 ? Priority.High : Priority.Medium;
  if (gap > 50) return r < 0.12 ? Priority.Critical : r < 0.45 ? Priority.High : Priority.Medium;
  if (gap > 25) return r < 0.04 ? Priority.Critical : r < 0.25 ? Priority.High : r < 0.8 ? Priority.Medium : Priority.Low;
  return r < 0.1 ? Priority.High : r < 0.55 ? Priority.Medium : Priority.Low;
}

/** Sentiment tracks priority: people are angrier about worse problems. */
function sentimentFor(priority: Priority): Sentiment {
  const r = rand();
  switch (priority) {
    case Priority.Critical:
      return r < 0.45 ? Sentiment.HighlyNegative : Sentiment.Negative;
    case Priority.High:
      return r < 0.15 ? Sentiment.HighlyNegative : r < 0.75 ? Sentiment.Negative : Sentiment.Neutral;
    case Priority.Medium:
      return r < 0.35 ? Sentiment.Negative : r < 0.9 ? Sentiment.Neutral : Sentiment.Positive;
    default:
      return r < 0.2 ? Sentiment.Negative : r < 0.85 ? Sentiment.Neutral : Sentiment.Positive;
  }
}

function statusFor(): Status {
  const r = rand();
  if (r < 0.34) return Status.Submitted;
  if (r < 0.49) return Status.UnderReview;
  if (r < 0.63) return Status.Assigned;
  if (r < 0.78) return Status.InProgress;
  return Status.Resolved;
}

async function main() {
  const { count: targetCount } = parseArgs();
  console.log(`[demand] target corpus size: ${targetCount.toLocaleString()}`);

  // --- Preconditions ------------------------------------------------------
  const districts = await prisma.district.findMany({
    select: { id: true, name: true, households: true, population: true },
  });
  if (districts.length === 0) {
    throw new Error('[demand] no districts found. Run `npm --prefix server run ingest:census` first.');
  }

  const departments = await prisma.department.findMany({ select: { id: true, name: true } });
  const deptIdByName = new Map(departments.map((d) => [d.name, d.id]));
  const missingDepts = [...new Set(CATEGORY_SPECS.map((s) => s.department))].filter((n) => !deptIdByName.has(n));
  if (missingDepts.length) {
    throw new Error(
      `[demand] missing departments: ${missingDepts.join(', ')}.\n` +
        'Run `npm --prefix server run db:seed` first.',
    );
  }

  // --- Indicator lookup ---------------------------------------------------
  const indicators = await prisma.districtIndicator.findMany({
    where: { source: 'census2011', metric: { in: REFERENCED_METRICS } },
    select: { districtId: true, metric: true, value: true },
  });
  const gapByDistrict = new Map<string, Map<string, number>>();
  for (const row of indicators) {
    let m = gapByDistrict.get(row.districtId);
    if (!m) gapByDistrict.set(row.districtId, (m = new Map()));
    m.set(row.metric, row.value);
  }
  console.log(`[demand] loaded ${indicators.length} census indicator values`);

  /** Mean of a category's metrics for a district, or null if none are present. */
  function gapFor(districtId: string, metrics: string[]): number | null {
    const m = gapByDistrict.get(districtId);
    if (!m) return null;
    const vals = metrics.map((k) => m.get(k)).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  // --- Synthetic author ---------------------------------------------------
  // A single clearly-labelled account owns every modelled row. The .invalid TLD
  // is reserved by RFC 2606 and can never resolve, so this address cannot
  // collide with or impersonate a real citizen.
  const author = await prisma.user.upsert({
    where: { email: SYNTHETIC_EMAIL },
    create: {
      email: SYNTHETIC_EMAIL,
      name: 'Modelled demand (synthetic)',
      role: 'citizen',
      // Unusable by design: this account exists to own rows, never to log in.
      passwordHash: 'synthetic-account-no-login',
      city: 'N/A',
    },
    update: {},
  });

  // --- Weights ------------------------------------------------------------
  // weight = households x deprivation x propensity. Households rather than
  // population because the census amenity tables are household-denominated,
  // so the units stay consistent.
  interface Cell {
    districtId: string;
    category: string;
    departmentId: string;
    gap: number;
    weight: number;
  }
  const cells: Cell[] = [];
  let totalWeight = 0;

  for (const d of districts) {
    const hh = d.households ?? 0;
    if (hh <= 0) continue;
    for (const spec of CATEGORY_SPECS) {
      const gap = gapFor(d.id, spec.metrics);
      if (gap == null) continue;
      const weight = hh * (gap / 100) * spec.propensity;
      if (weight <= 0) continue;
      cells.push({
        districtId: d.id,
        category: spec.category,
        departmentId: deptIdByName.get(spec.department)!,
        gap,
        weight,
      });
      totalWeight += weight;
    }
  }
  if (totalWeight <= 0) throw new Error('[demand] all weights are zero; check indicator ingest');
  console.log(`[demand] ${cells.length} district-category cells carry demand weight`);

  // --- Clear previous synthetic rows -------------------------------------
  const cleared = await prisma.complaint.deleteMany({ where: { isSynthetic: true } });
  if (cleared.count) console.log(`[demand] cleared ${cleared.count.toLocaleString()} previous synthetic complaints`);

  // --- Generate -----------------------------------------------------------
  const now = Date.now();
  const windowMs = WINDOW_DAYS * 24 * 60 * 60 * 1000;

  type Row = {
    citizenId: string;
    title: string;
    description: string;
    category: string;
    departmentId: string;
    districtId: string;
    priority: Priority;
    status: Status;
    sentiment: Sentiment;
    language: string;
    aiConfidence: number;
    aiSummary: string;
    isSynthetic: true;
    submittedAt: Date;
    resolvedAt: Date | null;
  };

  let buffer: Row[] = [];
  let written = 0;
  const BATCH = 2000;

  async function flush() {
    if (buffer.length === 0) return;
    await prisma.complaint.createMany({ data: buffer });
    written += buffer.length;
    buffer = [];
    if (written % 20_000 === 0 || written === targetCount) {
      console.log(`[demand] written ${written.toLocaleString()} / ${targetCount.toLocaleString()}`);
    }
  }

  for (const cell of cells) {
    // Proportional allocation, with the fraction resolved stochastically so
    // small cells are not all rounded away to zero.
    const exact = (cell.weight / totalWeight) * targetCount;
    let n = Math.floor(exact);
    if (rand() < exact - n) n += 1;
    if (n <= 0) continue;

    const templates = TEMPLATES[cell.category] ?? TEMPLATES['Water Supply'];

    for (let k = 0; k < n; k++) {
      const t = pick(templates);
      const priority = priorityFor(cell.gap);
      const status = statusFor();
      const submittedAt = new Date(now - rand() * windowMs);

      buffer.push({
        citizenId: author.id,
        title: t.title,
        description: t.description,
        category: cell.category,
        departmentId: cell.departmentId,
        districtId: cell.districtId,
        priority,
        status,
        sentiment: sentimentFor(priority),
        language: t.language,
        // Left at 0 on purpose: these rows were not classified by the model, and
        // inventing a confidence would corrupt the AI-accuracy metric the admin
        // dashboard computes over aiConfidence > 0.
        aiConfidence: 0,
        aiSummary: '',
        isSynthetic: true,
        submittedAt,
        resolvedAt:
          status === Status.Resolved
            ? new Date(submittedAt.getTime() + rand() * (now - submittedAt.getTime()))
            : null,
      });

      if (buffer.length >= BATCH) await flush();
    }
  }
  await flush();

  console.log(`[demand] wrote ${written.toLocaleString()} synthetic complaints`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('[demand] done');
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

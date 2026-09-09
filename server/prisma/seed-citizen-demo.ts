/**
 * Populate the demo citizen account with a realistic complaint history.
 *
 *   npm --prefix server run seed:citizen
 *   npm --prefix server run seed:citizen -- --reset
 *
 * WHY THIS IS SEPARATE FROM THE MODELLED DEMAND CORPUS
 * ---------------------------------------------------
 * `ingest/synthesize-demand.ts` generates ~150,000 rows to demonstrate
 * district-level hotspots. Those are statistical fixtures: identical template
 * text repeated across districts, flagged `isSynthetic`, owned by a clearly
 * labelled non-login account, and disclosed as modelled everywhere they surface.
 *
 * These are different. They are a couple of dozen individually written complaints
 * belonging to the demo citizen, so the citizen portal has a believable history to
 * show — varied categories, a realistic status funnel, resolution times, feedback,
 * and a few dictated in other languages. They are **not** flagged `isSynthetic`,
 * because that flag means "modelled demand" and applying it here would badge them
 * "modelled" in the UI and exclude them from the AI-accuracy figure, which is the
 * opposite of what they exist for.
 *
 * To be unambiguous: these are demo fixtures for a demo account. They are not a
 * claim that real citizens filed them. The distinction that matters for the
 * planning layer — modelled versus not-modelled demand — is what `isSynthetic`
 * tracks, and these correctly sit outside it, exactly like the handful of
 * complaints filed by hand during development.
 *
 * Idempotent: complaints are matched by title, so re-running adds only what is
 * missing and never duplicates. `--reset` removes everything this script owns
 * first, leaving any hand-filed complaints alone.
 */
import { PrismaClient, Priority, Sentiment, Status } from '@prisma/client';

const prisma = new PrismaClient();

const CITIZEN_EMAIL = 'citizen@demo.nivaran.in';

/** Deterministic so re-runs and screenshots stay consistent. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(11071947);

interface Fixture {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  sentiment: Sentiment;
  status: Status;
  /** Days before today the complaint was filed. */
  daysAgo: number;
  /** Days after filing it was resolved. Only used when status is Resolved. */
  resolvedAfterDays?: number;
  aiConfidence: number;
  aiSummary: string;
  location: string;
  district: string;
  /** Set when the complaint was dictated rather than typed. */
  voice?: { language: string; transcript: string };
  /** Star rating left after resolution. */
  rating?: number;
  ratingComment?: string;
}

/**
 * Written individually rather than templated, because the point is a history that
 * reads like one person's year of dealing with their municipality: some things
 * fixed quickly, some still open, one escalated, a couple dictated in Marathi and
 * Hindi because that is how people actually report things.
 *
 * Confidence values vary the way a real classifier's would — high on unambiguous
 * reports, lower where the text covers more than one issue.
 */
const FIXTURES: Fixture[] = [
  {
    title: 'No water supply in Kothrud for four days',
    description:
      'Our building in Kothrud has had no municipal water since Monday. We are buying tanker water at our own cost. Around forty families are affected.',
    category: 'Water Supply',
    priority: Priority.High,
    sentiment: Sentiment.Negative,
    status: Status.Resolved,
    daysAgo: 82,
    resolvedAfterDays: 4,
    aiConfidence: 0.94,
    aiSummary: 'Complete loss of municipal water supply affecting around forty households in Kothrud.',
    location: 'Kothrud, Pune',
    district: 'Pune',
    rating: 4,
    ratingComment: 'Took a few days but the tanker arrived and supply was restored.',
  },
  {
    title: 'Streetlight out on Paud Road service lane',
    description:
      'The three streetlights along the service lane have not worked for two weeks. The stretch is completely dark after 7pm and women walking back from the bus stop feel unsafe.',
    category: 'Street Lights',
    priority: Priority.Medium,
    sentiment: Sentiment.Negative,
    status: Status.Resolved,
    daysAgo: 74,
    resolvedAfterDays: 9,
    aiConfidence: 0.91,
    aiSummary: 'Three non-functional streetlights creating an unlit stretch with a stated safety concern.',
    location: 'Paud Road, Pune',
    district: 'Pune',
    rating: 5,
    ratingComment: 'All three lights replaced. Much better now.',
  },
  {
    title: 'Garbage not collected for eleven days',
    description:
      'The collection vehicle has not come to our lane since the start of the month. The bin at the corner is overflowing and stray dogs are scattering waste across the road.',
    category: 'Waste Management',
    priority: Priority.High,
    sentiment: Sentiment.HighlyNegative,
    status: Status.Resolved,
    daysAgo: 66,
    resolvedAfterDays: 3,
    aiConfidence: 0.96,
    aiSummary: 'Eleven-day lapse in door-to-door waste collection with an overflowing community bin.',
    location: 'Erandwane, Pune',
    district: 'Pune',
    rating: 4,
  },
  {
    title: 'नाल्यातील पाणी रस्त्यावर येत आहे',
    description:
      'The open drain beside our lane has been overflowing onto the road for over a week. Sewage water is standing near the entrance and mosquitoes have increased sharply.',
    category: 'Drainage',
    priority: Priority.Critical,
    sentiment: Sentiment.HighlyNegative,
    status: Status.Resolved,
    daysAgo: 58,
    resolvedAfterDays: 12,
    aiConfidence: 0.88,
    aiSummary: 'Sewage overflow from an open drain onto a residential road, with a stated mosquito increase.',
    location: 'Warje, Pune',
    district: 'Pune',
    voice: {
      language: 'mr',
      transcript:
        'आमच्या गल्लीजवळचा नाला आठवड्याहून जास्त काळ रस्त्यावर वाहत आहे. सांडपाणी साचले आहे आणि डास खूप वाढले आहेत.',
    },
    rating: 3,
    ratingComment: 'Cleared eventually but it took too long for something this serious.',
  },
  {
    title: 'Frequent power cuts every evening',
    description:
      'Electricity goes off between 7pm and 9pm almost every day this month. Children cannot study and the inverter no longer lasts the full outage.',
    category: 'Electricity',
    priority: Priority.Medium,
    sentiment: Sentiment.Negative,
    status: Status.Resolved,
    daysAgo: 51,
    resolvedAfterDays: 7,
    aiConfidence: 0.89,
    aiSummary: 'Recurring evening power outages of roughly two hours affecting a residential area.',
    location: 'Karve Nagar, Pune',
    district: 'Pune',
    rating: 4,
  },
  {
    title: 'Potholes on the approach road after rain',
    description:
      'The approach road has developed deep potholes that fill with water after every shower. Two two-wheelers skidded last week. Autorickshaws now refuse the last stretch.',
    category: 'Roads & Infrastructure',
    priority: Priority.High,
    sentiment: Sentiment.Negative,
    status: Status.InProgress,
    daysAgo: 34,
    aiConfidence: 0.93,
    aiSummary: 'Water-filled potholes on an approach road with reported two-wheeler skidding incidents.',
    location: 'Bavdhan, Pune',
    district: 'Pune',
  },
  {
    title: 'बिजली का तार खंभे से लटक रहा है',
    description:
      'A live electrical wire is hanging low from the pole outside our gate, roughly at head height. Children pass under it on the way to school. This needs urgent attention.',
    category: 'Electricity',
    priority: Priority.Critical,
    sentiment: Sentiment.HighlyNegative,
    status: Status.InProgress,
    daysAgo: 26,
    aiConfidence: 0.95,
    aiSummary: 'Low-hanging live electrical wire at head height on a route used by schoolchildren.',
    location: 'Shivajinagar, Pune',
    district: 'Pune',
    voice: {
      language: 'hi',
      transcript:
        'हमारे गेट के बाहर खंभे से बिजली का तार बहुत नीचे लटक रहा है, लगभग सिर की ऊंचाई पर। बच्चे स्कूल जाते समय उसके नीचे से गुजरते हैं। कृपया तुरंत ठीक करवाएं।',
    },
  },
  {
    title: 'Public toilet near the market is unusable',
    description:
      'The public toilet block near the vegetable market has had no water connection for a month. It is now unusable and the surrounding area smells badly.',
    category: 'Sanitation',
    priority: Priority.High,
    sentiment: Sentiment.Negative,
    status: Status.Assigned,
    daysAgo: 19,
    aiConfidence: 0.9,
    aiSummary: 'Public toilet block out of service for a month due to a missing water connection.',
    location: 'Mandai, Pune',
    district: 'Pune',
  },
  {
    title: 'Mosquito breeding in stagnant water near the clinic',
    description:
      'Water has been standing in the empty plot next to the primary health centre since the last rain. Several dengue cases have been reported in the lane this month.',
    category: 'Public Health',
    priority: Priority.Critical,
    sentiment: Sentiment.HighlyNegative,
    status: Status.UnderReview,
    daysAgo: 13,
    aiConfidence: 0.85,
    aiSummary: 'Stagnant water adjacent to a health centre with reported dengue cases in the vicinity.',
    location: 'Hadapsar, Pune',
    district: 'Pune',
  },
  {
    title: 'Water pressure very low on upper floors',
    description:
      'Supply reaches the building but pressure is too low to get water above the second floor. Residents on the third and fourth floors are carrying buckets up the stairs.',
    category: 'Water Supply',
    priority: Priority.Medium,
    sentiment: Sentiment.Negative,
    status: Status.UnderReview,
    daysAgo: 9,
    aiConfidence: 0.87,
    aiSummary: 'Insufficient water pressure preventing supply to upper floors of a residential building.',
    location: 'Aundh, Pune',
    district: 'Pune',
  },
  {
    title: 'Drain cover missing outside the school gate',
    description:
      'A drain cover has been missing for several days right outside the school gate. It is a serious hazard for children at drop-off time.',
    category: 'Drainage',
    priority: Priority.Critical,
    sentiment: Sentiment.Negative,
    status: Status.Assigned,
    daysAgo: 6,
    aiConfidence: 0.92,
    aiSummary: 'Missing drain cover creating an open hazard directly outside a school entrance.',
    location: 'Kalyani Nagar, Pune',
    district: 'Pune',
  },
  {
    title: 'Construction debris dumped on the footpath',
    description:
      'Someone has dumped building debris across the footpath, forcing pedestrians onto the road. It has been there for four days and nobody has cleared it.',
    category: 'Waste Management',
    priority: Priority.Medium,
    sentiment: Sentiment.Negative,
    status: Status.Submitted,
    daysAgo: 4,
    aiConfidence: 0.83,
    aiSummary: 'Construction debris obstructing a footpath and pushing pedestrians into traffic.',
    location: 'Baner, Pune',
    district: 'Pune',
  },
  {
    title: 'Streetlights on the new bypass never switched on',
    description:
      'The poles and fittings on the new bypass were installed months ago but have never been energised. The whole stretch is dark and it is the main route to the highway.',
    category: 'Street Lights',
    priority: Priority.Medium,
    sentiment: Sentiment.Neutral,
    status: Status.Submitted,
    daysAgo: 3,
    aiConfidence: 0.79,
    aiSummary: 'Installed but unenergised street lighting along a bypass used as a highway approach.',
    location: 'Wakad, Pune',
    district: 'Pune',
  },
  {
    title: 'Road digging left unfilled after cable work',
    description:
      'A trench dug for cable laying three weeks ago has been left open and partly filled. It is narrowing the road and becomes dangerous at night.',
    category: 'Roads & Infrastructure',
    priority: Priority.High,
    sentiment: Sentiment.Negative,
    status: Status.Submitted,
    daysAgo: 2,
    aiConfidence: 0.86,
    aiSummary: 'Unfilled utility trench narrowing a road and presenting a night-time hazard.',
    location: 'Kharadi, Pune',
    district: 'Pune',
  },
  {
    title: 'Overflowing bin attracting cattle near the temple',
    description:
      'The community bin near the temple has not been emptied and cattle are gathering around it every morning, blocking the lane.',
    category: 'Waste Management',
    priority: Priority.Low,
    sentiment: Sentiment.Neutral,
    status: Status.Submitted,
    daysAgo: 1,
    aiConfidence: 0.81,
    aiSummary: 'Unemptied community bin drawing cattle and obstructing a residential lane.',
    location: 'Sinhagad Road, Pune',
    district: 'Pune',
  },
  {
    title: 'Sewage smell in the water supply',
    description:
      'For the past three days the tap water has smelled of sewage. We have stopped drinking it and are boiling everything. Two people in the building have stomach illness.',
    category: 'Water Supply',
    priority: Priority.Critical,
    sentiment: Sentiment.HighlyNegative,
    status: Status.InProgress,
    daysAgo: 11,
    aiConfidence: 0.94,
    aiSummary: 'Suspected sewage contamination of the drinking water supply with reported illness.',
    location: 'Yerawada, Pune',
    district: 'Pune',
  },
  {
    title: 'No doctor at the primary health centre most days',
    description:
      'The primary health centre is open but there is no doctor present on most days. Patients are being told to travel to the district hospital instead.',
    category: 'Public Health',
    priority: Priority.High,
    sentiment: Sentiment.Negative,
    status: Status.UnderReview,
    daysAgo: 40,
    aiConfidence: 0.76,
    aiSummary: 'Primary health centre operating without a doctor on most days, diverting patients.',
    location: 'Pimpri, Pune',
    district: 'Pune',
  },
  {
    title: 'Toilet block at the bus stand has no lighting',
    description:
      'The toilet block at the bus stand has no working light. It is unusable after dark, which is exactly when most passengers need it.',
    category: 'Sanitation',
    priority: Priority.Medium,
    sentiment: Sentiment.Negative,
    status: Status.Resolved,
    daysAgo: 45,
    resolvedAfterDays: 6,
    aiConfidence: 0.84,
    aiSummary: 'Unlit toilet block at a bus stand, unusable after dark.',
    location: 'Swargate, Pune',
    district: 'Pune',
    rating: 5,
    ratingComment: 'Fixed quickly, thank you.',
  },
];

interface Args {
  reset: boolean;
}

function parseArgs(): Args {
  return { reset: process.argv.slice(2).includes('--reset') };
}

async function main() {
  const { reset } = parseArgs();

  const citizen = await prisma.user.findUnique({ where: { email: CITIZEN_EMAIL } });
  if (!citizen) {
    throw new Error(
      `[seed:citizen] no user ${CITIZEN_EMAIL}. Run \`npm --prefix server run db:seed\` first.`,
    );
  }

  const departments = await prisma.department.findMany({ select: { id: true, name: true } });
  const deptIdByName = new Map(departments.map((d) => [d.name, d.id]));
  if (deptIdByName.size === 0) {
    throw new Error('[seed:citizen] no departments. Run `npm --prefix server run db:seed` first.');
  }

  // Category to department, matching the planning layer's mapping.
  const DEPT_FOR: Record<string, string> = {
    'Water Supply': 'Water Supply Board',
    Electricity: 'Electricity Department',
    'Street Lights': 'Electricity Department',
    Sanitation: 'Sanitation Department',
    'Waste Management': 'Sanitation Department',
    Drainage: 'Municipal Corporation',
    'Roads & Infrastructure': 'Public Works Department',
    'Public Health': 'Healthcare Department',
  };

  const districtNames = [...new Set(FIXTURES.map((f) => f.district))];
  // Scoped to India: the fixtures name Indian districts, and matching on name
  // alone would become ambiguous the moment another country shares one.
  const country = await prisma.country.findUnique({ where: { iso2: 'IN' } });
  const districts = await prisma.district.findMany({
    where: { name: { in: districtNames }, ...(country ? { countryId: country.id } : {}) },
    select: { id: true, name: true },
  });
  const districtIdByName = new Map(districts.map((d) => [d.name, d.id]));
  const missingDistricts = districtNames.filter((n) => !districtIdByName.has(n));
  if (missingDistricts.length) {
    console.warn(
      `[seed:citizen] district(s) not found: ${missingDistricts.join(', ')}. ` +
        'Those complaints will have no district and will not appear in planning aggregates. ' +
        'Run `npm --prefix server run ingest:census` to load districts.',
    );
  }

  if (reset) {
    const titles = FIXTURES.map((f) => f.title);
    const doomed = await prisma.complaint.findMany({
      where: { citizenId: citizen.id, title: { in: titles } },
      select: { id: true },
    });
    if (doomed.length) {
      // Feedback and notifications cascade on complaint delete.
      await prisma.complaint.deleteMany({ where: { id: { in: doomed.map((d) => d.id) } } });
      console.log(`[seed:citizen] --reset removed ${doomed.length} previously seeded complaints`);
    }
  }

  const existing = await prisma.complaint.findMany({
    where: { citizenId: citizen.id },
    select: { title: true },
  });
  const existingTitles = new Set(existing.map((e) => e.title));

  let created = 0;
  let skipped = 0;
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  for (const f of FIXTURES) {
    if (existingTitles.has(f.title)) {
      skipped++;
      continue;
    }

    const departmentName = DEPT_FOR[f.category];
    const departmentId = departmentName ? deptIdByName.get(departmentName) : undefined;
    if (!departmentId) {
      console.warn(`[seed:citizen] no department for category "${f.category}", skipping`);
      continue;
    }

    // Spread the time of day so the daily chart does not show every complaint
    // arriving at the same minute.
    const submittedAt = new Date(now - f.daysAgo * day - Math.floor(rand() * day));
    const resolvedAt =
      f.status === Status.Resolved && f.resolvedAfterDays != null
        ? new Date(submittedAt.getTime() + f.resolvedAfterDays * day)
        : null;

    const complaint = await prisma.complaint.create({
      data: {
        citizenId: citizen.id,
        title: f.title,
        description: f.description,
        category: f.category,
        departmentId,
        districtId: districtIdByName.get(f.district) ?? null,
        priority: f.priority,
        status: f.status,
        sentiment: f.sentiment,
        aiConfidence: f.aiConfidence,
        aiSummary: f.aiSummary,
        language: f.voice?.language ?? 'en',
        location: f.location,
        // Not modelled demand — see the header comment. These are authored demo
        // fixtures and belong in the same bucket as hand-filed complaints.
        isSynthetic: false,
        ...(f.voice
          ? { sourceTranscript: f.voice.transcript, sourceLanguage: f.voice.language }
          : {}),
        submittedAt,
        updatedAt: resolvedAt ?? submittedAt,
        resolvedAt,
        estimatedResolutionAt: new Date(submittedAt.getTime() + 5 * day),
      },
    });

    // A submission notification, plus a resolution one where applicable, so the
    // notifications page has something coherent to show.
    await prisma.notification.create({
      data: {
        userId: citizen.id,
        type: 'submitted',
        message: `Complaint received: ${f.title}`,
        complaintId: complaint.id,
        read: f.daysAgo > 7,
        createdAt: submittedAt,
      },
    });

    if (resolvedAt) {
      await prisma.notification.create({
        data: {
          userId: citizen.id,
          type: 'resolved',
          message: `Your complaint has been resolved: ${f.title}`,
          complaintId: complaint.id,
          read: f.daysAgo > 14,
          createdAt: resolvedAt,
        },
      });
    }

    if (f.rating != null && resolvedAt) {
      await prisma.feedback.create({
        data: {
          complaintId: complaint.id,
          citizenId: citizen.id,
          rating: f.rating,
          comment: f.ratingComment ?? null,
          createdAt: new Date(resolvedAt.getTime() + day),
        },
      });
    }

    created++;
  }

  console.log(`[seed:citizen] created ${created}, skipped ${skipped} already present`);

  const summary = await prisma.complaint.groupBy({
    by: ['status'],
    where: { citizenId: citizen.id },
    _count: { _all: true },
    orderBy: { status: 'asc' },
  });
  const total = summary.reduce((a, s) => a + s._count._all, 0);
  console.log(`[seed:citizen] ${CITIZEN_EMAIL} now has ${total} complaints:`);
  for (const s of summary) console.log(`  ${s.status}: ${s._count._all}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('[seed:citizen] done');
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

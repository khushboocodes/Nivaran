# Demo script

A three-minute walkthrough. The order matters: it moves from one citizen's voice
to a national funding decision, which is the whole argument of the project.

## Before you start

```cmd
docker compose up -d
npm run dev:all
```

Then confirm the data is loaded:

```cmd
docker exec nivaran-postgres psql -U nivaran -d nivaran -c "select (select count(*) from districts) districts, (select count(*) from district_indicators) indicators, (select count(*) from complaints) complaints, (select count(*) from recommendations) briefs;"
```

Expect roughly 640 districts, 6,400 indicators, ~150,000 complaints, and 30
recommendation rows. If any are zero, see "Cold start" below.

The demo citizen should also have a history to show, or the citizen portal looks
empty:

```cmd
npm --prefix server run seed:citizen
```

That is idempotent, so running it again is harmless. It gives the account twenty
complaints across all eight categories with a realistic status funnel, seven
resolved with star ratings, and two dictated in Marathi and Hindi — which means
you can show the stored original-language transcript even if the Gemini quota is
exhausted and live dictation is unavailable.

Have two browser tabs open and logged in ahead of time, because logging in on
stage wastes fifteen seconds:

- Citizen — http://localhost:5173/login — `citizen@demo.nivaran.in` / `Citizen@2026`
- Admin — http://localhost:5173/admin/login — `admin@demo.nivaran.in` / `Admin@2026`

**Check the Gemini quota before presenting.** The free tier allows 20
`generateContent` requests per day. If it is exhausted, the voice step will fail
gracefully to manual entry, which is honest but undercuts the demo. Test with:

```cmd
npm --prefix server run planning:briefs -- --limit 1
```

If that reports a 429, skip the live voice step and narrate the stored transcript
on an existing complaint instead.

---

## 1. The citizen, in their own language (45 seconds)

Citizen tab, **Submit Complaint**.

Press **Record** and speak a complaint in Hindi or another Indian language.
Something like: *"हमारे मोहल्ले में आठ दिन से नल का पानी नहीं आया है। पीने का पानी लाने के लिए दो
किलोमीटर जाना पड़ता है।"*

Press **Stop**, then **Fill form from my recording**.

Say while it works: one Gemini call is transcribing the speech in the language
spoken, detecting that language, translating to English, and classifying the
complaint. No Google Cloud billing is involved — this is the same AI Studio key
the rest of the app uses.

When it returns, point at the two panels: **What you said** and **English
translation**. Make the point explicitly:

> The original words are stored with the complaint. An officer can check the
> translation rather than trust it. We never discard what the citizen actually
> said.

Submit the complaint.

## 2. From one voice to national demand (20 seconds)

Admin tab, **Planning** in the sidebar.

Do not skip the amber banner at the top. Read the middle line aloud:

> Citizen demand volumes here are modelled, weighted by real deprivation figures.

Then say: we have no access to real national grievance microdata. CPGRAMS
publishes only aggregate monthly PDFs. So demand is generated — but generated
*from* real Census 2011 deprivation, which means hotspots fall where measured
infrastructure gaps genuinely are. The correlation between census water
deprivation and modelled water-complaint intensity is 0.909 across 637 districts.

## 3. The ranking, and why it is arithmetic (40 seconds)

Point at the top of the table: Arwal, Madhepura, Sheohar, Araria — the north
Bihar belt — then Nabarangapur in Odisha, Simdega in Jharkhand, Shrawasti in
Uttar Pradesh.

> Several of these are NITI Aayog Aspirational Districts. We did not tell the
> system that. It found them from census deprivation and demand.

Now the key claim:

> Every number on this screen is computed in SQL from database rows. No language
> model participates in scoring or ranking. A ministry cannot act on a number it
> cannot reproduce.

Switch the category filter to **Roads & Infrastructure** and point at the amber
**Proxy measure** badge and the sentence beside it.

> Census 2011 has no road-quality column. We say so, in place, rather than
> quietly passing a proxy off as a measurement.

## 4. Change the policy, watch the ranking move (25 seconds)

Drag **Citizen demand** to 0 and **Equity** to 1.

The table reorders — Kurung Kumey in Arunachal Pradesh comes to the top.

> The weighting is a policy judgement, not a fact. A ministry that values equity
> over reported demand gets a different list, and should be able to see that and
> argue about it. This is not a baked ranking behind a chart.

Reset with **Reset to configured**.

## 5. The brief, and its provenance (40 seconds)

Click the top row. In the drawer:

- The four score bars. Point at **Investment deficit** — hatched, reading "no
  data". Say: *the Jal Jeevan Mission dataset we wanted is access-restricted and
  our request is still pending, so that component is excluded and its weight
  redistributed. An empty bar would read as zero, and zero would mean "fully
  funded" — the opposite of the truth.*
- The **Policy assessment** written by Gemini. Note that it states existing
  public spending is unknown, because we instructed it to when the data is
  absent.
- Scroll to the risks. On several districts Gemini flags that a low recorded
  complaint count may reflect reporting barriers rather than absence of need —
  it raised that unprompted.
- The provenance line: **input digest**. Say:

> That is a SHA-256 of the exact figures the model was shown. Any sentence in
> this brief traces back to the numbers behind it. We also scan the generated
> prose for numerals and check each one against the figures we supplied; anything
> unaccounted for is recorded on the row as a data-integrity caveat instead of
> being published quietly.

Click **Export policy brief** and open the PDF. Point at the provenance footer.

## 6. Close (10 seconds)

> Nivaran is MIT licensed, runs entirely on free tiers, and every dataset is
> cited in ATTRIBUTIONS.md including the one we could not get. The scoring
> engine is 640 districts today; the same code runs on any country with
> district-level census data, which is what makes it portable across BRICS
> rather than India-only.

---

## If something breaks

**Voice step returns an error.** Almost certainly the daily Gemini quota. The
form stays usable and the failure message says so. Narrate it as designed
behaviour, because it is: a model outage must never block a citizen from filing.

**A district shows "scores only" instead of a brief.** Briefs are pre-generated
for the top 25. That row's scores are still correct. Pick a row with the sparkle
icon instead.

**The ranking looks empty.** Check the state filter is not set to a state with no
districts in the current top-N.

## Cold start

If the database is empty:

```cmd
npm --prefix server run prisma:migrate
npm --prefix server run db:seed
npm --prefix server run ingest:census
npm --prefix server run ingest:demand
npm --prefix server run seed:citizen
npm --prefix server run planning:briefs -- --limit 25
```

The census ingest downloads its source CSV on first run and caches it, so
everything after that works offline. The briefing step needs `GEMINI_API_KEY` and
will consume most of a day's free quota; without it the planning screen still
renders rankings, just without narrative.

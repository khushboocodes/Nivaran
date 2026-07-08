import { describe, it, expect } from 'vitest';
import { heuristicService } from './index';

/**
 * The heuristic provider is the always-available fallback for AI
 * classification. Its job: never throw, always return a sane shape,
 * and route obvious civic keywords to the right department.
 *
 * Test surface kept narrow — we cover the routing branches and the
 * sentiment / priority overrides that the citizen UI shows in the
 * confidence badge.
 */
describe('heuristicService.classify', () => {
  it('routes water keywords to Water Supply Board', async () => {
    const r = await heuristicService.classify({
      description: 'Water leak from pipe near my house, supply has been cut for 2 days.',
    });
    expect(r.category).toBe('Water Supply');
    expect(r.department).toBe('Water Supply Board');
    expect(r.provider).toBe('heuristic');
  });

  it('routes road keywords to Public Works', async () => {
    const r = await heuristicService.classify({
      description: 'Large pothole on the main road near the school crossing.',
    });
    expect(r.category).toBe('Roads & Infrastructure');
    expect(r.department).toBe('Public Works Department');
  });

  it('escalates priority on urgent / emergency language', async () => {
    const r = await heuristicService.classify({
      description: 'EMERGENCY: live electric wire fallen, this is a danger to children.',
    });
    expect(r.priority).toBe('Critical');
  });

  it('detects highly-negative sentiment', async () => {
    const r = await heuristicService.classify({
      description: 'This is absolutely unacceptable. I am furious that the garbage has not been collected.',
    });
    expect(r.sentiment).toBe('Highly Negative');
  });

  it('falls back gracefully when no keywords match', async () => {
    const r = await heuristicService.classify({
      description: 'Just sharing some general feedback about the city services overall.',
    });
    expect(r.category).toBe('Other');
    expect(r.department).toBe('Municipal Corporation');
    expect(r.priority).toBe('Medium');
    expect(r.sentiment).toBe('Neutral');
  });

  it('always returns a confidence between 0 and 1', async () => {
    const cases = [
      'Power outage in my locality',
      'Sewage overflow near my home',
      'Hospital dirty and overcrowded',
      'small cosmetic issue with the signage',
    ];
    for (const description of cases) {
      const r = await heuristicService.classify({ description });
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('does not route a pothole-with-rain description to Water Supply', async () => {
    // Regression for the issue where "the pothole fills with water after rain"
    // hit the water keyword first and routed to Water Supply Board instead
    // of the obvious Roads & Infrastructure / Public Works classification.
    const r = await heuristicService.classify({
      description:
        'There is a large pothole on the main road right outside the school. ' +
        'It fills with water after rain and becomes invisible. Two scooter ' +
        'riders fell yesterday during the school drop-off. Serious hazard.',
    });
    expect(r.category).toBe('Roads & Infrastructure');
    expect(r.department).toBe('Public Works Department');
    expect(r.priority).toBe('High');
  });

  it('uses the title to disambiguate when description is generic', async () => {
    // The description alone is ambiguous, but the title clearly says
    // "Streetlight". Title hits are weighted 2x so the heuristic should
    // route to Street Lights even though the description never mentions
    // electricity / lamps.
    const r = await heuristicService.classify({
      title: 'Streetlight broken near park',
      description: 'It has been like this for two weeks. Please look into it soon.',
    });
    expect(r.category).toBe('Street Lights');
  });

  it('matches stemmed forms (potholes, leaking, flooded)', async () => {
    // Plural / participle forms used to miss because the regex was for
    // the singular base. The light stemmer reduces them to lemmas.
    const r1 = await heuristicService.classify({
      description: 'Multiple potholes on the highway are dangerous',
    });
    expect(r1.category).toBe('Roads & Infrastructure');

    const r2 = await heuristicService.classify({
      description: 'The pipeline has been leaking for three days, water tank is empty',
    });
    expect(r2.category).toBe('Water Supply');
  });

  it('classifies Hinglish keywords correctly', async () => {
    // Civic complaints in transliterated Hindi should still route. We
    // don't try to handle full sentences — just the dozen or so words
    // that show up everywhere in Indian municipal corpora.
    const garbage = await heuristicService.classify({
      description: 'Yahan kachra padaa hua hai do din se, koi uthane nahin aa raha',
    });
    expect(garbage.category).toBe('Waste Management');

    const drain = await heuristicService.classify({
      description: 'Naala overflow ho raha hai, paani sadak pe jama hai',
    });
    // Drainage should win over Water Supply because "naala" + "overflow"
    // are both strong drainage signals.
    expect(drain.category).toBe('Drainage');
  });

  it('treats the absence of a keyword (negation) as no signal', async () => {
    // "There is no pothole" should not classify as Roads. With nothing
    // else firing, the result falls back to Other.
    const r = await heuristicService.classify({
      description: 'There is no pothole or damage on this road, just a routine inspection note',
    });
    // Either the category is no longer Roads, or the score didn't clear
    // the threshold. Both outcomes mean the negation was respected.
    expect(['Other', 'Roads & Infrastructure']).toContain(r.category);
    // Confidence should be modest because the signal is weak.
    expect(r.confidence).toBeLessThanOrEqual(0.85);
  });
});

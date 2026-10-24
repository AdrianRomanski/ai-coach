import {
  enforceVerdict,
  sessionGaps,
  type ItemJudgement,
} from './judgement.js';

const clean = (verdict: 'pass' | 'fail' = 'pass'): ItemJudgement => ({
  claims: [
    {
      text: 'Microtasks run before the next task.',
      kind: 'mechanism',
      supported: true,
      fallacies: [],
      handWave: false,
    },
  ],
  gaps: [],
  verdict,
  reason: 'Explains the ordering.',
});

describe('verdict rules', () => {
  it('turns a model pass into fail when a claim has a fallacy, a hand-wave or a gap remains', () => {
    const fallacy = clean();
    fallacy.claims[0]!.fallacies = ['circular_reasoning'];
    const wave = clean();
    wave.claims[0]!.handWave = true;
    const gap = { ...clean(), gaps: ['Does not say what a task is.'] };

    for (const item of [fallacy, wave, gap]) {
      expect(enforceVerdict(item)).toMatchObject({
        modelVerdict: 'pass',
        verdict: 'fail',
      });
    }
    expect(enforceVerdict(clean())).toMatchObject({ verdict: 'pass' });
    expect(enforceVerdict(clean('fail'))).toMatchObject({ verdict: 'fail' });
  });

  it('folds flawed claims into the gaps recorded with the session', () => {
    const item = clean('fail');
    item.gaps = ['No mention of the task queue.'];
    item.claims.push({
      text: 'It just works because the spec says so.',
      kind: 'assertion',
      supported: false,
      fallacies: ['appeal_to_authority'],
      handWave: true,
    });
    expect(sessionGaps(item)).toEqual([
      'No mention of the task queue.',
      'appeal to authority, hand-waving: "It just works because the spec says so."',
    ]);
  });
});

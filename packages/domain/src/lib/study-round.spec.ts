import {
  StudyRound,
  StudyRoundError,
  groundedIn,
  locatePassage,
  quotedPassage,
} from './study-round.js';

describe('StudyRound', () => {
  it('walks the gaps in order, closing, retrying and giving up after the allowed attempts', () => {
    const round = StudyRound.over(['Gap A', 'Gap B']);
    expect(round.current).toMatchObject({ gap: 'Gap A', status: 'open' });
    expect(round.position).toEqual({ index: 0, total: 2 });

    expect(round.record('first try', false)).toBe('retry');
    expect(round.record('better try', true)).toBe('closed');
    expect(round.current).toMatchObject({ gap: 'Gap B' });
    expect(round.position).toEqual({ index: 1, total: 2 });

    expect(round.record('no idea', false)).toBe('retry');
    expect(round.record('still no idea', false)).toBe('unresolved');
    expect(round.isFinished).toBe(true);
    expect(round.gaps).toEqual([
      {
        gap: 'Gap A',
        status: 'closed',
        attempts: 2,
        explanation: 'better try',
      },
      {
        gap: 'Gap B',
        status: 'unresolved',
        attempts: 2,
        explanation: 'still no idea',
      },
    ]);
  });

  it('skips a gap without an explanation', () => {
    const round = StudyRound.over(['A', 'B']);
    round.skip();
    expect(round.current).toMatchObject({ gap: 'B' });
    expect(round.gaps[0]).toEqual({
      gap: 'A',
      status: 'unresolved',
      attempts: 0,
      explanation: null,
    });
  });

  it('refuses nonsense', () => {
    expect(() => StudyRound.over([' '])).toThrow(StudyRoundError);
    expect(() => StudyRound.over(['A'], 0)).toThrow(StudyRoundError);
    const round = StudyRound.over(['A'], 1);
    expect(() => round.record('  ', true)).toThrow(/empty/);
    round.record('done', true);
    expect(() => round.record('again', true)).toThrow(/Every gap/);
  });
});

describe('locatePassage', () => {
  const body = [
    '# Chapter',
    '## Page 40',
    'Capture means keeping only what resonates with you, the ideas that surprise or move you.',
    '## Page 41',
    'Distill by highlighting and bolding the most important passages so that future you',
    'can find the essence of a note quickly, without rereading everything.',
  ].join('\n');

  it('returns the author words and page that best match the query', () => {
    expect(
      locatePassage(
        body,
        'how highlighting and bolding help future you find the essence',
        70,
      ),
    ).toEqual({
      text: 'Distill by highlighting and bolding the most important passages so that future you can find the essence of a note quickly, without rereading everything.',
      page: 41,
    });
  });

  it('finds the passage a quote really comes from, and ignores invented quotes', () => {
    expect(
      quotedPassage(
        body,
        'highlighting and bolding the most important passages so that future',
      ),
    ).toMatchObject({ page: 41 });
    expect(
      quotedPassage(
        body,
        'a completely invented sentence that the author never wrote at all',
      ),
    ).toBeNull();
  });

  it('knows whether a note is grounded enough to hold a gap, also for short notes', () => {
    expect(
      groundedIn(
        body,
        'You did not explain why bolding and highlighting help future you.',
      ),
    ).toBe(true);
    expect(groundedIn(body, 'You did not explain quantum lattices.')).toBe(
      false,
    );
    expect(
      groundedIn('Bolding helps future you.', 'Why does bolding help?'),
    ).toBe(true);
  });

  it('returns nothing when the note does not discuss it', () => {
    expect(locatePassage(body, 'quantum chromodynamics lattice')).toBeNull();
    expect(locatePassage(body, 'the a of')).toBeNull();
  });
});

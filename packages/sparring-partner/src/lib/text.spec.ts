import { findBuzzwords, fold, longestSharedRun, quotesSource } from './text.js';

describe('fold', () => {
  it('drops diacritics, including the ones NFD cannot split', () => {
    expect(fold('Żółw ŁÓDŹ gęś Straße')).toBe('zolw lodz ges strasse');
  });
});

describe('findBuzzwords', () => {
  const list = ['robust', 'best practice', 'out of the box', 'game-changer'];

  it('matches whole words and phrases regardless of case and punctuation', () => {
    expect(
      findBuzzwords(
        'It is ROBUST, a Best-Practice that works out of the box!',
        list,
      ),
    ).toEqual(['robust', 'best practice', 'out of the box']);
  });

  it('matches hyphenated buzzwords written with a space', () => {
    expect(findBuzzwords('a real game changer', list)).toEqual([
      'game-changer',
    ]);
  });

  it('does not match inside longer words', () => {
    expect(findBuzzwords('robustness matters', list)).toEqual([]);
  });
});

describe('verbatim detection', () => {
  const note =
    'Microtasks always drain completely before the event loop picks the next macrotask.';

  it('measures the longest shared run of words', () => {
    expect(
      longestSharedRun('why do microtasks always drain completely first', note),
    ).toBe(4);
  });

  it('flags a question that copies a long phrase from the note', () => {
    expect(
      quotesSource(
        'Why do microtasks always drain completely before the event loop moves on?',
        note,
        6,
      ),
    ).toBe(true);
    expect(
      quotesSource('What decides which queued callback runs next?', note, 6),
    ).toBe(false);
  });
});

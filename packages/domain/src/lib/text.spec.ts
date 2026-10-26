import {
  findBuzzwords,
  fold,
  longestSharedRun,
  quotesSource,
  saidIn,
} from './text.js';

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

describe('saidIn', () => {
  const answers = [
    'it helps take the essence of text',
    'Because we have layers: raw note, bolding, highlighting, summarization.',
  ];

  it('finds words the learner really wrote, ignoring case and punctuation', () => {
    expect(saidIn(answers, 'We have layers raw note')).toBe(true);
  });

  it('refuses evidence the learner never wrote, or too short to show anything', () => {
    expect(saidIn(answers, 'each layer is smaller than the last')).toBe(false);
    expect(saidIn(answers, 'the essence')).toBe(false);
    expect(saidIn(answers, '')).toBe(false);
  });
});

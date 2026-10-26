import { DomainError, InvalidTier2PayloadError } from './errors.js';
import { sparringRules } from './sparring-rules.js';
import { tier2Payload } from './tier2-payload.js';

describe('tier2Payload', () => {
  it('keeps exactly the challenges and answers, frozen', () => {
    const payload = tier2Payload({
      items: [{ challenge: 'Why?', answer: 'Because.' }],
    });
    expect(payload).toEqual({
      items: [{ challenge: 'Why?', answer: 'Because.' }],
    });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.items[0])).toBe(true);
  });

  it('refuses anything that could carry the note out of Tier 1', () => {
    for (const bad of [
      { items: [{ challenge: 'c', answer: 'a', body: 'private' }] },
      { items: [{ challenge: 'c', answer: 'a' }], coach_id: 'c-1' },
      { items: [] },
      { items: [{ challenge: ' ', answer: 'a' }] },
      { items: [{ challenge: 'c', answer: 42 }] },
      [{ challenge: 'c', answer: 'a' }],
      null,
    ]) {
      expect(() => tier2Payload(bad)).toThrow(InvalidTier2PayloadError);
    }
  });
});

describe('tier2Payload with core assertions', () => {
  const item = {
    challenge: 'Why?',
    answer: 'Because.',
    coreAssertions: ['A claim.'],
  };

  it('carries assertions only when they are allowed', () => {
    expect(() => tier2Payload({ items: [item] })).toThrow(
      InvalidTier2PayloadError,
    );
    const payload = tier2Payload(
      { items: [item, { challenge: 'C?', answer: 'A.' }] },
      { allowAssertions: true },
    );
    expect(payload.items).toEqual([item, { challenge: 'C?', answer: 'A.' }]);
    expect(Object.isFrozen(payload.items[0]!.coreAssertions)).toBe(true);
  });

  it('still refuses anything else, and assertions that are not strings', () => {
    expect(() =>
      tier2Payload(
        { items: [{ ...item, body: 'private' }] },
        { allowAssertions: true },
      ),
    ).toThrow(InvalidTier2PayloadError);
    expect(() =>
      tier2Payload(
        { items: [{ ...item, coreAssertions: [1] }] },
        { allowAssertions: true },
      ),
    ).toThrow(/not a list of strings/);
  });
});

describe('sparringRules', () => {
  it('fills defaults and rejects nonsense', () => {
    expect(sparringRules({ maxFollowUps: 1 })).toMatchObject({
      maxFollowUps: 1,
      maxRephrases: 2,
    });
    expect(() => sparringRules({ maxFollowUps: -1 })).toThrow(DomainError);
    expect(() => sparringRules({ verbatimRunWords: 2 })).toThrow(DomainError);
    expect(() => sparringRules({ buzzwords: [' '] })).toThrow(DomainError);
    expect(sparringRules().style).toBe('auto');
    expect(() => sparringRules({ style: 'nope' as never })).toThrow(
      /style must be auto/,
    );
  });
});

describe('tier2Payload with a coaching style', () => {
  it('carries the style the round was sparred in, and refuses an unknown one', () => {
    expect(
      tier2Payload({
        items: [{ challenge: 'Why?', answer: 'Because.', style: 'cornell' }],
      }).items[0],
    ).toEqual({ challenge: 'Why?', answer: 'Because.', style: 'cornell' });
    expect(() =>
      tier2Payload({
        items: [{ challenge: 'Why?', answer: 'Because.', style: 'strict' }],
      }),
    ).toThrow(InvalidTier2PayloadError);
  });
});

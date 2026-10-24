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

describe('sparringRules', () => {
  it('fills defaults and rejects nonsense', () => {
    expect(sparringRules({ maxFollowUps: 1 })).toMatchObject({
      maxFollowUps: 1,
      maxRephrases: 2,
    });
    expect(() => sparringRules({ maxFollowUps: -1 })).toThrow(DomainError);
    expect(() => sparringRules({ verbatimRunWords: 2 })).toThrow(DomainError);
    expect(() => sparringRules({ buzzwords: [' '] })).toThrow(DomainError);
  });
});

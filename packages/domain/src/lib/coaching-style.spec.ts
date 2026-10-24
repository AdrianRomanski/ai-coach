import {
  COACHING_STYLES,
  STYLE_GUIDES,
  asksForHelp,
  isCoachingStyle,
} from './coaching-style.js';

describe('coaching styles', () => {
  it('give every style its own rules, stance and bar, all under the closed-world rule', () => {
    for (const style of COACHING_STYLES) {
      const guide = STYLE_GUIDES[style];
      expect(guide.style).toBe(style);
      expect(guide.rules.some((r) => r.startsWith('Closed world'))).toBe(true);
      expect(guide.challenge && guide.probe && guide.closes).toBeTruthy();
    }
    expect(STYLE_GUIDES.cornell.rules.join(' ')).toMatch(
      /Never ask how something works at a low level/,
    );
    expect(isCoachingStyle('cornell')).toBe(true);
    expect(isCoachingStyle('auto')).toBe(false);
  });
});

describe('asksForHelp', () => {
  it('recognises requests for help, and not real answers', () => {
    for (const text of [
      '/hint',
      '?',
      'teach me',
      'what precise mechanizm you are speaking about - teach me',
      "I don't know",
      'no idea',
      'What do you mean?',
    ]) {
      expect(asksForHelp(text)).toBe(true);
    }
    for (const text of [
      'Bolding lets future me find the essence.',
      'It helps me later on to read fast.',
      'Teaching others makes you learn.',
    ]) {
      expect(asksForHelp(text)).toBe(false);
    }
  });
});

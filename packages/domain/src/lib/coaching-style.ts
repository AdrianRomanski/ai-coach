import { words } from './text.js';

export const COACHING_STYLES = [
  'feynman',
  'socratic',
  'cornell',
  'devil',
] as const;
export type CoachingStyle = (typeof COACHING_STYLES)[number];

export interface StyleGuide {
  style: CoachingStyle;
  summary: string;
  rules: string[];
  challenge: string;
  probe: string;
  closes: string;
  judged: string;
}

const SHARED = [
  'Ask exactly one question per turn.',
  'Never explain, summarise or hint at the answer.',
  'Closed world: test only what the note itself explains. Even when you know more about the topic or the book, never ask about ideas the note only names or leaves for later.',
  'Match the depth of the note: ask for a mechanism only when the note explains one.',
];

export const STYLE_GUIDES: Record<CoachingStyle, StyleGuide> = {
  feynman: {
    style: 'feynman',
    summary: 'Jargon buster: plain words, steps and an analogy',
    rules: [
      ...SHARED,
      'Make the learner explain in plain words, as if to a newcomer, without the jargon of the note.',
      'Ask for the steps in order, and for a concrete example or analogy when it helps.',
    ],
    challenge:
      'Ask the learner to explain the focus in plain words, step by step, as if to someone new to it.',
    probe:
      'Ask for the missing step, a plainer word for a term they used, or an analogy.',
    closes:
      'The explanation states the idea correctly in plain words; an example or analogy is welcome but not required.',
    judged:
      'a claim is a hand-wave when it names a result without the steps that produce it, or uses vague words in place of a mechanism',
  },
  socratic: {
    style: 'socratic',
    summary: 'Elenchus: test the answer against a counter-example',
    rules: [
      ...SHARED,
      'Never ask "what is X". Take what the learner said and test it.',
      'Offer a counter-example, an edge case or a boundary condition, and ask whether their idea still holds.',
    ],
    challenge:
      'Ask a question that makes the learner commit to a claim about the focus that can then be tested.',
    probe:
      "Introduce a counter-example or edge case to the learner's last claim and ask whether it still holds and why.",
    closes:
      'The explanation states the idea correctly and says when it holds and when it does not.',
    judged:
      'a claim is a hand-wave when it is asserted without the reason it holds, or without saying when it stops holding; a low-level mechanism is not required',
  },
  cornell: {
    style: 'cornell',
    summary: "Book chapter: the author's thesis, argument and intent",
    rules: [
      ...SHARED,
      "Test the author's thesis, the problem it answers, the main argument or evidence, and the key takeaway.",
      'Never ask how something works at a low level; an introduction or essay has no low-level mechanism.',
    ],
    challenge:
      "Ask about the author's central claim or the problem it answers, in a way the learner must restate in their own words.",
    probe:
      'Ask for the reason or evidence the author gives, or for the takeaway, not for a mechanism.',
    closes:
      "The explanation restates the author's point correctly in the learner's own words; no mechanism is needed.",
    judged:
      "a claim is a hand-wave when it states the author's conclusion without the reason or evidence behind it, or uses vague words such as essence or important in place of what the author actually argues; a low-level mechanism is not required",
  },
  devil: {
    style: 'devil',
    summary: "Devil's advocate: failure modes, trade-offs, hidden costs",
    rules: [
      ...SHARED,
      'Act as a skeptical principal engineer in a design review.',
      'Ask where the idea breaks: failure modes, trade-offs, hidden costs, and how to recover.',
    ],
    challenge:
      'Ask where the idea of the focus breaks down in practice, or what it costs.',
    probe:
      'Push on the weakest part of the answer with a realistic failure, a cost or a trade-off.',
    closes:
      'The explanation names a realistic failure mode or cost of the idea and how to handle it.',
    judged:
      'a claim is a hand-wave when it names a risk, cost or trade-off without the condition that causes it or what it costs; a low-level mechanism is not required',
  },
};

export function isCoachingStyle(value: unknown): value is CoachingStyle {
  return (
    typeof value === 'string' &&
    (COACHING_STYLES as readonly string[]).includes(value)
  );
}

const HELP_PHRASES = [
  'teach me',
  'i dont know',
  'i do not know',
  'no idea',
  'idk',
  'what do you mean',
  'help me',
  'give me a hint',
  'hint please',
  'i am stuck',
  'im stuck',
  'explain it',
  'explain this',
];

export function asksForHelp(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (['/hint', '?', 'hint', 'help', '/help'].includes(trimmed)) return true;
  const said = ` ${words(text.replace(/['’]/g, '')).join(' ')} `;
  return HELP_PHRASES.some((phrase) => said.includes(` ${phrase} `));
}

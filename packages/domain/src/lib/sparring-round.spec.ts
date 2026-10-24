import { ChallengeQuotesNoteError, SparringRoundError } from './errors.js';
import { SparringRound } from './sparring-round.js';
import { sparringRules } from './sparring-rules.js';

const NOTE = {
  title: 'Event loop',
  body: 'Microtasks always drain completely before the event loop picks the next macrotask.',
};
const CHALLENGE = 'What decides which queued callback runs next, and why?';

const round = (overrides = {}) =>
  SparringRound.over(NOTE, sparringRules(overrides));

describe('SparringRound', () => {
  it('opens on a challenge, accepts answers, probes and concludes', () => {
    const r = round();
    r.open(CHALLENGE);
    expect(r.pendingQuestion).toBe(CHALLENGE);
    expect(r.submit('Promise callbacks are microtasks.')).toEqual({
      kind: 'accepted',
    });
    expect(r.followUpsLeft).toBe(3);

    r.probe('What would starve if that order flipped?');
    expect(r.submit('Timers would wait.')).toEqual({ kind: 'accepted' });
    expect(r.followUpsLeft).toBe(2);

    expect(r.conclude('pass', [], 'Clear.')).toEqual({
      verdict: 'pass',
      gaps: [],
      feedback: 'Clear.',
    });
    expect(r.result()).toEqual({
      challenge: CHALLENGE,
      answer:
        'Promise callbacks are microtasks.\n\nFollow-up: What would starve if that order flipped?\nAnswer: Timers would wait.',
      verdict: 'pass',
      gaps: [],
      exchanges: [
        { question: CHALLENGE, answer: 'Promise callbacks are microtasks.' },
        {
          question: 'What would starve if that order flipped?',
          answer: 'Timers would wait.',
        },
      ],
    });
  });

  it('refuses a challenge or follow-up that quotes the note', () => {
    const r = round();
    expect(() =>
      r.open(
        'Why do microtasks always drain completely before the event loop moves on?',
      ),
    ).toThrow(ChallengeQuotesNoteError);
    r.open(CHALLENGE);
    r.submit('Microtasks first.');
    expect(() =>
      r.probe('Is it true they always drain completely before the event loop?'),
    ).toThrow(SparringRoundError);
  });

  it('sends buzzwords back for a rephrase until the allowance runs out, and records them as a gap', () => {
    const r = round({ maxRephrases: 1 });
    r.open(CHALLENGE);
    expect(r.submit('It is magic, out of the box.')).toEqual({
      kind: 'rephrase',
      question: CHALLENGE,
      buzzwords: ['out of the box', 'magic'],
    });
    expect(r.submit('Still magic.')).toEqual({ kind: 'accepted' });
    expect(r.conclude('fail', ['No mechanism'], '').gaps).toEqual([
      'No mechanism',
      'Leaned on buzzwords instead of mechanism: out of the box, magic',
    ]);
  });

  it('gives a fresh rephrase allowance for each question', () => {
    const r = round({ maxRephrases: 1 });
    r.open(CHALLENGE);
    expect(r.submit('magic').kind).toBe('rephrase');
    expect(r.submit('Microtasks first.').kind).toBe('accepted');
    r.probe('Why?');
    expect(r.submit('magic').kind).toBe('rephrase');
  });

  it('can withdraw the last accepted answer when the partner fails', () => {
    const r = round();
    r.open(CHALLENGE);
    r.submit('Microtasks first.');
    r.withdrawLastAnswer();
    expect(r.pendingQuestion).toBe(CHALLENGE);
    expect(r.transcript).toEqual([]);
  });

  it('stops probing when the follow-ups run out', () => {
    const r = round({ maxFollowUps: 1 });
    r.open(CHALLENGE);
    r.submit('a');
    r.probe('Why?');
    r.submit('b');
    expect(r.followUpsLeft).toBe(0);
    expect(() => r.probe('And then?')).toThrow(/No follow-ups/);
  });

  it('guards the order of operations', () => {
    const r = round();
    expect(() => r.submit('early')).toThrow(SparringRoundError);
    expect(() => r.result()).toThrow(SparringRoundError);
    r.open(CHALLENGE);
    expect(() => r.open(CHALLENGE)).toThrow(/already open/);
    expect(() => r.submit('   ')).toThrow(/empty/);
    expect(() => r.conclude('pass', [], '')).toThrow(SparringRoundError);
    r.submit('a');
    r.conclude('pass', [], '');
    expect(() => r.submit('again')).toThrow(/concluded/);
  });
});

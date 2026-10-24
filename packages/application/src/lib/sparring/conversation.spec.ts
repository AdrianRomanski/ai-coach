import { NEUTRAL_PROBE, sparringRules } from '@ai-coach/domain';
import { ScriptedPartner } from '../../testing/in-memory.js';
import { ChallengeLeakError, UnavailableError } from '../errors.js';
import { SparringConversation } from './conversation.js';

const NOTE = {
  title: 'Event loop',
  body: 'Microtasks always drain completely before the event loop picks the next macrotask.',
};
const CHALLENGE = 'What decides which queued callback runs next, and why?';
const LEAK =
  'Why do microtasks always drain completely before the event loop moves on?';

const conclude = (verdict: 'pass' | 'fail', gaps: string[] = []) => ({
  action: 'conclude' as const,
  verdict,
  gaps,
  feedback: 'ok',
});

describe('SparringConversation', () => {
  it('runs challenge, probe and verdict through the partner port', async () => {
    const partner = new ScriptedPartner();
    partner.challenges.push(CHALLENGE);
    partner.turns.push(
      { action: 'probe', question: 'What would starve?' },
      conclude('pass'),
    );
    const c = new SparringConversation(
      partner,
      NOTE,
      sparringRules(),
      'feynman',
    );

    expect(await c.start()).toEqual({ kind: 'challenge', question: CHALLENGE });
    expect(await c.answer('Microtasks first.')).toEqual({
      kind: 'probe',
      question: 'What would starve?',
    });
    expect(await c.answer('Timers.')).toMatchObject({
      kind: 'verdict',
      verdict: 'pass',
    });
    expect(c.result().answer).toBe(
      'Microtasks first.\n\nFollow-up: What would starve?\nAnswer: Timers.',
    );
    expect(partner.turnRequests[0]).toMatchObject({
      followUpsLeft: 3,
      exchanges: [{ answer: 'Microtasks first.' }],
    });
  });

  it('asks again with the rejected challenge when one quotes the note, and gives up after the limit', async () => {
    const partner = new ScriptedPartner();
    partner.challenges.push(LEAK, CHALLENGE);
    const c = new SparringConversation(
      partner,
      NOTE,
      sparringRules(),
      'feynman',
    );
    await c.start();
    expect(partner.challengeRequests.map((r) => r.rejected)).toEqual([
      [],
      [LEAK],
    ]);

    const leaky = new ScriptedPartner();
    leaky.challenges.push(LEAK, LEAK);
    await expect(
      new SparringConversation(
        leaky,
        NOTE,
        sparringRules({ maxChallengeAttempts: 2 }),
        'feynman',
      ).start(),
    ).rejects.toBeInstanceOf(ChallengeLeakError);
  });

  it('replaces a follow-up that keeps quoting the note with a neutral probe', async () => {
    const partner = new ScriptedPartner();
    partner.challenges.push(CHALLENGE);
    partner.turns.push(
      { action: 'probe', question: LEAK },
      { action: 'probe', question: LEAK },
    );
    const c = new SparringConversation(
      partner,
      NOTE,
      sparringRules(),
      'feynman',
    );
    await c.start();

    expect(await c.answer('Microtasks.')).toEqual({
      kind: 'probe',
      question: NEUTRAL_PROBE,
    });
    expect(partner.turnRequests[1]!.rejected).toEqual([LEAK]);
  });

  it('handles buzzwords locally without calling the partner', async () => {
    const partner = new ScriptedPartner();
    partner.challenges.push(CHALLENGE);
    const c = new SparringConversation(
      partner,
      NOTE,
      sparringRules(),
      'feynman',
    );
    await c.start();

    expect(await c.answer('It just works, magic.')).toMatchObject({
      kind: 'rephrase',
      buzzwords: ['magic', 'just works'],
    });
    expect(partner.turnRequests).toEqual([]);
  });

  it('concludes when the follow-ups run out even if the partner wants to probe', async () => {
    const partner = new ScriptedPartner();
    partner.challenges.push(CHALLENGE);
    partner.turns.push(
      { action: 'probe', question: 'Why?' },
      { action: 'probe', question: 'And?' },
    );
    const c = new SparringConversation(
      partner,
      NOTE,
      sparringRules({ maxFollowUps: 1 }),
      'feynman',
    );
    await c.start();
    await c.answer('a');
    expect(await c.answer('b')).toMatchObject({
      kind: 'verdict',
      verdict: 'fail',
    });
    expect(partner.turnRequests[1]!.followUpsLeft).toBe(0);
  });

  it('keeps the answer pending when the partner is unavailable, so it can be sent again', async () => {
    const partner = new ScriptedPartner();
    partner.challenges.push(CHALLENGE);
    partner.turns.push(
      new UnavailableError('sparring partner', 'Ollama is down'),
      conclude('pass'),
    );
    const c = new SparringConversation(
      partner,
      NOTE,
      sparringRules(),
      'feynman',
    );
    await c.start();

    await expect(c.answer('Microtasks first.')).rejects.toBeInstanceOf(
      UnavailableError,
    );
    expect(await c.answer('Microtasks first.')).toMatchObject({
      kind: 'verdict',
    });
    expect(c.result().exchanges).toHaveLength(1);
  });

  it('keeps the dialogue on the focus the partner named, in every later request', async () => {
    const partner = new ScriptedPartner();
    partner.challenges.push({
      focus: 'Microtasks drain before the next task.',
      scope: ['Microtask ordering', ' '],
      jargon: [],
      challenge: CHALLENGE,
    });
    partner.turns.push(
      { action: 'probe', question: LEAK },
      { action: 'probe', question: 'Why first?' },
      conclude('pass'),
    );
    const c = new SparringConversation(
      partner,
      NOTE,
      sparringRules(),
      'feynman',
    );
    await c.start();
    await c.answer('Microtasks.');
    await c.answer('Because the queue drains.');
    expect(partner.turnRequests.map((r) => r.scope)).toEqual([
      ['Microtask ordering'],
      ['Microtask ordering'],
      ['Microtask ordering'],
    ]);
    expect(partner.turnRequests.map((r) => r.focus)).toEqual([
      'Microtasks drain before the next task.',
      'Microtasks drain before the next task.',
      'Microtasks drain before the next task.',
    ]);
  });

  it('bans the jargon the partner names for a feynman round', async () => {
    const partner = new ScriptedPartner();
    partner.challenges.push({
      focus: 'F',
      scope: [],
      jargon: ['macrotask'],
      challenge: CHALLENGE,
    });
    const c = new SparringConversation(
      partner,
      NOTE,
      sparringRules(),
      'feynman',
    );
    await c.start();
    expect(await c.answer('The macrotask waits.')).toMatchObject({
      kind: 'rephrase',
      buzzwords: ['macrotask'],
    });
    expect(partner.challengeRequests[0]!.style).toBe('feynman');
  });
});

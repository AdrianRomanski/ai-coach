import { scheduleReview } from '@ai-coach/scheduler';
import {
  ChallengeLeakError,
  SparringSession,
  type SparringResult,
  type ChatModel,
  type SparringTurn,
} from '@ai-coach/sparring-partner';
import type { ReadNoteResult, SessionItemInput } from '@ai-coach/vault-client';
import {
  CommandError,
  resourcesByCoachId,
  type CoachContext,
} from './context.js';
import { tier2History } from './history.js';
import { confirm, paint, readAnswer } from './terminal.js';

interface Sparred {
  note: ReadNoteResult;
  result: SparringResult;
}

async function pickNotes(ctx: CoachContext, refs: string[]): Promise<string[]> {
  if (refs.length) {
    const byCoachId = await resourcesByCoachId(ctx.vault);
    return refs.map((ref) => {
      if (ref.endsWith('.md')) return ref;
      const path = byCoachId.get(ref);
      if (!path)
        throw new CommandError(`No Resources note has coach_id ${ref}`);
      return path;
    });
  }

  const report = await ctx.vault.dueForReview({ today: ctx.today() });
  const candidates = [
    ...report.due.map((n) => ({
      path: n.path,
      title: n.title,
      why: `due ${n.nextReview}, ${n.mastery}`,
    })),
    ...report.unsparred.map((n) => ({
      path: n.path,
      title: n.title,
      why: 'never sparred',
    })),
  ];
  if (!candidates.length) {
    ctx.term.print('Nothing is due and every Resources note has been sparred.');
    return [];
  }
  candidates.forEach((c, i) =>
    ctx.term.print(
      `${String(i + 1).padStart(3)}. ${c.title} ${paint('dim', `(${c.why})`)}`,
    ),
  );
  const raw = await ctx.term.ask(
    'Which notes? Numbers separated by spaces, Enter for all: ',
  );
  if (raw === null) return [];
  const picks = raw.trim()
    ? raw
        .trim()
        .split(/[\s,]+/)
        .map(Number)
    : candidates.map((_, i) => i + 1);
  const bad = picks.filter(
    (n) => !Number.isInteger(n) || n < 1 || n > candidates.length,
  );
  if (bad.length) throw new CommandError(`Not on the list: ${bad.join(', ')}`);
  return [...new Set(picks)].map((n) => candidates[n - 1]!.path);
}

function showTurn(ctx: CoachContext, turn: SparringTurn): void {
  const { term } = ctx;
  switch (turn.kind) {
    case 'challenge':
    case 'probe':
      term.print(`${paint('cyan', 'coach>')} ${turn.question}`);
      break;
    case 'rephrase':
      term.print(
        `${paint('yellow', 'coach>')} No buzzwords: ${turn.buzzwords.join(', ')}. Say it again as the mechanism, in plain words.`,
      );
      term.print(paint('dim', `       ${turn.question}`));
      break;
    case 'verdict':
      term.print(
        `${paint(turn.verdict === 'pass' ? 'green' : 'red', `Tier 1 ${turn.verdict}`)} ${turn.feedback}`,
      );
      for (const gap of turn.gaps) term.print(`  - ${gap}`);
      break;
  }
}

async function sparOne(
  ctx: CoachContext,
  model: ChatModel,
  note: ReadNoteResult,
): Promise<SparringResult | 'skip' | 'quit'> {
  const session = new SparringSession({
    model,
    note: { title: note.title, body: note.body },
    config: ctx.config.sparring,
  });
  showTurn(ctx, await session.start());
  while (!session.isConcluded) {
    const input = await readAnswer(ctx.term);
    if (input.kind !== 'answer') return input.kind;
    const turn = await session.answer(input.text);
    showTurn(ctx, turn);
  }
  return session.result();
}

export async function spar(ctx: CoachContext, refs: string[]): Promise<void> {
  const model = ctx.chatModel();
  const paths = await pickNotes(ctx, refs);
  if (!paths.length) return;
  ctx.term.print(
    paint(
      'dim',
      'Answer in your own words. A blank line sends; /skip skips a note; /quit stops.',
    ),
  );

  const done: Sparred[] = [];
  for (const path of paths) {
    const note = await ctx.vault.readNote(path);
    if (note.bucket !== 'resources') {
      ctx.term.print(
        paint(
          'red',
          `Skipping ${path}: only notes under 3.Resources can be sparred.`,
        ),
      );
      continue;
    }
    ctx.term.print();
    ctx.term.print(
      paint(
        'bold',
        `── ${note.title} ${paint('dim', `(${note.container ?? '3.Resources'})`)}`,
      ),
    );
    let outcome: SparringResult | 'skip' | 'quit';
    try {
      outcome = await sparOne(ctx, model, note);
    } catch (err) {
      if (!(err instanceof ChallengeLeakError)) throw err;
      ctx.term.print(paint('red', `Skipping: ${err.message}`));
      continue;
    }
    if (outcome === 'quit') break;
    if (outcome === 'skip') continue;
    done.push({ note, result: outcome });
  }

  if (!done.length) {
    ctx.term.print('Nothing to record.');
    return;
  }
  await recordTier1(ctx, done);
}

async function recordTier1(ctx: CoachContext, done: Sparred[]): Promise<void> {
  const date = ctx.today();
  const items: SessionItemInput[] = done.map(({ note, result }) => {
    const { nextReview } = scheduleReview(
      {
        tier: 1,
        verdict: result.verdict,
        gaps: result.gaps.length,
        date,
        tier2History: tier2History(note),
      },
      ctx.config.ladder,
    );
    const base = {
      challenge: result.challenge,
      answer: result.answer,
      verdict: result.verdict,
      gaps: result.gaps,
      next_review: nextReview,
    };
    return note.coachId
      ? { coach_id: note.coachId, ...base }
      : { note: note.path, ...base };
  });

  const preview = await ctx.vault.recordSession({ tier: 1, date, items });
  ctx.term.print();
  ctx.term.print(paint('bold', 'Tier 1 session to record:'));
  preview.items.forEach((item, i) =>
    ctx.term.print(
      `  ${done[i]!.note.title}: ${item.verdict}, next review ${item.next_review}`,
    ),
  );
  if (!(await confirm(ctx.term, 'Record it?', true))) {
    ctx.term.print('Not recorded.');
    return;
  }

  const recorded = await ctx.vault.recordSession({
    tier: 1,
    date,
    items,
    execute: true,
  });
  ctx.pending.add({
    sessionId: recorded.session_id,
    date,
    coachIds: recorded.items.map((i) => i.coach_id),
  });
  ctx.term.print(
    `Recorded ${recorded.session_id}. Run ${paint('bold', 'coach judge')} when you are back online.`,
  );
}

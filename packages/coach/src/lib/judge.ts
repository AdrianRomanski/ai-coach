import { sessionGaps, type Judgement } from '@ai-coach/external-judge';
import { scheduleReview } from '@ai-coach/scheduler';
import type { SessionItemInput } from '@ai-coach/vault-client';
import {
  CommandError,
  resourcesByCoachId,
  type CoachContext,
} from './context.js';
import { tier2History } from './history.js';
import type { PendingSession } from './pending.js';
import { confirm, paint } from './terminal.js';

function showJudgement(ctx: CoachContext, title: string, j: Judgement): void {
  const label = paint(
    j.verdict === 'pass' ? 'green' : 'red',
    `Tier 2 ${j.verdict}`,
  );
  const overruled =
    j.modelVerdict !== j.verdict
      ? paint('dim', ' (judge said pass, but flaws remain)')
      : '';
  ctx.term.print(`${paint('bold', title)}: ${label}${overruled}`);
  ctx.term.print(`  ${j.reason}`);
  for (const gap of sessionGaps(j)) ctx.term.print(`  - ${gap}`);
}

async function judgeSession(
  ctx: CoachContext,
  session: PendingSession,
): Promise<void> {
  const payload = await ctx.vault.tier2Payload(session.sessionId);
  if (payload.items.length !== session.coachIds.length) {
    throw new CommandError(
      `${session.sessionId} has ${payload.items.length} items but ${session.coachIds.length} notes were recorded for it`,
    );
  }

  ctx.term.print();
  ctx.term.print(
    paint(
      'dim',
      `Judging ${session.sessionId} (${session.date}): only challenges and answers are sent.`,
    ),
  );
  const judge = await ctx.judge();
  const report = await judge.judge(payload);
  ctx.term.print(paint('dim', `Judged by ${report.model}.`));

  const byCoachId = await resourcesByCoachId(ctx.vault);
  const date = ctx.today();
  const items: SessionItemInput[] = [];
  for (const [i, coachId] of session.coachIds.entries()) {
    const judgement = report.items[i]!;
    const path = byCoachId.get(coachId);
    if (!path) {
      ctx.term.print(
        paint(
          'yellow',
          `No Resources note carries ${coachId} any more; its verdict is not recorded.`,
        ),
      );
      continue;
    }
    const note = await ctx.vault.readNote(path);
    showJudgement(ctx, note.title, judgement);
    const gaps = sessionGaps(judgement);
    const { nextReview } = scheduleReview(
      {
        tier: 2,
        verdict: judgement.verdict,
        gaps: gaps.length,
        date,
        tier2History: tier2History(note),
      },
      ctx.config.ladder,
    );
    items.push({
      coach_id: coachId,
      ...payload.items[i]!,
      verdict: judgement.verdict,
      gaps,
      next_review: nextReview,
    });
  }

  if (!items.length) {
    ctx.pending.remove(session.sessionId);
    return;
  }
  const preview = await ctx.vault.recordSession({ tier: 2, date, items });
  ctx.term.print(paint('bold', 'Tier 2 session to record:'));
  for (const item of preview.items) {
    ctx.term.print(
      `  ${item.note}: ${item.verdict}, next review ${item.next_review}`,
    );
  }
  if (!(await confirm(ctx.term, 'Record it?', true))) {
    ctx.term.print('Not recorded; it stays in the queue.');
    return;
  }
  const recorded = await ctx.vault.recordSession({
    tier: 2,
    date,
    items,
    execute: true,
  });
  ctx.pending.remove(session.sessionId);
  ctx.term.print(`Recorded ${recorded.session_id}.`);
}

export async function judge(
  ctx: CoachContext,
  sessionIds: string[],
): Promise<void> {
  const queue = ctx.pending.list();
  const sessions = sessionIds.length
    ? sessionIds.map((id) => {
        const found = queue.find((s) => s.sessionId === id);
        if (!found)
          throw new CommandError(`${id} is not waiting for judgement`);
        return found;
      })
    : queue;
  if (!sessions.length) {
    ctx.term.print('No Tier 1 sessions are waiting for judgement.');
    return;
  }
  for (const session of sessions) await judgeSession(ctx, session);
}

import { spawn } from 'node:child_process';
import {
  ChallengeLeakError,
  NotFoundError,
  NotSparrableError,
  type FilingPlan,
  type FilingRequest,
  type JudgedSession,
  type NoteDetails,
  type SparredNote,
  type GapPlace,
  type StudyOutcome,
  type StudyPrompt,
  type Sparring,
  type Turn,
} from '@ai-coach/application';
import type { CoachingStyle, Mastery } from '@ai-coach/domain';
import type { Coach } from './composition.js';
import type { CoachConfig } from './config.js';
import { confirm, paint, readAnswer, type Terminal } from './terminal.js';

export class UsageError extends Error {
  override readonly name = 'UsageError';
}

const MASTERY_STYLE: Record<Mastery, Parameters<typeof paint>[0]> = {
  unsparred: 'dim',
  attempted: 'red',
  tier1_passed: 'yellow',
  tier2_passed: 'green',
};

export async function due(coach: Coach, term: Terminal): Promise<void> {
  const report = await coach.review.due(coach.clock.today());
  term.print(paint('bold', `Due on ${report.today}: ${report.due.length}`));
  for (const n of report.due) {
    term.print(
      `  ${n.title} ${paint(MASTERY_STYLE[n.mastery], n.mastery)} ${paint('dim', `${n.nextReview}  ${n.coachId}`)}`,
    );
  }
  term.print(paint('bold', `Never sparred: ${report.unsparred.length}`));
  for (const n of report.unsparred)
    term.print(`  ${n.title} ${paint('dim', n.path)}`);
  if (report.orphaned.length) {
    term.print(
      paint(
        'yellow',
        `Sessions whose note is gone: ${report.orphaned.map((o) => o.coachId).join(', ')}`,
      ),
    );
  }
  for (const s of report.invalidSessions)
    term.print(paint('red', `Unreadable session ${s.file}: ${s.error}`));
  if (report.waitingForJudge) {
    term.print(
      paint(
        'cyan',
        `Waiting for the judge: ${report.waitingForJudge} session(s). Run coach judge when online.`,
      ),
    );
  }
}

export async function list(coach: Coach, term: Terminal): Promise<void> {
  const { notes, counts } = await coach.review.resources();
  term.print(
    paint(
      'dim',
      Object.entries(counts)
        .map(([bucket, n]) => `${bucket} ${n}`)
        .join(' · '),
    ),
  );
  for (const n of notes) {
    term.print(
      `  ${n.title} ${paint(MASTERY_STYLE[n.mastery], n.mastery)} ${paint('dim', [n.nextReview, n.path].filter(Boolean).join('  '))}`,
    );
  }
}

function whereFrom(note: NoteDetails): string {
  if (!note.chapter) return note.container ?? '3.Resources';
  const { book, part, pages } = note.chapter;
  return [book, part, `pages ${pages}`].filter(Boolean).join(', ');
}

function showTurn(term: Terminal, turn: Turn): void {
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

async function pick(
  sparring: Sparring,
  coach: Coach,
  term: Terminal,
  refs: string[],
): Promise<string[]> {
  if (refs.length) return sparring.resolve(refs);
  const candidates = await sparring.candidates(coach.clock.today());
  if (!candidates.length) {
    term.print('Nothing is due and every Resources note has been sparred.');
    return [];
  }
  candidates.forEach((c, i) =>
    term.print(
      `${String(i + 1).padStart(3)}. ${c.title} ${paint('dim', `(${c.reason})`)}`,
    ),
  );
  const raw = await term.ask(
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
  if (bad.length) throw new UsageError(`Not on the list: ${bad.join(', ')}`);
  return [...new Set(picks)].map((n) => candidates[n - 1]!.path);
}

export interface CommandOptions {
  style?: CoachingStyle;
}

export async function spar(
  coach: Coach,
  term: Terminal,
  refs: string[],
  options: CommandOptions = {},
): Promise<void> {
  const sparring = coach.sparring();
  const paths = await pick(sparring, coach, term, refs);
  if (!paths.length) return;
  term.print(
    paint(
      'dim',
      'Answer in your own words. A blank line sends; /skip skips a note; /quit stops.',
    ),
  );

  const done: SparredNote[] = [];
  notes: for (const path of paths) {
    let opened;
    try {
      opened = await sparring.open(path, options.style);
    } catch (err) {
      if (!(err instanceof NotSparrableError)) throw err;
      term.print(paint('red', `Skipping ${err.message}`));
      continue;
    }
    const { note, conversation } = opened;
    term.print();
    term.print(
      paint(
        'bold',
        `── ${note.title} ${paint('dim', `(${whereFrom(note)} · ${conversation.style} style)`)}`,
      ),
    );
    try {
      showTurn(term, await conversation.start());
    } catch (err) {
      if (!(err instanceof ChallengeLeakError)) throw err;
      term.print(paint('red', `Skipping: ${err.message}`));
      continue;
    }
    while (!conversation.isConcluded) {
      const input = await readAnswer(term);
      if (input.kind === 'quit') break notes;
      if (input.kind === 'skip') continue notes;
      showTurn(term, await conversation.answer(input.text));
    }
    done.push({ note, result: conversation.result() });
  }

  if (!done.length) {
    term.print('Nothing to record.');
    return;
  }
  const plan = await sparring.plan(done, coach.clock.today());
  term.print();
  term.print(paint('bold', 'Tier 1 session to record:'));
  plan.preview.items.forEach((item, i) =>
    term.print(
      `  ${plan.titles[i]}: ${item.verdict}, next review ${item.nextReview}`,
    ),
  );
  if (!(await confirm(term, 'Record it?', true))) {
    term.print('Not recorded.');
    return;
  }
  const recorded = await sparring.record(plan);
  term.print(
    `Recorded ${recorded.sessionId}. Run ${paint('bold', 'coach judge')} when you are back online.`,
  );
  const failed = recorded.items
    .map((item, i) => ({
      path: item.notePath,
      title: plan.titles[i]!,
      verdict: item.verdict,
    }))
    .filter((item) => item.verdict === 'fail');
  await offerStudy(coach, term, failed, options.style);
}

function showJudged(term: Terminal, judged: JudgedSession): void {
  term.print(paint('dim', `Judged by ${judged.model}.`));
  for (const n of judged.notes) {
    const label = paint(
      n.judgement.verdict === 'pass' ? 'green' : 'red',
      `Tier 2 ${n.judgement.verdict}`,
    );
    const overruled =
      n.judgement.modelVerdict !== n.judgement.verdict
        ? paint('dim', ' (judge said pass, but flaws remain)')
        : '';
    term.print(`${paint('bold', n.title)}: ${label}${overruled}`);
    term.print(`  ${n.judgement.reason}`);
    for (const gap of n.gaps) term.print(`  - ${gap}`);
  }
  for (const coachId of judged.missing) {
    term.print(
      paint(
        'yellow',
        `No Resources note carries ${coachId} any more; its verdict is not recorded.`,
      ),
    );
  }
}

export async function judge(
  coach: Coach,
  term: Terminal,
  sessionIds: string[],
  options: CommandOptions = {},
): Promise<void> {
  const judging = coach.judging();
  const sessions = await judging.select(sessionIds);
  if (!sessions.length) {
    term.print('No Tier 1 sessions are waiting for judgement.');
    return;
  }
  for (const session of sessions) {
    term.print();
    term.print(
      paint(
        'dim',
        `Judging ${session.sessionId} (${session.date}): only challenges and answers are sent.`,
      ),
    );
    const judged = await judging.judge(session, coach.clock.today());
    showJudged(term, judged);
    if (judged.preview) {
      term.print(paint('bold', 'Tier 2 session to record:'));
      for (const item of judged.preview.items) {
        term.print(
          `  ${item.notePath}: ${item.verdict}, next review ${item.nextReview}`,
        );
      }
      if (!(await confirm(term, 'Record it?', true))) {
        term.print('Not recorded; it stays in the queue.');
        continue;
      }
    }
    const recorded = await judging.record(judged);
    if (recorded) {
      term.print(`Recorded ${recorded.sessionId}.`);
      await offerStudy(
        coach,
        term,
        judged.notes.filter((n) => n.judgement.verdict === 'fail'),
        options.style,
      );
    }
  }
}

async function offerStudy(
  coach: Coach,
  term: Terminal,
  failed: { path: string; title: string }[],
  style?: CoachingStyle,
): Promise<void> {
  for (const note of failed) {
    if (await confirm(term, `Study the gaps for ${note.title} now?`, true)) {
      await runStudy(coach, term, note.path, style);
    }
  }
}

function showOutcome(term: Terminal, outcome: StudyOutcome): void {
  switch (outcome.kind) {
    case 'rephrase':
      term.print(
        `${paint('yellow', 'coach>')} No buzzwords: ${outcome.buzzwords.join(', ')}. Say it again as the mechanism, in plain words.`,
      );
      break;
    case 'retry':
      term.print(`${paint('yellow', 'coach>')} ${outcome.nudge}`);
      if (outcome.passage) {
        const where = outcome.passage.page
          ? `page ${outcome.passage.page}`
          : 'the note';
        term.print(paint('dim', `  Reread ${where}, in the author's words:`));
        term.print(paint('italic', `  "${outcome.passage.text}"`));
      } else {
        term.print(paint('dim', '  Reread the chapter for this one.'));
      }
      term.print(paint('dim', '  Try again in your own words.'));
      break;
    case 'closed':
      term.print(paint('green', '  Closed.'));
      break;
    case 'unresolved':
      term.print(`${paint('red', '  Still open:')} ${outcome.nudge}`);
      break;
    case 'help':
      term.print(`${paint('cyan', 'coach>')} ${outcome.clue}`);
      if (outcome.passage) {
        const where = outcome.passage.page
          ? `page ${outcome.passage.page}`
          : 'the note';
        term.print(paint('dim', `  Here is ${where}, in the author's words:`));
        term.print(paint('italic', `  "${outcome.passage.text}"`));
      }
      term.print(
        paint(
          'dim',
          '  That did not use up a try. Explain it in your own words.',
        ),
      );
      break;
  }
}

function showPlace(term: Terminal, place: GapPlace): void {
  if (place.kind === 'here') return;
  if (place.kind === 'outside') {
    term.print(
      paint(
        'dim',
        "  This chapter doesn't explain it and no other chapter matched: answer from what you know, or /skip.",
      ),
    );
    return;
  }
  if (!place.passage) {
    term.print(
      paint(
        'dim',
        `  This goes beyond this chapter: ${place.chapter} teaches it. Reread that chapter.`,
      ),
    );
    return;
  }
  const where = place.passage.page ? `, page ${place.passage.page}` : '';
  term.print(
    paint(
      'dim',
      `  This goes beyond this chapter. ${place.chapter} covers it${where}, in the author's words:`,
    ),
  );
  term.print(paint('italic', `  "${place.passage.text}"`));
}

async function runStudy(
  coach: Coach,
  term: Terminal,
  path: string,
  style?: CoachingStyle,
): Promise<void> {
  const studying = coach.studying();
  let opened;
  try {
    opened = await studying.open(path, style);
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err;
    term.print(err.message);
    return;
  }
  const { note, session } = opened;
  term.print();
  term.print(
    paint(
      'bold',
      `── Studying ${note.title} ${paint('dim', `(${whereFrom(note)} · ${session.style} style)`)}`,
    ),
  );
  term.print(
    paint(
      'dim',
      'Explain each gap in your own words. A blank line sends; /hint or "teach me" gives a clue; /skip moves on; /quit stops.',
    ),
  );

  let prompt: StudyPrompt | null = await session.start();
  study: while (prompt) {
    term.print();
    term.print(
      paint(
        'bold',
        `Gap ${prompt.index + 1} of ${prompt.total}: ${prompt.gap}`,
      ),
    );
    showPlace(term, prompt.place);
    term.print(`${paint('cyan', 'coach>')} ${prompt.hint}`);
    for (;;) {
      const input = await readAnswer(term);
      if (input.kind === 'quit') break study;
      if (input.kind === 'skip') {
        prompt = await session.skip();
        continue study;
      }
      const outcome = await session.answer(input.text);
      showOutcome(term, outcome);
      if (outcome.kind === 'closed' || outcome.kind === 'unresolved') {
        prompt = outcome.next;
        continue study;
      }
    }
  }

  const closed = session.gaps.filter((g) => g.status === 'closed').length;
  term.print();
  term.print(
    paint('bold', `Closed ${closed} of ${session.gaps.length} gap(s).`),
  );
  const capture = studying.explanationsNote(note, session, coach.clock.today());
  if (capture) {
    await previewThenApply(
      coach,
      term,
      'Keep your explanations as a note',
      capture,
    );
  }
}

export async function study(
  coach: Coach,
  term: Terminal,
  args: string[],
  options: CommandOptions = {},
): Promise<void> {
  if (args.length !== 1)
    throw new UsageError('Usage: coach study <note path or coach_id>');
  await runStudy(
    coach,
    term,
    await coach.studying().resolve(args[0]!),
    options.style,
  );
}

function showPlan(term: Terminal, plan: FilingPlan): void {
  for (const a of plan.actions) {
    const line =
      a.op === 'rename' || a.op === 'move'
        ? `${a.op} ${a.from} → ${a.to}`
        : a.op === 'remove_empty'
          ? `remove empty ${a.from}`
          : `${a.op} ${a.to}`;
    term.print(`  ${line}`);
  }
  for (const w of plan.warnings) term.print(paint('yellow', `  ! ${w}`));
  for (const c of plan.collisions)
    term.print(paint('red', `  collision: ${c}`));
}

async function previewThenApply(
  coach: Coach,
  term: Terminal,
  what: string,
  request: FilingRequest,
): Promise<void> {
  const plan = await coach.filing.preview(request);
  term.print(paint('bold', `${what}, preview:`));
  if (!plan.actions.length) {
    term.print('  nothing to do');
    return;
  }
  showPlan(term, plan);
  if (plan.collisions.length) {
    term.print(
      paint('red', 'Resolve the collisions first; nothing was moved.'),
    );
    return;
  }
  if (!(await confirm(term, 'Apply?'))) {
    term.print('Nothing changed.');
    return;
  }
  const done = await coach.filing.apply(request);
  term.print(done.executed ? 'Done.' : paint('red', 'Not applied.'));
}

export async function file(
  coach: Coach,
  term: Terminal,
  args: string[],
): Promise<void> {
  if (args.length !== 2) {
    const loose = await coach.review.unfiled();
    term.print(
      'Usage: coach file <note path> <folder>, e.g. coach file "0.Inbox/Idea.md" 3.Resources/TypeScript',
    );
    if (loose.length) {
      term.print(paint('bold', 'Waiting to be filed:'));
      for (const path of loose) term.print(`  ${path}`);
    }
    return;
  }
  const [path, to] = args as [string, string];
  await previewThenApply(coach, term, `File ${path} into ${to}`, {
    kind: 'file',
    path,
    to,
  });
}

export async function init(coach: Coach, term: Terminal): Promise<void> {
  await previewThenApply(coach, term, 'Bring the vault onto PARA', {
    kind: 'init',
  });
}

export async function archive(
  coach: Coach,
  term: Terminal,
  args: string[],
): Promise<void> {
  const [project] = args;
  if (!project || args.length !== 1)
    throw new UsageError('Usage: coach archive <project folder>');
  await previewThenApply(coach, term, `Archive project ${project}`, {
    kind: 'archive',
    project,
  });
}

export async function capture(
  coach: Coach,
  term: Terminal,
  args: string[],
): Promise<void> {
  const title = args.join(' ').trim();
  if (!title) throw new UsageError('Usage: coach capture <title>');
  term.print(paint('dim', 'Write the note; a line with a single "." ends it.'));
  const lines: string[] = [];
  for (;;) {
    const line = await term.ask('');
    if (line === null || line.trim() === '.') break;
    lines.push(line);
  }
  await previewThenApply(coach, term, `Capture "${title}" into 0.Inbox`, {
    kind: 'capture',
    title,
    body: `${lines.join('\n')}\n`,
  });
}

export function view(config: CoachConfig, term: Terminal): Promise<void> {
  const args = [config.docsMcpBin, 'view'];
  if (config.vault) args.push('--vault', config.vault);
  term.print(
    paint(
      'dim',
      'Starting the graph view on http://127.0.0.1:4747/ (Ctrl+C stops it).',
    ),
  );
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', () => resolve());
  });
}

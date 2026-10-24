import { spawn } from 'node:child_process';
import type { FilingResult } from '@ai-coach/vault-client';
import { CommandError, type CoachContext } from './context.js';
import { confirm, paint, type Terminal } from './terminal.js';

const MASTERY_STYLE = {
  unsparred: 'dim',
  attempted: 'red',
  tier1_passed: 'yellow',
  tier2_passed: 'green',
} as const;

export async function due(ctx: CoachContext): Promise<void> {
  const report = await ctx.vault.dueForReview({ today: ctx.today() });
  const { term } = ctx;
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
  const waiting = ctx.pending.list().length;
  if (waiting)
    term.print(
      paint(
        'cyan',
        `Waiting for the judge: ${waiting} session(s). Run coach judge when online.`,
      ),
    );
}

export async function list(ctx: CoachContext): Promise<void> {
  const { notes, counts } = await ctx.vault.listNotes({ bucket: 'resources' });
  ctx.term.print(
    paint(
      'dim',
      Object.entries(counts)
        .map(([bucket, n]) => `${bucket} ${n}`)
        .join(' · '),
    ),
  );
  for (const n of notes) {
    ctx.term.print(
      `  ${n.title} ${paint(MASTERY_STYLE[n.mastery], n.mastery)} ${paint('dim', [n.nextReview, n.path].filter(Boolean).join('  '))}`,
    );
  }
}

function showPlan(term: Terminal, plan: FilingResult): void {
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
  ctx: CoachContext,
  what: string,
  run: (execute: boolean) => Promise<FilingResult>,
): Promise<void> {
  const plan = await run(false);
  ctx.term.print(paint('bold', `${what}, preview:`));
  if (!plan.actions.length) {
    ctx.term.print('  nothing to do');
    return;
  }
  showPlan(ctx.term, plan);
  if (plan.collisions.length) {
    ctx.term.print(
      paint('red', 'Resolve the collisions first; nothing was moved.'),
    );
    return;
  }
  if (!(await confirm(ctx.term, 'Apply?'))) {
    ctx.term.print('Nothing changed.');
    return;
  }
  const done = await run(true);
  ctx.term.print(done.executed ? 'Done.' : paint('red', 'Not applied.'));
}

export async function file(ctx: CoachContext, args: string[]): Promise<void> {
  if (args.length !== 2) {
    const { notes } = await ctx.vault.listNotes();
    const loose = notes.filter(
      (n) => n.bucket === 'inbox' || n.bucket === null,
    );
    ctx.term.print(
      'Usage: coach file <note path> <folder>, e.g. coach file "0.Inbox/Idea.md" 3.Resources/TypeScript',
    );
    if (loose.length) {
      ctx.term.print(paint('bold', 'Waiting to be filed:'));
      for (const n of loose) ctx.term.print(`  ${n.path}`);
    }
    return;
  }
  const [path, to] = args as [string, string];
  await previewThenApply(ctx, `File ${path} into ${to}`, (execute) =>
    ctx.vault.fileNote({ path, to, execute }),
  );
}

export async function init(ctx: CoachContext): Promise<void> {
  await previewThenApply(ctx, 'Bring the vault onto PARA', (execute) =>
    ctx.vault.initVault({ execute }),
  );
}

export async function archive(
  ctx: CoachContext,
  args: string[],
): Promise<void> {
  const [project] = args;
  if (!project || args.length !== 1)
    throw new CommandError('Usage: coach archive <project folder>');
  await previewThenApply(ctx, `Archive project ${project}`, (execute) =>
    ctx.vault.archiveProject({ project, execute }),
  );
}

export async function capture(
  ctx: CoachContext,
  args: string[],
): Promise<void> {
  const title = args.join(' ').trim();
  if (!title) throw new CommandError('Usage: coach capture <title>');
  ctx.term.print(
    paint('dim', 'Write the note; a line with a single "." ends it.'),
  );
  const lines: string[] = [];
  for (;;) {
    const line = await ctx.term.ask('');
    if (line === null || line.trim() === '.') break;
    lines.push(line);
  }
  const body = `${lines.join('\n')}\n`;
  await previewThenApply(ctx, `Capture "${title}" into 0.Inbox`, (execute) =>
    ctx.vault.capture({ title, body, execute }),
  );
}

export function view(ctx: CoachContext): Promise<void> {
  const args = [ctx.config.docsMcpBin, 'view'];
  if (ctx.config.vault) args.push('--vault', ctx.config.vault);
  ctx.term.print(
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

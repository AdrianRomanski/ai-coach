import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const PendingSession = z.object({
  sessionId: z.string(),
  date: z.string(),
  coachIds: z.array(z.string()).min(1),
});
export type PendingSession = z.infer<typeof PendingSession>;

const PendingFile = z.object({ sessions: z.array(PendingSession) });

export class PendingQueue {
  private readonly file: string;

  constructor(private readonly dir: string) {
    this.file = join(dir, 'pending-judgement.json');
  }

  list(): PendingSession[] {
    let raw: string;
    try {
      raw = readFileSync(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const parsed = PendingFile.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new Error(`${this.file} is corrupt: ${parsed.error.message}`);
    }
    return parsed.data.sessions;
  }

  get(sessionId: string): PendingSession | undefined {
    return this.list().find((s) => s.sessionId === sessionId);
  }

  add(session: PendingSession): void {
    this.write([
      ...this.list().filter((s) => s.sessionId !== session.sessionId),
      session,
    ]);
  }

  remove(sessionId: string): void {
    this.write(this.list().filter((s) => s.sessionId !== sessionId));
  }

  private write(sessions: PendingSession[]): void {
    mkdirSync(this.dir, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify({ sessions }, null, 2)}\n`);
    renameSync(tmp, this.file);
  }
}

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Clock,
  PendingJudgements,
  PendingSession,
} from '@ai-coach/application';
import { z } from 'zod';

const PendingFile = z.object({
  sessions: z.array(
    z.object({
      sessionId: z.string(),
      date: z.string(),
      coachIds: z.array(z.string()).min(1),
    }),
  ),
});

export class FilePendingJudgements implements PendingJudgements {
  readonly file: string;

  constructor(private readonly dir: string) {
    this.file = join(dir, 'pending-judgement.json');
  }

  async list(): Promise<PendingSession[]> {
    let raw: string;
    try {
      raw = await readFile(this.file, 'utf8');
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

  async add(session: PendingSession): Promise<void> {
    const others = (await this.list()).filter(
      (s) => s.sessionId !== session.sessionId,
    );
    await this.write([...others, session]);
  }

  async remove(sessionId: string): Promise<void> {
    await this.write(
      (await this.list()).filter((s) => s.sessionId !== sessionId),
    );
  }

  private async write(sessions: PendingSession[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ sessions }, null, 2)}\n`);
    await rename(tmp, this.file);
  }
}

export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export class SystemClock implements Clock {
  constructor(private readonly fixed?: string) {}

  today(): string {
    return this.fixed ?? localDate();
  }
}

import { createInterface, type Interface } from 'node:readline';
import { styleText } from 'node:util';

export interface Terminal {
  print(text?: string): void;
  ask(prompt: string): Promise<string | null>;
}

export type Style = Parameters<typeof styleText>[0];

export function paint(style: Style, text: string): string {
  return styleText(style, text, { stream: process.stdout });
}

export class ProcessTerminal implements Terminal {
  private readonly rl: Interface;
  private readonly lines: string[] = [];
  private waiting: ((line: string | null) => void) | null = null;
  private closed = false;

  constructor() {
    this.rl = createInterface({ input: process.stdin, output: process.stdout });
    this.rl.on('line', (line) => {
      if (this.waiting) {
        const resolve = this.waiting;
        this.waiting = null;
        resolve(line);
      } else {
        this.lines.push(line);
      }
    });
    this.rl.on('close', () => {
      this.closed = true;
      this.waiting?.(null);
      this.waiting = null;
    });
  }

  print(text = ''): void {
    process.stdout.write(`${text}\n`);
  }

  ask(prompt: string): Promise<string | null> {
    process.stdout.write(prompt);
    if (this.lines.length) return Promise.resolve(this.lines.shift()!);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => (this.waiting = resolve));
  }

  close(): void {
    this.rl.close();
  }
}

export async function confirm(
  term: Terminal,
  question: string,
  defaultYes = false,
): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const raw = await term.ask(`${question} ${hint} `);
  if (raw === null) return false;
  const answer = raw.trim().toLowerCase();
  if (!answer) return defaultYes;
  return answer === 'y' || answer === 'yes';
}

export type AnswerInput =
  { kind: 'answer'; text: string } | { kind: 'skip' } | { kind: 'quit' };

export async function readAnswer(term: Terminal): Promise<AnswerInput> {
  const lines: string[] = [];
  for (;;) {
    const line = await term.ask(lines.length ? '... ' : 'you> ');
    if (line === null)
      return lines.length
        ? { kind: 'answer', text: lines.join('\n') }
        : { kind: 'quit' };
    const trimmed = line.trim();
    if (!lines.length && trimmed === '/skip') return { kind: 'skip' };
    if (!lines.length && trimmed === '/quit') return { kind: 'quit' };
    if (!trimmed) {
      if (lines.length) return { kind: 'answer', text: lines.join('\n') };
      continue;
    }
    lines.push(line);
  }
}

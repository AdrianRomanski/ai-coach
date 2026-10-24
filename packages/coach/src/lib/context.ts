import type { JudgeReport } from '@ai-coach/external-judge';
import type { ChatModel } from '@ai-coach/sparring-partner';
import type { Tier2Payload, VaultClient } from '@ai-coach/vault-client';
import type { CoachConfig } from './config.js';
import type { PendingQueue } from './pending.js';
import type { Terminal } from './terminal.js';

export interface Judge {
  judge(payload: Tier2Payload): Promise<JudgeReport>;
}

export interface CoachContext {
  config: CoachConfig;
  vault: VaultClient;
  term: Terminal;
  pending: PendingQueue;
  today: () => string;
  chatModel: () => ChatModel;
  judge: () => Promise<Judge>;
}

export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandError';
  }
}

export async function resourcesByCoachId(
  vault: VaultClient,
): Promise<Map<string, string>> {
  const { notes } = await vault.listNotes({ bucket: 'resources' });
  return new Map(
    notes.filter((n) => n.coachId).map((n) => [n.coachId!, n.path] as const),
  );
}

import type { PendingJudgements } from '../ports/state.js';
import type {
  DueReport,
  FilingPlan,
  FilingRequest,
  NoteListing,
  NotesRepository,
  VaultFiling,
} from '../ports/vault.js';

export interface DueOverview extends DueReport {
  waitingForJudge: number;
}

export class Review {
  constructor(
    private readonly notes: NotesRepository,
    private readonly pending: PendingJudgements,
  ) {}

  async due(today: string): Promise<DueOverview> {
    const [report, waiting] = await Promise.all([
      this.notes.dueForReview(today),
      this.pending.list(),
    ]);
    return { ...report, waitingForJudge: waiting.length };
  }

  resources(): Promise<NoteListing> {
    return this.notes.listNotes({ bucket: 'resources' });
  }

  async unfiled(): Promise<string[]> {
    const { notes } = await this.notes.listNotes();
    return notes
      .filter((n) => n.bucket === 'inbox' || n.bucket === null)
      .map((n) => n.path);
  }
}

export class Filing {
  constructor(private readonly filing: VaultFiling) {}

  preview(request: FilingRequest): Promise<FilingPlan> {
    return this.filing.plan(request, false);
  }

  apply(request: FilingRequest): Promise<FilingPlan> {
    return this.filing.plan(request, true);
  }
}

import { z } from 'zod';

export const PARA_BUCKETS = [
  'inbox',
  'projects',
  'areas',
  'resources',
  'archive',
] as const;

export const ParaBucket = z.enum(PARA_BUCKETS);
export type ParaBucket = z.infer<typeof ParaBucket>;

export const BucketFilter = z.enum([...PARA_BUCKETS, 'out_of_place']);
export type BucketFilter = z.infer<typeof BucketFilter>;

export const Mastery = z.enum([
  'unsparred',
  'attempted',
  'tier1_passed',
  'tier2_passed',
]);
export type Mastery = z.infer<typeof Mastery>;

export const Verdict = z.enum(['pass', 'fail']);
export type Verdict = z.infer<typeof Verdict>;

export type Tier = 1 | 2;

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const InvalidSession = z.object({ file: z.string(), error: z.string() });
export type InvalidSession = z.infer<typeof InvalidSession>;

export const ListNotesResult = z.object({
  total: z.number(),
  counts: z.record(BucketFilter, z.number()),
  notes: z.array(
    z.object({
      path: z.string(),
      title: z.string(),
      bucket: ParaBucket.nullable(),
      container: z.string().nullable(),
      coachId: z.string().nullable(),
      mastery: Mastery,
      nextReview: IsoDate.nullable(),
    }),
  ),
  invalidSessions: z.array(InvalidSession),
});
export type ListNotesResult = z.infer<typeof ListNotesResult>;

export const SessionEntry = z.object({
  session_id: z.string(),
  tier: z.union([z.literal(1), z.literal(2)]),
  date: IsoDate,
  verdict: Verdict,
  gaps: z.array(z.string()),
  next_review: IsoDate,
});
export type SessionEntry = z.infer<typeof SessionEntry>;

export const NoteHistory = z.object({
  mastery: Mastery,
  nextReview: IsoDate.nullable(),
  lastSession: z.string().nullable(),
  sessions: z.number(),
  entries: z.array(SessionEntry),
});
export type NoteHistory = z.infer<typeof NoteHistory>;

export const ReadNoteResult = z.object({
  path: z.string(),
  title: z.string(),
  bucket: ParaBucket.nullable(),
  container: z.string().nullable(),
  raw: z.boolean().optional().default(false),
  concept: z
    .object({
      coreAssertions: z.array(z.string()),
      forbiddenBuzzwords: z.array(z.string()),
      fromNotes: z.array(z.string()),
      passages: z.array(
        z.object({
          quote: z.string(),
          note: z.string(),
          pages: z.string().optional(),
          found: z.boolean(),
          problem: z.string().optional(),
        }),
      ),
      problems: z.array(z.string()),
    })
    .optional(),
  rawRole: z
    .enum(['index', 'chapter'])
    .nullish()
    .transform((role) => role ?? null),
  coachId: z.string().nullable(),
  history: NoteHistory,
  frontmatter: z.record(z.string(), z.unknown()),
  links: z.array(
    z.object({
      kind: z.enum(['wikilink', 'markdown']),
      target: z.string(),
      resolved: z.string().nullable(),
    }),
  ),
  body: z.string(),
});
export type ReadNoteResult = z.infer<typeof ReadNoteResult>;

export const SearchResult = z.array(
  z.object({
    path: z.string(),
    title: z.string(),
    bucket: ParaBucket.nullable(),
    container: z.string().nullable(),
    score: z.number(),
    snippet: z.string(),
  }),
);
export type SearchResult = z.infer<typeof SearchResult>;

export const VaultGraphResult = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      bucket: ParaBucket.nullable(),
      container: z.string().nullable(),
      coachId: z.string().nullable(),
      mastery: Mastery,
    }),
  ),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      kind: z.enum(['wikilink', 'markdown']),
    }),
  ),
  unresolved: z.array(z.object({ source: z.string(), target: z.string() })),
});
export type VaultGraphResult = z.infer<typeof VaultGraphResult>;

export const DueForReviewResult = z.object({
  today: IsoDate,
  due: z.array(
    z.object({
      path: z.string(),
      title: z.string(),
      concept: z.boolean().optional(),
      coachId: z.string(),
      nextReview: IsoDate,
      mastery: Mastery,
    }),
  ),
  unsparred: z.array(
    z.object({
      path: z.string(),
      title: z.string(),
      concept: z.boolean().optional(),
    }),
  ),
  orphaned: z.array(
    z.object({ coachId: z.string(), lastSession: z.string().nullable() }),
  ),
  invalidSessions: z.array(InvalidSession),
});
export type DueForReviewResult = z.infer<typeof DueForReviewResult>;

export const Tier2Payload = z.strictObject({
  items: z.array(
    z.strictObject({
      challenge: z.string(),
      answer: z.string(),
      core_assertions: z.array(z.string()).optional(),
    }),
  ),
});
export type Tier2Payload = z.infer<typeof Tier2Payload>;

export const RecordSessionResult = z.object({
  executed: z.boolean(),
  session_id: z.string(),
  session_file: z.string().nullable(),
  new_coach_ids: z.array(z.object({ path: z.string(), coach_id: z.string() })),
  items: z.array(
    z.object({
      note: z.string(),
      coach_id: z.string(),
      verdict: Verdict,
      next_review: IsoDate,
    }),
  ),
});
export type RecordSessionResult = z.infer<typeof RecordSessionResult>;

export const FilingAction = z.discriminatedUnion('op', [
  z.object({ op: z.literal('rename'), from: z.string(), to: z.string() }),
  z.object({ op: z.literal('create'), to: z.string() }),
  z.object({ op: z.literal('move'), from: z.string(), to: z.string() }),
  z.object({ op: z.literal('write'), to: z.string() }),
  z.object({ op: z.literal('remove_empty'), from: z.string() }),
]);
export type FilingAction = z.infer<typeof FilingAction>;

export const FilingResult = z.object({
  actions: z.array(FilingAction),
  collisions: z.array(z.string()),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  suggestions: z
    .array(
      z.object({
        path: z.string(),
        to: z.string(),
        reasons: z.array(z.string()),
      }),
    )
    .optional(),
  executed: z.boolean(),
});
export type FilingResult = z.infer<typeof FilingResult>;

export const ReadingProgressResult = z.array(
  z.object({
    index: z.string(),
    title: z.string(),
    author: z.string().nullable(),
    stage: z.string(),
    steps: z.object({
      readOn: z.string().nullable(),
      notes: z.array(z.string()),
      chaptersComplete: z.number(),
      chaptersInProgress: z.number(),
      chapters: z.number(),
      concepts: z.array(z.string()),
    }),
    chapters: z
      .array(
        z.object({
          path: z.string(),
          title: z.string(),
          summary: z.boolean(),
          state: z.enum(['untouched', 'in_progress', 'complete']),
        }),
      )
      .optional()
      .default([]),
  }),
);
export type ReadingProgressResult = z.infer<typeof ReadingProgressResult>;

export const FindPassagesResult = z.array(
  z.object({
    note: z.string(),
    source: z.string(),
    title: z.string(),
    page: z.number().nullable(),
    score: z.number(),
    snippet: z.string(),
  }),
);
export type FindPassagesResult = z.infer<typeof FindPassagesResult>;

export const CreateConceptResult = z.object({
  path: z.string().nullable(),
  errors: z.array(z.string()),
  collisions: z.array(z.string()),
  passages: z.array(
    z.object({
      note: z.string(),
      quote: z.string(),
      pages: z.string().optional(),
      found: z.boolean(),
      problem: z.string().optional(),
    }),
  ),
  executed: z.boolean(),
});
export type CreateConceptResult = z.infer<typeof CreateConceptResult>;

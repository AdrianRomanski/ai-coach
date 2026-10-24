---
id: ADR-0006
title: 'Judge Tier 2 by blind claim extraction, and pass only flawless answers'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0002', 'ADR-0004', 'ADR-0007']
---

# ADR-0006: Judge Tier 2 by blind claim extraction, and pass only flawless answers

## Context

The judge has no notes, so it cannot compare an answer with a source. It can still test the reasoning inside the answer against what the challenge asks.

## Decision

1. For each `{ challenge, answer }` the judge returns:
   - `claims`: every atomic claim in the learner's meaning, typed `mechanism`, `assertion` or `definition`, with `supported`, `fallacies` from a fixed list of 12, and `handWave`;
   - `gaps`: what the challenge asks that the answer does not explain;
   - `verdict` and a one-sentence `reason`.
2. All items of a session go in one request with a JSON response schema, and come back in the same order; a wrong item count or unusable JSON is retried once.
3. **The judge's `pass` stands only if no claim has a fallacy or a hand-wave and no gap remains**; otherwise the verdict is `fail`. The judge's own verdict is kept as `modelVerdict`.
4. The gaps recorded with the Tier 2 session are the judge's gaps plus one line per flawed claim.
5. The judge is told to judge only the reasoning, never fill a gap for the learner, and use its own knowledge only to recognise false claims.

## Consequences

- The verdict rule is in the domain (`enforceVerdict`), not in the prompt alone.
- Because a pass has no gaps, gaps only ever lower the review ladder on a fail (ADR-0007).

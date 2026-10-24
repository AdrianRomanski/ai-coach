---
id: ADR-0016
title: 'Check each Tier 1 gap against the transcript before it stands'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0005', 'ADR-0014', 'ADR-0017']
---

# ADR-0016: Check each Tier 1 gap against the transcript before it stands

## Context

In the owner's first real session on the Introduction of Building a Second Brain, Tier 1 failed the round with four gaps, three of which the transcript contradicted: it said CODE was not defined after the learner spelled it out, and that highlighting was not explained after the learner explained it. Asked to conclude, the 4B model listed gaps from the focus, not from the answers. The gaps also spoke of "the learner" instead of to the learner.

## Decision

1. When Gemma concludes, each gap it lists goes through a separate check: one call per gap, at temperature 0, with the focus, the gap and the transcript but not the note, asking whether any answer already explains it, answered `yes` or `no`.
2. A gap the check answers `yes` to is dropped. An unclear reply keeps the gap.
3. **A `fail` whose every gap was dropped becomes a `pass`**: a failure Tier 1 cannot name is not one. The judge still has the final word (ADR-0006).
4. Gaps are written to the learner as "you", one short sentence each, and never list what the transcript already explains.
5. The shared Ollama plumbing (context guard, plain-text sentences, yes/no replies, JSON turns) moves into `OllamaClient`, used by the sparring partner and the study partner (ADR-0017).

## Consequences

- Replaying the owner's transcript three times gave one or two gaps each time, all about depth the answers did lack ("how highlighting and bolding change the information itself"), and none of the contradicted ones.
- A conclusion with gaps costs one short extra call per gap.
- Gaps already recorded before this change stay as they were.

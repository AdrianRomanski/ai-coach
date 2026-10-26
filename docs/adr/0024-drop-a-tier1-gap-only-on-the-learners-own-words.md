---
id: ADR-0024
title: "Drop a Tier 1 gap only when the learner's own words cover it"
status: proposed
date: 2026-10-25
supersedes: ['ADR-0016']
superseded_by: []
links: ['ADR-0005', 'ADR-0006', 'ADR-0014', 'ADR-0017', 'ADR-0019']
---

# ADR-0024: Drop a Tier 1 gap only when the learner's own words cover it

## Context

ADR-0016 dropped a gap whenever Gemma answered `yes` to "does any answer already explain this, even briefly or in other words?", and turned a `fail` into a `pass` once every gap was dropped. In the owner's first round on a distilled concept note (Distill, Building a Second Brain), Gemma concluded `fail`, the check dropped every gap, and the round passed with "Every gap the coach raised is covered by your answers". The answers were one line each: "it helps take the essence of text", "They help us separate the most important part of the text". The judge failed the same answers on four gaps, two of them hand-waves. A 4B model asked a loose yes/no question leans towards yes.

## Decision

1. When Gemma concludes, each gap it lists goes through a separate check: one call per gap, at temperature 0, with the gap and the transcript but not the note.
2. **The check replies in JSON: `covered`, and `evidence`, the learner's exact words that explain what the gap says is missing.** It is told that naming the topic is not enough: when the gap asks how or why, the answer must give that how or why.
3. **A gap is dropped only when `covered` is true and the evidence is at least three words the learner really wrote**, compared as words without case or punctuation (`saidIn` in the domain). An unusable reply, invented evidence or `covered: false` keeps the gap.
4. A `fail` whose every gap was dropped still becomes a `pass`, as in ADR-0016: a failure Tier 1 cannot name is not one. The judge still has the final word (ADR-0006).
5. Gaps are written to the learner as "you", one short sentence each, and never list what the transcript already explains.
6. The shared Ollama plumbing stays in `OllamaClient`; its JSON replies now take an optional temperature.

## Consequences

- Replaying the owner's transcript live on gemma3 4B, Tier 1 failed it in 3 of 3 runs, each time naming the gap the judge found: how bolding and highlighting relate. Under ADR-0016 the same answers passed.
- Tier 1 is now stricter than before, and noisier on good answers: with a complete answer added to the same transcript, the round passed in 2 of 6 runs. A missed pass costs a review the next day and an offer to study; the judge still decides the ladder.
- Asking for the evidence before the verdict was tried and did no better (1 of 6 weak rounds passed, 2 of 6 good ones).
- A conclusion with gaps still costs one short extra call per gap.
- This supersedes ADR-0016, whose other rules are restated here unchanged.

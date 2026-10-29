---
id: ADR-0027
title: 'Decide a concept round by checking each core assertion on a larger local model'
status: proposed
date: 2026-10-26
supersedes: []
superseded_by: []
links: ['ADR-0002', 'ADR-0005', 'ADR-0006', 'ADR-0014', 'ADR-0018', 'ADR-0024']
---

# ADR-0027: Decide a concept round by checking each core assertion on a larger local model

## Context

Under ADR-0024, gemma3 4B writes the gaps of a Tier 1 round and a second call checks each one against the learner's words. A stress test on the owner's Distillation note (six answer sets, 30 rounds each) left Tier 1 unbalanced: the owner's real weak answers got the right verdict in 20% of rounds, terse correct answers in 63%. Gemma words its gaps differently every round, and every prompt line that forgave short or informal answers made the 4B check call weak and wrong answers covered.

A concept note already holds fixed core assertions written from the learner's own words (ADR-0018, ADR-0023). Checking each assertion directly on gemma3 4B swung between all covered and none covered. On gemma3 12B, at temperature 0, the same check gave the right verdict for all six answer sets in every round, at about 3 s per assertion.

## Decision

1. **A new optional setting, `ollama.checkModel`** (env `OLLAMA_CHECK_MODEL`), names a second local model, reached through the same loopback-only Ollama host (ADR-0002). Without it, Tier 1 works as in ADR-0024.
2. **When it is set and the note has core assertions, the round is decided by them.** When Gemma concludes, each assertion goes through one call on the check model, at temperature 0, with the assertion and the transcript but not the note. The reply is JSON: `evidence` first, the learner's sentence closest to the point, copied unchanged; then `covered`.
3. **An assertion counts as covered only when `covered` is true and the evidence is at least three words the learner really wrote** (`saidIn`). An unusable reply counts as not covered.
4. **The verdict is `fail` when any assertion is not covered, else `pass`.** Each missed assertion becomes a gap, "You did not explain: <assertion>". Gemma's own gaps and verdict are not used; its feedback is kept. The domain rules after that are unchanged: buzzword gaps are added, the grounding filter runs (assertions are part of the reference, so they are grounded), and the judge still has the final word (ADR-0006).
5. Notes without assertions (book chapters) keep the ADR-0024 gap check on the main model.
6. The CLI prints a dim `thinking…` line before every coach turn, since a round's last turn now takes several seconds per assertion.

## Consequences

- On the stress-test note, the verdict was right for weak, partial, wrong, injection, complete and terse answers alike. The single assertions are still judged loosely: weak and wrong answers were held to `fail` by two of six assertions. A note whose assertions are all broad can still let a weak answer pass. Measured on one note only.
- Gaps now name the learner's own assertions word for word, so they are the same every round and study can locate them in the reference.
- The last turn of a round costs one call per assertion on a larger model: about 18 s for six assertions on gemma3 12B, against about 2.5 s for the 4B gap check.
- The check model needs its own download (8.2 GB for gemma3 12B) and memory next to the main model.
- Leaving `ollama.checkModel` out restores ADR-0024 behaviour, which makes it a safe switch to fall back on.

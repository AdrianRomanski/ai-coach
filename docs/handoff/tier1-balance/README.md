# Tier 1 balance: where we stopped (2026-10-25)

Handoff for the next session. Nothing below is committed.

## Where we are

The owner sparred the concept note `3.Resources/Concepts/Distilattion.md` (Building a Second Brain, Distill 1/3). Tier 1 passed one-line answers; the judge failed them on four gaps; study showed the same useless quote for every gap. Six fixes were made in the working tree:

| #   | Fix                                                                                                                                                     | Main files                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 2a  | Tier 1 drops a gap only when Gemma marks it covered **and** quotes at least 3 words the learner really wrote (`saidIn`)                                  | `adapter-ollama/.../ollama-sparring-partner.ts`, `prompts.ts` (`gapCheckMessages`), `domain/.../text.ts` |
| 2b  | The judge gets each item's sparring style and a hand-wave bar per style (`StyleGuide.judged`); styles stored in `pending-judgement.json`                  | `domain/.../coaching-style.ts`, `tier2-payload.ts`, `adapter-gemini/.../protocol.ts`, `sparring.ts`, `judging.ts`, `adapter-local-state` |
| 2c  | Distill always asks "Why does this idea matter…?" (`WHY_IT_MATTERS`), and the assertion prompt keeps the reason                                          | `domain/.../distill.ts`, `application/.../distilling.ts`, `prompts.ts`                                 |
| 3a  | Distill joins bold/highlight runs split line by line; a highlight inside a bold quotes the bolded sentence; quotes need 5+ words                          | `domain/.../distill.ts`                                                                               |
| 3b  | Study picks a stored quote only with 2+ shared words, else searches the source chapter, else shows nothing                                              | `domain/.../study-round.ts` (`bestQuote`), `application/.../studying.ts`, `history.ts` (`sources`)     |
| 3c  | Study never shows the same passage twice; passages shown without `**`/`==` marks                                                                         | same                                                                                                  |

ADRs written as `proposed`: 0024 (supersedes 0016), 0025 (supersedes 0021, amends 0019), 0026 (amends 0023, 0017). On commit: set them `accepted`, set 0016 and 0021 to `superseded` with `superseded_by`, update `docs/adr/README.md` statuses.

All 7 projects pass build, test, typecheck and lint. Not checked live: the judge with styles (2b), since that sends answers to Gemini.

Loose ends:

- The root `README.md` still says distill asks "up to two questions"; it has the owner's own uncommitted edits, so it was not touched. An early `nx format:write --uncommitted` may have reformatted it: check `git diff README.md`.
- `~/.local/state/ai-coach/pending-judgement.json.bak` holds the two orphaned sessions removed from the judge queue.
- The owner's `Distilattion` note keeps its fragment quotes; re-distill under a new title to get whole sentences. It is due again 2026-10-26.

## Stress test of the Tier 1 gap check

`bench.mjs` replays the owner's real dialogue (same four questions, `cornell`, the note's six assertions) with six answer sets, and runs the same Gemma conclusion through three checks:

- **old**: the yes/no check of ADR-0016;
- **single**: the new evidence check (2a);
- **vote**: up to three evidence checks, gap dropped on two "covered".

Stopped after 154 rounds (about 26 per answer set). Share of rounds with the **right verdict**:

| Answers                        | Should | old  | single | vote |
| ------------------------------ | ------ | ---- | ------ | ---- |
| weak (owner's real answers)    | fail   | 0%   | 31%    | 31%  |
| partial (no highlight-in-bold) | fail   | 19%  | 85%    | 81%  |
| wrong (reversed layers)        | fail   | 0%   | 65%    | 73%  |
| injection (fake grader note)   | fail   | 4%   | 50%    | 54%  |
| complete                       | pass   | 100% | 100%   | 100% |
| terse (correct, typos)         | pass   | 100% | 28%    | 20%  |

Gemma's own verdict was `fail` in 100% of rounds, for every answer set.

## Findings

1. **The old check passed almost everything.** The original bug is confirmed.
2. **The biggest remaining leak is not the check, it is the grounding filter.** `SparringConversation.answer` (`application/.../conversation.ts`) keeps only gaps for which `groundedIn(reference.text, gap)` holds: two weighted words shared with the note. Gemma words gaps generally, so the filter removed **every** gap in 44 of 154 rounds, and a `fail` with no gaps becomes a `pass` (`SparringRound.conclude`, ADR-0016 rule 3, kept in ADR-0024). Gaps it threw away were exactly the right ones:
   - "You did not explain the relationship between the layers."
   - "The transcript does not explain the purpose of highlighting."
   - "The transcript does not explain the purpose of bolding."
3. **The new check is too strict on short, informal, correct answers**: terse passed only 28%.
4. **Voting does not help**: same or worse than a single check, at up to 3x the calls. Drop the idea.
5. **Injection did not fool the evidence check**; it got through only by the empty-gap path of finding 2.
6. Gemma also writes gaps as "The transcript/learner/note does not…" instead of "You did not…", against the prompt.

## Next steps, in order

1. **A `fail` stays a `fail` when the grounding filter removed its gaps.** Only gaps removed by the evidence check may turn a fail into a pass. When the filter empties the list, keep the model's gaps (or the closest one) rather than recording a gapless fail. This narrows ADR-0024 rule 4, so update the ADR (it is still `proposed`).
2. **Make the evidence check tolerant of informal answers**: tell it that typos, short phrases and informal words count when the meaning is right.
3. Rerun the stress test with about 30 runs per set and compare against the table above. Target: weak, partial, wrong and injection fail at least 80%; complete and terse pass at least 80%.
4. Then the owner tests by hand, and we commit with the ADR status changes.

## Rerunning the stress test

Needs Ollama running with `gemma3:latest` and fresh builds (`npx nx run-many -t build`). About 14 s per round of six answer sets.

```sh
cd docs/handoff/tier1-balance
node bench.mjs runs-2.jsonl 30
node summary.mjs runs-2.jsonl
```

`bench.mjs` imports the built `dist` files by absolute path and copies the old ADR-0016 prompt inline for comparison. `runs.jsonl` holds the 154 rounds above, one JSON line each with the raw gaps, kept gaps, each check's result and Gemma's evidence.

## 2026-10-26 session

Committed and pushed yesterday's work as `2b2be4b` (ADRs still `proposed`). Then, uncommitted:

- **Step 1 done**: `closestGap` (domain) keeps the gap sharing most words with the note when the grounding filter would empty a `fail` (`SparringConversation.groundedGaps`). The evidence check runs first in `nextTurn`, so only it can turn a fail into a pass. Tested; ADR-0024 rule 4 updated.
- **Step 2 attempted**: every line telling the check to forgive short/informal/misspelled answers made Gemma call weak and wrong answers covered (weak 0-10%, wrong 3-10%). Final prompt instead passes the focus to the check and gives a generic list example ("steps: wash, rinse, dry"); no tolerance line. ADR-0024 rule 5 rewritten.
- README distill step now mentions the "why it matters" question.
- `bench.mjs` now matches production order (check every raw gap, then grounding filter, then `closestGap`) and runs only the single check.

Final run, `runs-5.jsonl` (30 per set), right verdict: weak 20%, partial 70%, wrong 100%, injection 57%, complete 100%, terse 63%. A 10-run sample of the same prompt (`runs-3.jsonl`) gave weak 60%, terse 50%: variance is high. `runs-2.jsonl` is the tolerance-line run, `runs-4.jsonl` the typos-only one.

Target (80/80) not met. Wording alone trades weak against terse on gemma3 4B; the next step needs a structural change, not another prompt line.

### Per-assertion check (prototype, reverted)

Committed today's step 1-2 work as `7e5e1ce`. Then prototyped a check of each core assertion against the transcript (one call each, temperature 0, so every run gives the same answer); `bench.mjs` still has the `assert` variant but `assertionCheckMessages` was removed from `prompts.ts`, so re-add it before rerunning.

- Plain "does an answer state this point?" with evidence: Gemma copied the assertion as evidence; nothing passed `saidIn`.
- Evidence first (closest learner sentence), then `covered`: every assertion covered for weak answers ("filtering out the most important parts" counted as "highlights portions of the bolded text"); terse missed one.
- Evidence, then `missing`, then `covered`: nothing covered, even for complete answers.

gemma3 4B swings between all-covered and none-covered on this judgement. Next idea: the same checks on a larger local model (e.g. `gemma3:12b`), not yet pulled.

### Built: per-assertion check on a check model (uncommitted, ADR-0027 proposed)

`ollama.checkModel` / `OLLAMA_CHECK_MODEL`; `OllamaSparringPartner(options, checkModel)`; `NextTurnRequest.assertions`; `assertionCheckMessages` in `prompts.ts`; CLI prints `thinking…` before each coach turn. Without `checkModel` the ADR-0024 gap check runs.

Real code path with `gemma3:12b`: Distillation note 6/6 right verdicts (13-22 s final turn); synthetic second fixture `fixture2.mjs` (spaced repetition, 5 assertions) 6/6 right (13-18 s). Single judgements still loose: in fixture2 the wrong set had "review right after learning, while easy" counted as covering "review just before you would forget", and the injection set had "cramming is bad" counted as covering the cramming assertion (the weak set, same words, did not).

Demo checklist: set `"checkModel": "gemma3:12b"` in `coach.config.json`; rehearse on the demo note; remove the key to fall back.

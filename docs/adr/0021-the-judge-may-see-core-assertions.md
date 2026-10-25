---
id: ADR-0021
title: 'Only the Tier 2 payload leaves the machine, and it may carry core assertions'
status: accepted
date: 2026-10-24
supersedes: ['ADR-0004']
superseded_by: []
links: ['ADR-0002', 'ADR-0005', 'ADR-0006', 'ADR-0010', 'ADR-0018']
---

# ADR-0021: Only the Tier 2 payload leaves the machine, and it may carry core assertions

## Context

ADR-0004 allowed only the challenge and the learner's answer to reach the judge. Without a reference, the judge's verdicts varied between runs. Concept notes now carry core assertions, the learner's own distillation of a published source (ADR-0018), and kb-template's `tier2_payload` can add them per call with `include_assertions: true` (its ADR-KI-0060, Decision 7). The owner chose to send them, with a switch to turn it off.

## Decision

1. **The only data sent to the judge is a `Tier2Payload`**: per item the challenge and the learner's answer, and, when the switch is on, the covered concept note's core assertions. No note body, title, path, `coach_id`, session id, verdict, gap, buzzword or quote is sent.
2. **The switch is `judge.includeAssertions` in `coach.config.json`, on by default.** With it off, the payload is exactly that of ADR-0004.
3. The domain enforces it: `tier2Payload()` accepts `coreAssertions` only when allowed for that call, as a list of strings, and rejects any other field, empty items and empty strings. The Gemini adapter re-checks every payload and is the only code that imports `@google/genai`.
4. The judge receives the assertions fenced as untrusted data next to the item, lists as a gap each assertion the answer does not explain or gets wrong, and passes only when every assertion is explained, under the verdict rule of ADR-0006.
5. Note bodies are untrusted data everywhere: Tier 1 fences notes, and Tier 2 fences challenges, answers and assertions, neutralising anything that looks like a closing tag.
6. Tier 1 is told not to quote or closely paraphrase a note, and every challenge and follow-up is checked against it (ADR-0005). Tier 1 makes no request beyond Ollama on loopback.

## Consequences

- With assertions, the judge grades against a fixed reference the learner wrote, which should remove most run-to-run variance.
- Core assertions leave the machine when the switch is on. They are the learner's distillation of a published book, not private notes, but they are the learner's words; a strict privacy demo turns the switch off.
- The limit stated in ADR-0004 still holds: a challenge is shaped by the note, and the judge sees it.
- This supersedes ADR-0004, whose other rules are restated here unchanged.

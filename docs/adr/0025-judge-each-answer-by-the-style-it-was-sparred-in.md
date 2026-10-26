---
id: ADR-0025
title: 'Judge each answer by the bar of the style it was sparred in'
status: proposed
date: 2026-10-25
supersedes: ['ADR-0021']
superseded_by: []
links: ['ADR-0002', 'ADR-0006', 'ADR-0007', 'ADR-0019']
---

# ADR-0025: Judge each answer by the bar of the style it was sparred in

## Context

Coaching styles (ADR-0019) set what Tier 1 asks for. `cornell` never asks for a mechanism and closes on "the author's point, restated correctly; no mechanism is needed". The judge did not know the style: its hand-wave rule was "names a result without the steps that produce it, or uses vague words in place of a mechanism", and one hand-wave fails an answer (ADR-0006). In the owner's first judged round, Tier 1 under `cornell` trained the learner to state the thesis, and the judge then failed them for missing mechanisms. The two tiers measured different things.

ADR-0021 allowed only the challenge, the answer and, when switched on, the core assertions to leave the machine.

## Decision

1. **The data sent to the judge is a `Tier2Payload`**: per item the challenge, the learner's answer, **the coaching style the note was sparred in**, and, when the switch is on, the concept note's core assertions. No note body, title, path, `coach_id`, session id, verdict, gap, buzzword or quote is sent.
2. **The style is recorded locally when a Tier 1 round is queued**: `pending-judgement.json` keeps a `styles` map from `coach_id` to style. Sessions queued before this change have none, and their items go without a style.
3. **Each style has its own hand-wave bar, defined in the domain** (`StyleGuide.judged`) and sent in the judge's instructions for every style. An item without a style is held to the mechanism bar, as before, and leaning on convention, magic or authority is a hand-wave in every style.
   - `feynman`: a result without the steps that produce it, or vague words in place of a mechanism;
   - `socratic`: a claim asserted without the reason it holds, or without saying when it stops holding;
   - `cornell`: the author's conclusion without the reason or evidence behind it, or vague words such as "essence" or "important" in place of what the author argues;
   - `devil`: a risk, cost or trade-off without the condition that causes it or what it costs.
4. The verdict rule of ADR-0006 is unchanged: a pass stands only if no claim has a fallacy or a hand-wave and no gap remains.
5. `judge.includeAssertions` in `coach.config.json` still switches the assertions, on by default. The domain's `tier2Payload()` accepts `style` only as one of the four known styles and rejects any other field, empty items and empty strings; the Gemini adapter re-checks every payload and is the only code that imports `@google/genai`.
6. The judge receives the style, the challenge, the answer and the assertions fenced as untrusted data, neutralising anything that looks like a closing tag. Tier 1 makes no request beyond Ollama on loopback.

## Consequences

- A `cornell` round is judged on whether the learner gives the author's reasons, not a mechanism the chapter never explains; a `feynman` round is judged as before.
- One word more leaves the machine per item: the style name, which says how the learner was questioned, not what their notes say.
- The judge's bar is no longer one fixed standard: the same answer can pass under `cornell` and fail under `feynman`. The style is shown in the dialogue header, so the learner knows which bar applies.
- The judge's adherence to the style bars was not checked against Gemini before this change was recorded.
- This supersedes ADR-0021, whose other rules are restated here unchanged, and amends ADR-0019: grading now follows the style in both tiers.

---
id: ADR-0018
title: 'Spar concept notes against their core assertions; raw material is reference only'
status: accepted
date: 2026-10-24
supersedes: ['ADR-0012']
superseded_by: []
links: ['ADR-0014', 'ADR-0016', 'ADR-0017', 'ADR-0019', 'ADR-0021']
---

# ADR-0018: Spar concept notes against their core assertions; raw material is reference only

## Context

Sparring book chapters (ADR-0012) went wrong in the owner's first sessions. Gemma knows Building a Second Brain from its training, followed the learner's mention of CODE, and recorded gaps about later chapters on the Introduction. Its grading also varied from run to run, because every check invented its own reference answer. Patching that inside chapters (grounding gaps in the chapter, searching the book for passages, asking Gemma to choose chapters) only partly worked.

kb-template then changed the unit of learning (its ADR-KI-0060 and ADR-KI-0061). Nothing under `3.Resources/0.Raw` can be sparred any more; `record_session` refuses it and `due_for_review` leaves it out. The sparred unit is a concept note: one idea the learner chose to keep, with `core_assertions` (one to six claims that define it), `forbidden_buzzwords`, and `source_passages` quoted verbatim from a raw chapter and checked on every read. Other notes outside `0.Raw` stay sparrable.

## Decision

1. **Raw material is never sparred.** `coach spar` refuses any raw note, chapter or index, before the dialogue starts, and `coach due` lists concept notes and the learner's other notes only, concept notes marked as such.
2. **A concept note is sparred against its core assertions.** They are the focus and the scope of the round, with no model call to guess either; the challenge is written from them. In the `feynman` style the concept's `forbidden_buzzwords` are banned for the round, on top of the usual buzzwords.
3. **A gap counts only when the reference explains it.** The reference is a concept's assertions, verified quotes and body, or the body of any other note. The domain decides with `groundedIn`: the best-matching passage must match at least two distinct words of the gap, weighted by rarity and stemmed. Ungrounded gaps are dropped.
4. **A fail must name a gap.** A `fail` left without gaps becomes a `pass`, with feedback saying every gap raised is covered; when the follow-ups run out while Gemma still wants to probe, the open follow-up is recorded as the gap.
5. **Study mode works from the concept.** Hints, clues and checks see the concept's reference; the passage shown on a miss or a request for help is the verified quote that best matches the gap, with its page; and an explanation is graded against the core assertions, not against a reference Gemma invents. A note without assertions keeps the generated reference and the passage lookup in its body.
6. **Private calls use a grader prompt**, not the sparring partner's: gap checks, scope lists, references, quotes and the style classifier. The Socratic prompt made Gemma refuse to state answers it needed to grade against.
7. **Sentences are typed.** A challenge or hint must be a question or an instruction such as "Explain…"; a focus, clue, nudge or reference must be a statement cut to its first sentence. Filler and echoes of the prompt are rejected.
8. The search across a book's chapters for out-of-chapter gaps, and Gemma choosing among chapters, are removed: concept notes carry their own sources.

## Consequences

- With no concept notes in the vault, there is nothing to spar until the learner distils one; `coach distill` is the planned way to create them with kb-template's `create_concept`.
- On a test concept, Progressive Summarization with three assertions and two quotes verified on pages 100 and 106, the opening and every follow-up stayed on its assertions.
- Lexical grounding can drop a real gap phrased in words the reference does not use; Tier 1 is then lenient and the judge still has the final word.
- This supersedes ADR-0012 and amends ADR-0014 (a concept's assertions replace the generated focus), ADR-0016 (the verdict rule moves into the domain) and ADR-0017 (study grades against assertions and shows verified quotes).

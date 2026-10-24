---
id: ADR-0018
title: 'Keep every round inside its chapter'
status: proposed
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0012', 'ADR-0014', 'ADR-0016', 'ADR-0017', 'ADR-0019']
---

# ADR-0018: Keep every round inside its chapter

## Context

The owner's round on the Introduction of Building a Second Brain (pages 5 to 8) drifted into the whole book. Gemma knows the book from its training, followed the learner's mention of CODE, and recorded gaps about CODE, Distill and highlighting, which the Introduction only names; Chapters 3, 5 and 6 teach them. Study mode inherited those gaps and showed passages that did not answer them. A yes/no question to Gemma, "does this note explain the gap?", answered yes too easily, and its scope lists came back as filler.

## Decision

1. **A Tier 1 gap counts only when the chapter itself explains it.** The domain decides with `groundedIn`: the best-matching passage of the note must match at least two distinct words of the gap, weighted by how rare each word is in the note (stemmed, every word counting equally for notes too short to weigh). Ungrounded gaps are dropped before the verdict.
2. **A fail must name a gap.** A `fail` left without gaps becomes a `pass`; when the follow-ups run out while Gemma still wants to probe, the open follow-up is recorded as the gap.
3. The opening also lists the chapter's key ideas (its scope), taken only from list items Gemma writes, never from filler or questions; follow-ups are told to stay inside them. Every style also carries a closed-world rule: test only what the note itself explains (ADR-0019).
4. **Private calls use a grader prompt, not the sparring partner's.** Gap checks, scope lists, references for grading, quotes and chapter choice run under a system prompt that says nothing is shown to the learner, because the Socratic prompt made Gemma refuse to state answers it needed to grade against.
5. **Sentences are typed.** A challenge or hint must be a question or an instruction such as "Explain…"; a focus, clue, nudge or reference must be a statement, cut to its first sentence. Filler ("Okay, let's…") and echoes of the prompt are rejected.
6. **In study, a gap the chapter does not explain is sent to the chapter that does.** The domain retrieves the three best passages across the other chapters of the same book; Gemma picks the one that explains the gap, seeing the passages themselves; with no match, it picks from chapter titles and the learner is told to reread that chapter. Hints, clues and grading then use that passage.

## Consequences

- On the owner's four recorded gaps, the Introduction grounds none of them, and study now sends each to another chapter; CODE goes to the CODE Method passage on page 38.
- Lexical grounding can miss a gap phrased in words the chapter does not use; such a gap is dropped, which makes Tier 1 more lenient, and the judge still has the final word.
- Choosing among passages across a book still sometimes picks a weaker one (the capture gap went to Distill, page 98, once).
- This amends ADR-0014 (the dialogue now also carries a scope), ADR-0016 (the verdict rule moves into the domain) and ADR-0017 (study can leave the chapter).

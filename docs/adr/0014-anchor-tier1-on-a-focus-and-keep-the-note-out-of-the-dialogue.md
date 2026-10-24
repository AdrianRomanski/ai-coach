---
id: ADR-0014
title: 'Anchor Tier 1 on a focus, and keep the note out of the challenge and the dialogue'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0004', 'ADR-0005', 'ADR-0012', 'ADR-0013']
---

# ADR-0014: Anchor Tier 1 on a focus, and keep the note out of the challenge and the dialogue

## Context

On real chapters of Building a Second Brain with `gemma3:latest`, the ADR-0005 prompts asked about side details: a quotation in chapter 1, Twyla Tharp's box in chapter 5, the author's illness. Follow-ups drifted to the same anecdotes, and a correct answer about PARA was failed for not discussing Tharp. Asking a 4B model for one-sentence answers inside JSON also broke: it copied the book's typographic quotes, closed strings with `”`, and ran on until the length cap, so one reply in six was unusable.

Each change below was measured on six chapters with a scratch harness, read-only against the real vault. The measurements are recorded in Consequences.

## Decision

1. **The opening names a focus before it asks anything.** A first call reads the note and returns one sentence that must begin "This note teaches that": the central claim, method or mechanism the title promises, as a general idea any reader can apply, never what one person did. It runs at temperature 0. Only its first sentence is kept; a reply that does not begin that way is asked again once, and then the focus falls back to the note's title.
2. **The challenge is written from the focus alone.** A second call sees the focus but not the note, and returns one question of at most 30 words that names the method or term the focus names.
3. **Each dialogue turn sees the focus and the transcript, not the note**, and judges the learner against the focus. Follow-ups and gaps may not name a person, story or example from the note; feedback is one sentence addressed to the learner.
4. **The focus is carried through the round**: the sparring-partner port's `openingChallenge` returns `{ focus, challenge }`, and every `nextTurn` request carries the focus. It stays on the machine; it is not recorded and not part of the Tier 2 payload.
5. **One-sentence replies are plain text, not JSON**, capped at 120 tokens; the first line that is a sentence of three or more words, with tags, labels and quotes stripped, is taken. Dialogue turns stay JSON, with every string capped in the schema.
6. The note is cleaned before it reaches the model: wikilinks and markdown links become plain text, and typographic double quotes become plain ones. Temperature is 0.3 except for the focus.

## Consequences

- Measured on six chapters. Before: two of six openings were about anecdotes or a quotation, one was unusable JSON. After: all six openings were on the chapter's idea or a title fallback, none named a person or story, and the longest phrase copied from the note fell from up to 5 words to at most 3. Follow-ups that had asked what Tharp did now asked about the idea.
- The challenge that reaches the judge is now written without the note, so it carries less of the note than before. This narrows the limit stated in ADR-0004; it does not remove it, because the focus is derived from the note.
- Tier 1 can no longer catch an answer that contradicts a specific detail of the note, only one that fails to explain the focus. Tier 2 never saw the note either, so neither tier checks details.
- The first part of a chapter split by kb-template can be mostly an anecdote (ADR-0012); its focus is then the idea that anecdote illustrates, or the title fallback.
- Tier 1 remains strict: a good answer can still fail when no follow-ups are left, and the judge has the final say.
- Opening a round now takes two model calls, about 2 to 8 seconds on the first book's chapters.

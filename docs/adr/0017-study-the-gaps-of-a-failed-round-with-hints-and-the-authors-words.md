---
id: ADR-0017
title: "Study the gaps of a failed round with hints and the author's own words"
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0004', 'ADR-0005', 'ADR-0009', 'ADR-0012', 'ADR-0016']
---

# ADR-0017: Study the gaps of a failed round with hints and the author's own words

## Context

After a failed round the coach only listed gaps; the learner had to work out how to close them alone. The owner asked for a learning step. The talk argues against tools that hand out summaries, so the coach should help the learner rebuild the idea, not explain it for them.

## Decision

1. **`coach study <path or coach_id>` works through the gaps of a chapter's latest session**, when that session failed with gaps, from either tier; the gaps are read from the vault's history. It is also offered after a recorded `spar` or `judge` for every note that failed. A book's index is refused.
2. **For each gap: a guiding question first.** Gemma reads the note and the gap and asks one question that points toward what is missing without stating it.
3. **The learner explains it back, and a check judges only the gap's own point**: a yes/no call with the note, where short or informal answers count and nothing beyond the gap is asked for. A miss gets a one-sentence nudge written without the note, so it cannot teach the answer.
4. **On the first miss, the coach shows the passage to reread, in the author's words and with its page.** Gemma names the sentence it would point to, but the domain finds the passage: the text that sentence really comes from, or else the passage that best matches the gap, weighting words by how rare they are in the chapter and requiring at least two distinct matches. Text before the first page heading is never quoted. When nothing matches well, the coach says to reread the chapter instead of quoting something irrelevant.
5. **Gemma never explains the answer.** Each gap gets two attempts; then it is marked still open and the session moves on. `/skip` leaves a gap open, `/quit` stops.
6. Buzzwords in an explanation send it back, as in sparring.
7. **At the end, the learner's explanations can be kept as a note in `0.Inbox`**, titled "<chapter> - in my words", linking the chapter, one section per gap, with open gaps marked. It is written with `capture` after a preview and only on the learner's yes.
8. **Studying records no session and does not change mastery or the review date.** The next `spar` is the test.
9. Everything runs on local Gemma; nothing from study mode leaves the machine. Showing the learner their own book's text locally is outside the rule of ADR-0004, which governs what reaches the judge.

## Consequences

- On real chapters the passage lookup found the pages that discuss a gap (the PARA definitions on page 75, the highlighting layers on pages 98 to 116) and returned nothing for a chapter that does not cover it.
- With reasonable explanations the check closed every gap of the owner's first session; before the check was told to judge only the gap's point, it closed none.
- Hints can still misread a gap, for example taking "CODE" as programming when the gap is vague.
- The domain gains `StudyRound`, `locatePassage` and `quotedPassage`; the application gains `Studying` and the `StudyPartner` port; the Ollama adapter gains `OllamaStudyPartner`.

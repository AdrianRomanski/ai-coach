---
id: ADR-0019
title: 'Coach in one of four styles, chosen per note'
status: proposed
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0005', 'ADR-0014', 'ADR-0017', 'ADR-0018']
---

# ADR-0019: Coach in one of four styles, chosen per note

## Context

Tier 1 asked every note for its mechanism: "explain how and why it works". On a book's introduction, which argues rather than explains a mechanism, that turned into "you described the effect, not how it works" on every sensible answer. Different notes call for different questioning, and showing those styles side by side strengthens the talk.

## Decision

1. **Four coaching styles**, each with its own rules, opening stance, probing stance and bar for a closed gap, defined in the domain:
   - `feynman`: plain words for a newcomer, the steps in order, an analogy where it helps; the note's three most technical terms are banned for the round, on top of the usual buzzwords.
   - `socratic`: never "what is X"; commit to a claim, then test it against a counter-example or edge case.
   - `cornell`: the author's thesis, the problem it answers, the argument or evidence and the takeaway; never a low-level mechanism.
   - `devil`: a skeptical principal engineer; failure modes, trade-offs, hidden costs and recovery.
2. All four share one question per turn, no answers or summaries, the closed-world rule (ADR-0018), and "ask for a mechanism only when the note explains one".
3. **The style comes from, in order:** `--style` on `coach spar` or `coach study`; a `style:` key in the note's frontmatter; `sparring.style` in `coach.config.json`; otherwise Gemma classifies the note once, as an overview or argument (`cornell`) or a technical explanation (`feynman`), with `cornell` when the answer is unclear.
4. **Grading stays with Gemma but follows the style's bar**: the verdict, the private reference, the comparison and the nudge all state what counts as closed in that style. This was the owner's choice over self-grading and over a larger grading model.
5. The default built-in Socratic rules of ADR-0005 are replaced by the style rules; `sparring.socraticRules` remains for extra rules of the owner's own.
6. The dialogue header shows the style in use.

## Consequences

- On the Introduction, the four styles opened with four different questions, all inside the chapter: the author's main assertion (`cornell`), a plain-words explanation with PKM, Zettelkasten and Memex banned (`feynman`), a committed claim (`socratic`), and obsolescence (`devil`).
- The classifier chose `cornell` for every chapter of Building a Second Brain tried.
- A 4B model does not always keep to a style; a `cornell` nudge still occasionally asks "how".
- Grading remains noisy on borderline answers, as recorded in ADR-0017.

---
id: ADR-0026
title: 'Quote whole marked sentences, ask why an idea matters, and never repeat a study quote'
status: proposed
date: 2026-10-25
supersedes: []
superseded_by: []
links: ['ADR-0017', 'ADR-0018', 'ADR-0023']
---

# ADR-0026: Quote whole marked sentences, ask why an idea matters, and never repeat a study quote

## Context

kb-template converts a PDF line by line, and a bold sentence comes out as one `**…**` per line. Distill kept each line as its own mark, so the owner's first concept note stored nine quotes such as "second layer of", "distillation" and one sentence cut into four pieces. In study, every quote scored zero against every gap, because the passage scorer needs two matching words, and the ranking then fell back to the first quote: the learner saw "main points of a note" for all four gaps. ADR-0017 says the coach should send the learner back to the chapter rather than quote something irrelevant.

The same note's core assertions said only what the learner does (bold, then highlight, then summarise) and never why, because distill drafts them from the learner's summary and answers (ADR-0023) and nothing asked why. The judge then failed every "why" claim.

## Decision

1. **Distill joins a mark that the converter split line by line.** A bold that closes at the end of a line and reopens at the start of the next is one bold; the same for highlights. A word hyphenated across the line break is joined.
2. **A highlight inside a bold quotes the bolded sentence around it.** Passages are the idea's highlights first, each as its surrounding bold when it has one, then its other bolds. A quote needs at least five words and twelve characters, and a quote already contained in a kept one is skipped.
3. **Distill always asks why the idea matters**, after Gemma's gap questions: "Why does this idea matter: what problem does it solve, or what goes wrong without it?" The learner may answer or `/skip`. The assertion prompt keeps a reason the learner gives as an assertion of its own.
4. **Study picks a concept note's quote by the words it shares with the gap, at least two.** When no stored quote shares two words, it looks in the chapters those quotes come from with the passage scorer of ADR-0017. When nothing fits, it shows no quote.
5. **Study never shows the same quote or passage twice in one session.**
6. Passages of the book are shown without their bold or highlight marks.

## Consequences

- On the owner's chapter, the marks went from 52 line fragments to 27 marks, and the note's quotes became nine whole sentences, among them "Each of these layers uses a different kind of formatting so you can easily tell them apart."
- Replaying the owner's four study gaps against that chapter gave eight different passages over two tries each, one of them the "future self can instantly grasp" passage the open gaps were about.
- Distilling an idea takes one more question.
- Concept notes written before this change keep their fragment quotes; study still finds the chapter through them.
- This amends ADR-0023 (rules 4 and 7) and ADR-0017 (rule 4: the passage of a concept note).

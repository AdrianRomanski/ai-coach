---
id: ADR-0023
title: "Distill concept notes from the learner's own words, with the local model as helper"
status: accepted
date: 2026-10-25
supersedes: []
superseded_by: []
links: ['ADR-0003', 'ADR-0009', 'ADR-0014', 'ADR-0018', 'ADR-0021']
---

# ADR-0023: Distill concept notes from the learner's own words, with the local model as helper

## Context

Concept notes are the sparred unit (ADR-0018), and kb-template's `create_concept` writes one from a title, a summary, 1-6 core assertions, up to 5 banned buzzwords and 1-12 verbatim passages from a raw note. Writing those by hand in Obsidian is slow, so concept notes were rare. The learner already leaves the material for them while reading: bolds (`**…**`, `__…__`), highlights (`==…==`) and summary callouts in converted chapters, and reading notes that link the book. `reading_progress` lists, per book, its chapters' state and those reading notes; `find_passages` finds where a note's idea sits in the book.

The core assertions are what the judge grades against (ADR-0021), so whoever writes them decides what passing means.

## Decision

1. `coach distill [book]` turns a book's marks and reading notes into concept notes, one idea at a time. Without a book it lists the converted books from `reading_progress`.
2. The material is gathered offline: the summaries, highlights and bolds of every chapter that is not untouched, with their pages, and an excerpt of each reading note. The domain parses the marks (`extractMarks`); untouched chapters are not read.
3. The local model groups the numbered material into at most six ideas, each pointing at item numbers; the learner picks the ideas to distill and may rename each. Without a usable reply, the ideas fall back to one per chapter.
4. Per idea, the learner writes the summary in their own words first. The model then asks at most two questions about what the marked material says and the summary leaves out; the learner may answer or `/skip`.
5. The model drafts at most six core assertions **only from the learner's summary and answers**, never from the book. The learner keeps, drops or rewrites each one and may add more. Without a usable reply, the learner writes them.
6. The model suggests at most five buzzwords from the material; the learner keeps them, gives a list, or none.
7. Passages are the idea's highlights first, then bolds of at least 12 characters, verbatim from the chapter. An idea with only notes or summaries is looked up with `find_passages` inside the book's folder, and the longest whole sentence of each snippet is offered. An idea with no passage is not written.
8. The domain checks the draft against the limits `create_concept` enforces (`conceptDraft`) before calling the vault. The preview shows each passage's check by the vault; nothing is written until the learner confirms (ADR-0009), and a collision writes nothing.
9. All model calls use the private grader prompt (ADR-0014) with the material fenced as untrusted data; everything stays on the machine.

## Alternatives

- **The model drafts assertions from the book.** Faster, but the judge would then grade the learner against the model's reading, not theirs.
- **The model picks the ideas alone.** Fewer questions, but the learner would spar ideas they did not choose to keep.
- **No gap questions.** Shorter, but a thin summary yields thin assertions, and sparring would then pass on a thin explanation.

## Consequences

- Concept notes come from what the learner marked and wrote, so sparring and judging check the learner's own understanding.
- Distilling needs marks or reading notes first: an unmarked book yields nothing.
- A quote taken from a `find_passages` snippet may be cut short by the snippet; the vault's check still refuses one that is not verbatim.
- Choosing a folder other than `3.Resources/Concepts` still needs Obsidian or `coach file` afterwards.

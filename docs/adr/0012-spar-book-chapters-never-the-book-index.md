---
id: ADR-0012
title: 'Spar book chapters, never the book index'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0003', 'ADR-0005', 'ADR-0013']
---

# ADR-0012: Spar book chapters, never the book index

## Context

kb-template now keeps raw resources under `3.Resources/0.Raw/<kind>/<author>/<work>/` (its ADR-KI-0059). A converted book is split into chapter notes, `<work>/chapters/NN <title>.md`, with long chapters in parts of at most 20,000 characters. Each chapter note has `raw_role: "chapter"` and `book`, `part`, `chapter`, `section` and `pages` in its frontmatter, and its own `coach_id` and schedule. The book's `text.md` is its index (`raw_role: "index"`): `record_session` refuses it and `due_for_review` omits it. `read_note` returns `rawRole`. The first book, Building a Second Brain, has 27 units.

Before this, ai-coach would have offered a whole book as one note and sent all of it to Gemma, and `coach spar text.md` would have run a full dialogue only to have the recording refused at the end.

## Decision

1. **The unit of sparring for a book is a chapter note.** Chapters are sparred, scheduled and judged like any other Resources note; nothing in the use cases special-cases them.
2. **A book's index is refused before the dialogue starts**: `Sparring.open` throws `NotSparrableError` for a note with `rawRole: "index"`, so Gemma is never asked about it.
3. The vault port carries `rawRole` and, for chapters, `chapter: { book, part, chapter, section, pages }`, read from the note's frontmatter by the MCP adapter.
4. The dialogue header names the book, part and pages for a chapter instead of the folder.
5. ai-coach does not split books itself; the split belongs to kb-template.

## Consequences

- `coach due` lists each chapter on its own; a 27-unit book adds 27 lines.
- Mastery and the review ladder are per chapter, so a book is learned chapter by chapter.
- A chapter part can be 20,000 characters, which needs Gemma's context window set explicitly (ADR-0013).
- On the first real chapter, Gemma asked about a side anecdote rather than the chapter's core idea; the Tier 1 prompts need tuning for chapters (ADR-0005).

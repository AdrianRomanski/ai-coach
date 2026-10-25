---
id: ADR-0022
title: 'Ask which knowledge notes to keep before archiving a project'
status: accepted
date: 2026-10-25
supersedes: []
superseded_by: []
links: ['ADR-0003', 'ADR-0009', 'ADR-0018']
---

# ADR-0022: Ask which knowledge notes to keep before archiving a project

## Context

`coach archive` moved a project folder whole into `4.Archive`. A concept note or a note with sparring history inside it would then leave `3.Resources` and stop being sparrable (ADR-0018). kb-template's `archive_project` now lists suggestions in its preview: notes that look worth keeping (a concept note, sparring history, a note citing raw material, or one linked from outside the project), each with a target folder under `3.Resources` and the reasons, and it takes `keep` to move those notes there first.

## Decision

1. Before the archive preview, `coach archive` lists the suggested notes, each with the folder it would go to and why.
2. The learner chooses which to keep: numbers, Enter for all of them, or `none`. The chosen notes go to their suggested folders.
3. The preview then shows the full plan, the kept notes moving into Resources and the rest of the project into the archive, and nothing moves until the learner confirms (ADR-0009).
4. The filing port carries the suggestions and the `keep` list; the MCP adapter passes `keep` to `archive_project`.

## Alternatives

- **Archive the project whole, as before.** Simplest, but concept notes and sparred notes leave `3.Resources` and can no longer be sparred.
- **Keep every suggestion automatically** with `keep_suggested: true`. No extra question, but kb-template's guesses decide what stays.
- **Show the suggestions and ask**, chosen by the owner on 2026-10-25: one extra question, and the learner decides, as everywhere else in the CLI.

## Consequences

- Archiving a finished project no longer buries the concepts and sparred notes made during it.
- Choosing a different target folder than the suggested one still needs Obsidian or `coach file` afterwards.

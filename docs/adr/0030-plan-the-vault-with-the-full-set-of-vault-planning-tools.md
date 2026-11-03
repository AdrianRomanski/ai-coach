---
id: ADR-0030
title: 'Plan the vault with the full set of vault planning tools, and pass every preview back on execute'
status: proposed
date: 2026-11-02
supersedes: ['ADR-0029']
superseded_by: []
links: ['ADR-0003', 'ADR-0009', 'ADR-0001', 'ADR-0029']
---

# ADR-0030: Plan the vault with the full set of vault planning tools, and pass every preview back on execute

## Context

ADR-0029 made planning a set of Claude Code skills that reach the vault only through kb-template's vault server (ADR-0003). The server could not add a task to an existing note, change a task or goal, edit frontmatter or prose, plan several days at once, or report a task's `🔁` rule, so the skills turned those changes into hand edits the user made in Obsidian. ADR-0029 listed them as requests for kb-template.

kb-template built them on 2026-11-02 (its ADR-KI-0064): `add_tasks`, `update_task`, `plan_days`, `set_frontmatter`, `edit_note` and `create_workstream`; richer `plan_period` goals and ad-hoc tasks (priority, recurrence, `🆔`, `⛔`, several links); and `planning_overview` with `scope: "period"`, an `overdue` list, and each task's `line`, `blockId`, `id`, `blockedBy` and `recurrence`. Every planning write now returns `versions`, a hash of each note it changes; passed back with `execute: true`, a note changed since its preview is refused. Without them the write runs unchecked, except `update_task` by `line`, which refuses. The server refuses to tick or cancel a repeating task, because the Tasks plugin writes the next occurrence only when the habit is ticked in Obsidian.

## Decision

1. **ADR-0029 Decisions 1, 2, 5 and 6 stand:** planning is the skills in `.claude/skills/`, they reach the vault only through the `life-vault` tools, every write previews first, and the user's rules live in `vault-planning/rules.md`.
2. **A task is written into its owner's note** with `add_tasks`, including habits, subtasks, dependencies and priority. A plan's ad-hoc lines hold only tasks no note owns. A task note (`capture` + `file_note`) is kept for a large batch with a purpose of its own.
3. **Existing lines are changed where they stand** with `update_task`: rescheduling, resizing, ticking, cancelling, a goal's parent, dependencies. A task is addressed by `blockId` when it has one, otherwise by the `line` `planning_overview` reports, otherwise by a unique part of its text.
4. **Frontmatter goes through `set_frontmatter`, prose and reviews through `edit_note`, new workstreams through `create_workstream`, and several days through one `plan_days` call.** A goal's second link is a `links` entry, not text.
5. **Every execute passes back the `versions` its preview returned.** A refusal is answered by previewing again and showing the user what changed. A call that addresses tasks by line runs before calls that add lines to the same note.
6. **Days and weeks are read with `scope: "period"`.** The full overview is read only when the skill needs the projects, areas or unscheduled work.
7. **Habits are ticked in Obsidian, never by a tool**, and a stray note is deleted by the user. These and moving a task line between notes are the only hand edits left.
8. **The first line written with `🆔`, `⛔`, a priority or `🔁` in a session is checked by the user** in a Tasks query, because the signifier order the server writes is assumed, not tested against the plugin version in the vault (ADR-KI-0064).

## Consequences

- Tasks added by the coach show when the user opens their workstream, and planning leaves almost no hand edits behind.
- A day or week is read in one small call instead of the vault's every open task.
- Edits the user makes in Obsidian between a preview and its execute are no longer overwritten, as long as the skills pass `versions` back. Skills must keep each preview's `versions`; a batch that touches one note twice must execute in order and preview the later call again.
- The skills depend on six more tool names and shapes. The `life-vault` server must run a build of kb-template from 2026-11-02 or later; the skills tell the user to rebuild and restart it when the tools are missing.
- The tools can now remove prose (`edit_note`) and end a habit (`update_task` with `recurrence: null`). The preview, the user's yes and the version check are the only guards.
- No ai-coach code changes; the `coach` CLI still calls no planning tool.

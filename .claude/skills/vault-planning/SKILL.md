---
name: vault-planning
description: Shared rules for planning in the user's Obsidian life vault through the life-vault MCP server. Covers the planning model (projects, workstreams, areas, goals, tasks, Plans/), every planning tool and its traps, the preview-and-versions rule, and the user's scheduling rules. Use for any general planning question ("what should I work on", "how is my week looking", "help me plan"), and read it before running plan-day, plan-week, plan-month, plan-quarter, plan-year, add-task, set-goal, organize-projects or review-period.
allowed-tools: mcp__life-vault__planning_overview, mcp__life-vault__review_period, mcp__life-vault__read_note, mcp__life-vault__list_notes, mcp__life-vault__search
---

# Planning in the life vault

The vault is the user's Obsidian vault, reached only through the `life-vault` MCP server (ADR-0003, ADR-0029). Never read or write vault files with the file tools or the shell, not even to look.

Before anything else, read the three reference files beside this one:

- `conventions.md`: the planning model and how a good line looks.
- `tools.md`: every tool, what it can and cannot do, and the hand-edit fallback.
- `rules.md`: the user's own scheduling rules. They win over any general advice.

## Which skill does what

| The user wants to                                            | Skill               |
| ------------------------------------------------------------ | ------------------- |
| plan or run today, move today's tasks, close the day         | `plan-day`          |
| close last week and plan this one                            | `plan-week`         |
| close last month and set this month's goals                  | `plan-month`        |
| close a quarter and set the next one's goals                 | `plan-quarter`      |
| review last year and set this year's goals                   | `plan-year`         |
| add one or more tasks, habits, or dependencies               | `add-task`          |
| set a goal, or connect goals into a chain                    | `set-goal`          |
| create a project, workstream or area, or finish a workstream | `organize-projects` |
| look back at any period without changing anything            | `review-period`     |

When the request spans several, run them in order from the largest period down: a year before its quarter, a quarter before its month, a month before its week, a week before its day.

## Rules that hold everywhere

1. **Read first.** Start with `planning_overview` (with `period` when one is in play, and `scope: "period"` for a day or a week). Never plan from memory: the vault changes between sessions.
2. **Preview, show, confirm, execute with versions.** Every write tool runs once without `execute`, the preview is shown to the user in plain form (which lines change, in which notes, which files are created), and it runs with `execute: true` and the preview's `versions` only after the user says yes. A batch of previews shown together may be confirmed once. If a write is refused because a note changed since the preview, preview again and show what changed.
3. **Write where the work lives.** A task goes into its owner's note (`add_tasks`), a change to a task or goal is made on its line (`update_task`), a status or deadline in frontmatter (`set_frontmatter`), prose and reviews in the note's body (`edit_note`). Ad-hoc plan lines are for tasks no note owns.
4. **Never pretend a tool did something it cannot do.** Repeating `🔁` tasks are ticked in Obsidian, and the few changes no tool makes are hand edits (see `tools.md`), theirs to make.
5. **Give load as information, never as pushback.** Show size points per day when it helps, but never refuse, warn, or suggest cutting work because a day is heavy. Some days are meant to hold more. Only talk about trimming when the user asks.
6. **Speak about the user's real work.** Use the names of their projects, workstreams, areas and people as the vault writes them.
7. **Dates.** Weeks are ISO weeks, Monday to Sunday (`2026-W45` is 2026-11-02 to 2026-11-08). Take today's date from the environment, and let the tools' `period.start` and `period.end` settle the bounds of a period.

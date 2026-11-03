---
id: ADR-0031
title: 'Plan habits as definitions checked off per day, never carried over'
status: proposed
date: 2026-11-02
supersedes: []
superseded_by: []
links: ['ADR-0030', 'ADR-0029', 'ADR-0003']
---

# ADR-0031: Plan habits as definitions checked off per day, never carried over

## Context

ADR-0030 has the planning skills write a habit as a repeating Tasks line in its owner's note (`- [ ] Up at 6:00 🔁 every day ⏳ <date>`), ticked only in Obsidian. On 2026-11-02 the user found their morning and evening routines carried from day to day. A habit line not ticked on its day stays open with its old date. The day plan's query (`scheduled on or before <day>`) lists it again every following day, and Tasks writes no occurrence for the next day until the old one is ticked. Two open occurrences of one evening habit sat in the same note.

The user asked for a habit concept in which a day not kept is missed, not carried over. They chose to define each habit once and check it off per day. kb-template built this on 2026-11-02 (its ADR-KI-0065):

- a habit is a plain list item `- <text> 🔁 <rule>` under `## Habits` in its owner's note;
- each day plan has a `## Habits` section that `plan_period` and `plan_days` fill with that day's checks;
- an open check is never overdue and never rolled over;
- `review_period` counts each habit's due, ticked and missed days and its streak;
- `planning_overview` lists habits, and for a day its due habits and checks;
- a new tool, `add_habits`, writes the definitions.

## Decision

1. **A habit is a routine that is kept or missed on a day; it is defined with `add_habits`, not `add_tasks`.** Personal habits go in a workstream of the habit project that `vault-planning/rules.md` names. Rules are `every day`, `every weekday`, `every weekend` or `every week on <days>`. A habit is changed or ended with `edit_note` on its definition line. This replaces "including habits" in ADR-0030 Decision 2.
2. **`🔁` on a task line is kept for repeating work that must still get done after a missed day**, such as a cleaning cycle. ADR-0030 Decision 7 now applies to those lines only: they are ticked in Obsidian.
3. **Every `plan-day` morning run, and every `plan-week` layout, writes the day's habit checks** through `plan_days`, and shows the checks added in the preview. An open check is a missed day: closing a day names it and moves nothing.
4. **Habit checks are ticked in Obsidian or with `update_task` on the day plan.**
5. **Week and month planning read `review_period`'s `habits`** to judge habit goals such as "Gym 4 times" against the days actually kept. Gym, whose days the user picks each week, stays as tasks.
6. **The user's existing `🔁` routines are moved to definitions once**, with `add_habits`. Their old lines are cancelled or deleted by the user.

## Consequences

- A missed morning no longer reappears the next day, and each day starts with its own checks.
- A day plan created by Obsidian from its template shows no habit checks until `plan-day` or `plan-week` runs for it.
- The skills depend on `add_habits` and the habit fields of `planning_overview`, `plan_period`, `plan_days` and `review_period`. The `life-vault` server must run a kb-template build that has ADR-KI-0065.
- The skill docs (`vault-planning` conventions, tools and rules, `plan-day`, `plan-week`, `add-task`, `review-period`) describe habits apart from tasks.
- No ai-coach code changes.

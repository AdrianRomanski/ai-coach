---
name: review-period
description: Look back at a day, week, month, quarter or year in the life vault - where the effort went per project, workstream and area, which goals were met, missed or dropped down the chain, what slipped and what keeps slipping. Use when the user asks "how did my week go", "review October", "where did my time go", "what keeps slipping", or "am I on track for the conference". Changes nothing, except writing the review into the plan when the user asks.
argument-hint: '[YYYY | YYYY-Qn | YYYY-MM | YYYY-Www | YYYY-MM-DD]'
allowed-tools: mcp__life-vault__planning_overview, mcp__life-vault__review_period, mcp__life-vault__read_note, mcp__life-vault__list_notes, mcp__life-vault__search
---

# Review a period

First read `.claude/skills/vault-planning/SKILL.md` and the three files beside it. This skill only reads, apart from the optional review text in step 4. Closing a period (rolling it over) belongs to the period's planning skill.

## 1. Read

`review_period {period, today}` with today's date. For a period still running, say so: open goals are "open", not "missed", and effort is so far.

If the question is "am I on track", also call `planning_overview` with the period for the open tasks still scheduled in it.

## 2. Show

In this order, short:

1. **Goals**: each with met, open, missed or dropped, its owner's effort, and its child goals' results one level down. Then a one-line count.
2. **Effort**: points per project (and its workstreams), per area, and unlinked, each with its share of the total. Name the largest share, and any goal whose owner got little or no effort.
3. **Slips**: what slipped out of the period, and every item that has slipped twice or more, with its slip tags.
4. **Habits**: each habit's ticked days of its due days (`done`/`due`), missed days and current streak, from `habits`. Plain counts, no judgement; a habit goal is set against them.
5. **Data quality**: how many done tasks had no size (their weight counts as 1, so the effort is undercounted), and unlinked items.

Effort is size-weighted done tasks, an estimate, not hours. Say so once if the user reads it as time.

## 3. Make sense of it

Offer two or three observations, each tied to a number above:

- the gap between where the goals pointed and where the effort went;
- what repeated slips have in common (same owner, same kind of task, waiting on someone);
- what's at risk: an open goal with little time left and much work open.

Then **ask** what the user makes of it. Don't prescribe a fix unless asked; if asked, point to the skill that makes the change (`plan-week`, `add-task`, `set-goal`).

## 4. Keep it

Offer to write the conclusions, 3–6 lines in the user's words, into the plan's `## Review` section (day plans have `## Log` instead) with `edit_note {note, heading, content, mode: "replace"}` (`"append"` for a day's log). This is the only write this skill makes, and only when the user says yes: preview, show, then execute with its `versions`.

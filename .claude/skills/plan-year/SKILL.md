---
name: plan-year
description: Yearly review and plan in the life vault. Reviews the past year's goals (keep, drop or rewrite each, since a year never rolls over), looks at every area for what should be different in a year, and sets 3-7 year goals that the quarters will serve. Use when the user says "plan the year", "yearly review", "plan 2027", "set my goals for the year", or wants a top for the goal chain.
argument-hint: '[YYYY | this | next]'
allowed-tools: mcp__life-vault__planning_overview, mcp__life-vault__review_period, mcp__life-vault__read_note, mcp__life-vault__list_notes, mcp__life-vault__search
---

# Plan a year

First read `.claude/skills/vault-planning/SKILL.md` and the three files beside it.

The year is the top of the goal chain: every quarter goal links one of its goals. Keep it short. A year plan with 3–7 goals the user remembers beats twenty they don't.

## 1. Review the past year

Skip if there was no plan for it.

1. `review_period` for the year with `today`. Show each year goal with its quarter goals down the chain, effort per project and area over the year, and the projects that took the most effort with no year goal behind them.
2. A year never rolls over. For **each open year goal**, **ask**: carry it into the new year as it is, rewrite it, or drop it. Carried and rewritten goals become new goals in step 4; dropped ones get `update_task` `state: "cancelled"`.
3. **Ask** for the user's own one-paragraph verdict on the year, and offer to write it into the year's plan with `edit_note {heading: "Review", content, mode: "replace"}`.

## 2. Look at every area

Go through the areas from `planning_overview` and the active projects. For each, **ask** one question: what should be different a year from now? Many areas will have no answer, and that's fine: an area without a year goal is kept up, not improved.

Areas with no description (`read_note` shows only a title) are worth a one-line purpose. Offer to write it with `edit_note` (an exact edit after the title).

## 3. Projects for the year

- Projects with a deadline inside the year: their `done_when` is a natural year goal.
- Recurring yearly projects (`rules.md` names them, such as Meetups `<year>`) need creating on 1 January (the predecessor carries a dated task for it). Offer `organize-projects` to create them now if the year is starting.
- New projects the year goals need: create them with `organize-projects` before writing the goals, because a goal must link an existing project, workstream or area.

## 4. Set the year's goals

Follow `set-goal`. 3–7 goals:

- Each is an outcome checkable on 31 December: "Healthy Year kept: gym 4 times a week all year", "Speak at 3 conferences", "Savings of X".
- Each links its project or area first. A goal for a long habit links the habit workstream first and the area second.
- Size the big ones `#L`.

**Ask** the user to approve, and to rank them: when weeks get tight, the ranking decides.

## 5. Write

`plan_period` `{period: <year>, goals}`, plus the `update_task` and `edit_note` calls above. Preview all, show, **ask**, execute each with its `versions`. Report the block ids, then offer `plan-quarter` for the current quarter so the chain reaches down to this week.

## Starting mid-year

If the user plans a year that is already under way (no year, quarter or month plan, but weeks are planned), build the chain top-down now: year, then the current quarter, then the current month. New week goals can then link parents. Existing week goals keep reporting "no parent" until they get one: link each with `update_task {blockId, set: {parent: "<month>#^<id>"}}` (`set-goal` step 4).

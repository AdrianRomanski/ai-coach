---
name: plan-day
description: Plan or run one day in the life vault. Morning - show today's tasks, overdue work, habits and posting slots, add ad-hoc tasks, move tasks to other days. Evening - close the day, see what got done, and move leftovers. Use when the user says "plan my day", "what's on today", "plan tomorrow", "move X to Thursday", "close the day", or names a date to plan.
argument-hint: '[YYYY-MM-DD | today | tomorrow] [close]'
allowed-tools: mcp__life-vault__planning_overview, mcp__life-vault__review_period, mcp__life-vault__read_note, mcp__life-vault__list_notes, mcp__life-vault__search
---

# Plan a day

First read `.claude/skills/vault-planning/SKILL.md` and the three files beside it. A day plan holds no goals: it lists what is scheduled, the day's habit checks (`## Habits`), ad-hoc tasks, what got done, and a log. It never slips, and neither does a habit: an unticked check is a missed day.

Work out the day: today by default, tomorrow when asked, or the date given. If the user says "close" or it is evening and they're wrapping up, go to **Close the day**.

## Morning: plan the day

### 1. Read

Call `planning_overview` with `period: <day>, scope: "period"`, and also with the day's week (`period: <YYYY-Www>, scope: "period"`) for the week goals. From the day's result, sort the tasks into:

- **Habits**: `habitsDue` (the habits whose rule falls on the day) and `habitChecks` (the day plan's checks, ticked or not). A habit in `habitsDue` with no check yet gets one from the write below. Habits are never in `scheduled` or `overdue`.
- **Today**: open one-off tasks in `scheduled`.
- **Overdue**: one-off tasks in `overdue`. They still show in the day's query.
- **Waiting**: tasks whose text names a chase, an order or an answer from someone, and tasks with a "needs:" note (`read_note` the owner note when it matters).

### 2. Show the day

One compact view, grouped by owner, in this order:

1. **Fixed times**: posts and anything else with a time in its text, as a timeline. If `rules.md` sets posting slots, say which are still free.
2. **Start with**: lead-time and waiting tasks (orders, chases, emails to others), so the wait runs during the day.
3. **The rest of today**, ⏫ and slipped tasks first, then by owner.
4. **Overdue**, with how many days late and its slip tags.
5. **Habits**, as a short checklist line, ticked ones marked.
6. **Load**: the day's size points (S 1, M 3, L 8, untagged 1), plain, with no judgement.
7. **Week goals** these tasks serve, one line each, so the day stays tied to the week.

Every morning run writes the day's habit checks: `plan_days {days: {<day>: {...}}}` adds a check to `## Habits` for each due habit the plan lacks, and creates the day plan if it is missing. Show the checks it adds in the preview with the rest. A day planned before a habit was defined gets the missing check the same way.

### 3. Ask, then adjust

Ask the user what to add and what to move. Then build one set of writes:

- **New task for today** → `add_tasks` into its owner's note with `scheduled: <day>` (`add-task`). A one-off with no owner note is an ad-hoc task in the day plan, via `plan_days {days: {<day>: {ad_hoc: [{text, link, size, date: <day>}]}}}`.
- **Move tasks to other days** → `plan_days` with each target day's `schedule: [{note, task}]`, one call for every move. For identical lines (`Gym #M` ×4), or a task with a `blockId`, use `update_task {set: {scheduled: <target day>}}` by `line` or `blockId`, and create the target day plan with `plan_days` if it is missing.
- **Overdue task**: ask per task whether it's today, another day, done, dropped, or left as it is. Never move one without the user saying so. Done and dropped are `update_task` `state: "done"` or `"cancelled"`.
- **Done already**: the user can tick it in Obsidian, or say so and it becomes `update_task` `state: "done"`. A habit check is ticked in Obsidian, or with `update_task {note: "Plans/Daily/<day>.md", task: "<habit>", set: {state: "done"}}`.
- **Posts**: check any posting cap and slot times from `rules.md` on the target day before scheduling. A post without its time gets it with `update_task {set: {text: "<text> 14:00"}}`.
- **Resize or reprioritise**: `update_task {set: {size}}` or `{priority}`.

Preview every call, show all previews together, then execute after the user's yes, each with its `versions`.

## Evening: close the day

1. `review_period` with `period: <day>` and `today: <day>`: what got done and its weight per owner.
2. `planning_overview` with `period: <day>, scope: "period"`: what is still open today.
3. Show done (by owner, with points), then still open. For each open one-off task, ask: tomorrow, a later day, or leave it overdue. Habit checks left open need nothing: each is a missed day, never moved. Name them in one line, plainly.
4. Write the moves as in the morning (one `plan_days` call, `update_task` for identical lines and for what the user says is done or dropped), preview, confirm, execute.
5. Offer a short log for the day: 2–4 lines on what moved, what blocked, and anything to remember tomorrow. If the user wants it, write it with `edit_note {note: "Plans/Daily/<day>.md", heading: "Log", content, mode: "append"}`.

## Planning several days

Plan each day as above, but read once (`planning_overview` for the week with `scope: "period"`) and write once: one `plan_days` call for all the days, its preview shown as a table (day, tasks moved in, ad-hoc added, habit checks added, points), one confirmation. For a whole week, use `plan-week`.

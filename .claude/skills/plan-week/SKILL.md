---
name: plan-week
description: Weekly review and plan in the life vault. Closes last week (review, roll over its slipped tasks and goals), sets this week's goals under the month's goals, spreads tasks over the days by the user's scheduling rules, and creates the day plans. Use when the user says "plan my week", "weekly review", "plan next week", "roll over the week", or names an ISO week such as 2026-W46.
argument-hint: '[YYYY-Www | this | next]'
allowed-tools: mcp__life-vault__planning_overview, mcp__life-vault__review_period, mcp__life-vault__read_note, mcp__life-vault__list_notes, mcp__life-vault__search
---

# Plan a week

First read `.claude/skills/vault-planning/SKILL.md` and the three files beside it.

The week to plan is the current ISO week, or next week when it is Friday to Sunday and the user says nothing, or the week given. Say which week and its dates before starting. Run the steps in order and stop for the user at each **Ask**.

## 1. Close last week

Skip this if last week was already rolled over: its open tasks then carry `#slipped/<last week>`, and its goals appear in this week's plan with that tag.

1. `review_period` for last week, with `today` set to today. Show:
   - each goal: met, missed or dropped, with the effort done for its owner;
   - effort per project and workstream, and per area, as points with the share of the total;
   - what slipped, and anything that has slipped twice or more (name it: these need a decision, not another slip);
   - how many done tasks had no size (their effort is undercounted).
2. **Ask** three questions and keep the answers for the plan: what went well, what got in the way, and what to change this week. Keep it short; this is a review, not an essay. Offer to write the answers into last week's plan: `edit_note {note: "Plans/Weekly/<last week>.md", heading: "Review", content, mode: "replace"}`.
3. For every task slipped twice or more, **ask**: do it this week (and on which day), split it (`add_tasks` the parts, `update_task` cancel the original), move it out further, or drop it (`update_task` `state: "cancelled"`).
4. `roll_over` last week: preview, show the list of tasks and goals that will slip, **ask**, execute.

If a month, quarter or year also closed, run `plan-month` (and up) first, or at least their `roll_over` after the week's: smallest period first.

## 2. Read the week

`planning_overview` with `period: <week>, scope: "period"`. Note:

- `parentGoals`: this month's goals. If there are none and no month plan exists, say so and offer `plan-month` first. Planning the week anyway is fine; its goals will report no parent.
- `goals`: goals already in the plan, including the ones rolled over from last week.
- `scheduled`: the tasks already dated this week, by day. Tasks with a `recurrence` are repeating work (cleaning cycles): count them for the day, never move them. Habits are not tasks: `plan_days` writes each day's habit checks (step 5).
- `overdue`: open tasks dated before the week that didn't roll over.

For deadlines and unscheduled work, call `planning_overview` once more without `scope`, narrowed with `project` for each project whose `deadline` falls within the next three weeks:

- how many open tasks each still has;
- unscheduled open tasks of its active workstreams.

## 3. Set the week's goals

Follow `set-goal`. In short:

- Aim for 3–7 goals, outcomes checkable on Sunday. Rolled-over goals count toward that number: for each, **ask** keep, rewrite (`update_task` its `text`), or drop (`update_task` `state: "cancelled"` on the rolled copy).
- Each goal links its owner first and its month goal as `parent`.
- Add habit goals with counts ("Gym 4 times", "Walk every day, 7 times") from the habit workstreams (`rules.md`), linking workstream then area. Last week's `review_period` `habits` (done of due, streak) tells how realistic a count is.
- A goal whose owner has no open tasks this week has no work behind it: either schedule tasks for it (step 4) or add them (`add-task`).

**Ask** the user to approve the goal list before scheduling.

## 4. Spread the work over the days

Build a day-by-day table first, and only then write. Place tasks in this order:

1. **Slipped tasks** that rolled to Monday: spread them, not all on Monday.
2. **Lead times and waiting**: orders, prints, chases and anything needing another person on Monday or Tuesday.
3. **Deadline chains**: work backwards from each deadline. A graphic goes the day before its post; a chase goes before the work it unblocks; dependent work goes last.
4. **Posts**: within the posting cap and slots from `rules.md`, if any, with the time in the task text. If a post task lacks a time, add it with `update_task {set: {text}}`.
5. **Gym days** and other sessions whose days the user picks each week stay tasks (`Gym #M`), placed on the days they name. Habits on a fixed rule need no placing.
6. **The rest**, by goal.

Show the table: each day with its tasks (owner, size), posting slots, and points. Points are information only. **Ask** for changes, then apply them to the table.

## 5. Write

One batch, all previewed and shown together:

- `plan_period` `{period: <week>, goals: [...]}`: the week plan and its goals.
- One `plan_days` call with all seven days: each day's `schedule` (moves) and `ad_hoc` (new one-off tasks no note owns), and `{}` for days with no changes, so every day plan exists with its habit checks.
- `add_tasks` for new tasks that belong in an owner's note (`add-task`).
- `update_task` for identical lines (`Gym #M` ×4) by `line` or `blockId`, posting times, dropped and rewritten goals, sizes. One call for all of them.

`plan_days`, `add_tasks` and `update_task` often change the same workstream note. Execute them one after the other, `update_task` first (its `line` addresses come from the overview and shift once lines are added), then `plan_period`, `plan_days`, and `add_tasks` last. When a later call touches a note an earlier one just wrote, preview it again before executing (its `versions` are stale); show the user only what differs from the preview they approved.

**Ask**, execute everything, each call with its own `versions`, then report: goals written with their block ids, tasks scheduled per day, habit checks written, and day plans created. Mention that the plans page (`docs-mcp view --vault <vault path>`, then `http://127.0.0.1:4747/plans`) shows the week against its month.

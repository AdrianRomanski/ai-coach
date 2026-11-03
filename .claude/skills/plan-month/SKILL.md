---
name: plan-month
description: Monthly review and plan in the life vault. Closes last month (review, roll over), sets 3-6 month goals under the quarter's goals, places project deadlines and milestones, and sketches which week carries what. Use when the user says "plan the month", "monthly review", "plan November", "roll over the month", or names a month such as 2026-12.
argument-hint: '[YYYY-MM | this | next]'
allowed-tools: mcp__life-vault__planning_overview, mcp__life-vault__review_period, mcp__life-vault__read_note, mcp__life-vault__list_notes, mcp__life-vault__search
---

# Plan a month

First read `.claude/skills/vault-planning/SKILL.md` and the three files beside it.

The month is the current one, or next month in its last week when the user says nothing, or the month given. A month is where projects turn into milestones: the week plans below it should be obvious once the month is set.

## 1. Close last month

Skip if it was already rolled over (its open goals appear in this month's plan with `#slipped/<last month>`).

1. Roll over the week that ended with the month first if it isn't yet (`plan-week` step 1), so tasks slip once.
2. `review_period` for last month with `today`. Show goals met, missed and dropped, with their child week goals; effort per project, workstream and area as points and share; repeated slips; untagged count.
3. **Ask**: which project got more of the month than it deserved, which got less, and what to change. Offer to write them into last month's plan with `edit_note {heading: "Review", content, mode: "replace"}`.
4. `roll_over` last month: preview, show, **ask**, execute.

## 2. Read

`planning_overview` with `period: <month>`:

- `parentGoals`: the quarter's goals. No quarter plan → offer `plan-quarter` first; planning without it is allowed.
- Projects with a `deadline` in this month or the next, their `done_when`, and their open tasks per workstream.
- Projects with no deadline or no `done_when` (except those `rules.md` says have no deadline on purpose). A month goal for them is hard to check; offer to fill them with `set_frontmatter`.
- Workstreams with status `todo` that the quarter needs started, and workstreams `done` but not yet harvested (offer `organize-projects`).

## 3. Set the month's goals

Follow `set-goal`. 3–6 goals, each:

- an outcome true by the month's last day, such as "Conference2026 held and speakers thanked", "Deep clean: kitchen and bathroom done";
- linked to its owner first, and to a quarter goal as `parent`;
- sized (`#L` for a goal that is most of the month's work).

Add one habit goal per habit workstream with a monthly count if the user tracks it ("No sugar every day of November").

Rolled-over goals: **ask** keep, rewrite (`update_task` its `text`) or drop (`update_task` `state: "cancelled"`) each.

**Ask** the user to approve the list.

## 4. Sketch the weeks

List the ISO weeks the month touches and, for each, which month goals it mainly serves and which deadlines fall in it (the conference on 13–14 Nov, a meetup date). This is a sketch for `plan-week`, not a schedule: write no task dates here unless the user wants a milestone task dated now.

Month-level one-off tasks without a day yet (book a venue, renew a subscription) can go into the month plan's `## Ad-hoc` with `ad_hoc` and no `date`; weekly planning picks them up as unscheduled.

## 5. Write

`plan_period` `{period: <month>, goals, ad_hoc}`, plus `set_frontmatter` for project fields, `update_task` for rolled-over goals and `edit_note` for the review text. Preview all, show, **ask**, execute each with its `versions`. Report the goal block ids: the week goals will link to them as `<month>#^<id>`.

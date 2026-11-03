---
name: plan-quarter
description: Quarterly review and plan in the life vault. Closes last quarter, chooses which projects get the next 13 weeks, sets 3-5 quarter goals under the year's goals, and checks every active project has a deadline and a definition of done. Use when the user says "plan the quarter", "quarterly review", "plan Q1", "what should this quarter be about", or names a quarter such as 2027-Q1.
argument-hint: '[YYYY-Qn | this | next]'
allowed-tools: mcp__life-vault__planning_overview, mcp__life-vault__review_period, mcp__life-vault__read_note, mcp__life-vault__list_notes, mcp__life-vault__search
---

# Plan a quarter

First read `.claude/skills/vault-planning/SKILL.md` and the three files beside it.

A quarter is long enough to finish a project and short enough to stay concrete. Its job is choosing: which projects move these 13 weeks, which wait, and what "done" means for each.

## 1. Close last quarter

Skip if already rolled over.

1. Make sure last month (and its last week) are rolled over first, smallest period first.
2. `review_period` for last quarter with `today`. Show goals met, missed and dropped down the chain (month and week goals under each), effort per project and area with the share of the total, and repeated slips.
3. **Ask**: did the effort go where the goals said it should? Name the gap plainly when a goal got little effort, or a project with no goal got a lot. Offer to write the conclusions into the quarter's plan with `edit_note {heading: "Review", content, mode: "replace"}`.
4. `roll_over` last quarter: preview, show, **ask**, execute.

## 2. Portfolio

From `planning_overview` with `period: <quarter>`, make a table of every active project: status, deadline, `done_when`, open tasks, effort last quarter. With the user, put each project in one of three groups:

- **Move**: gets quarter goals and weekly time.
- **Keep alive**: only upkeep, no quarter goal.
- **Pause or finish**: set to `blocked`, closed out, or archived (`organize-projects`).

Areas get a quarter goal only when something should change in them (Health: a diet goal; Home: cleaning cycles running).

Every project in **Move** needs a `deadline` and a `done_when` that a stranger could check. Draft the missing ones with the user and write them with `set_frontmatter`. A project moved to **Pause** gets `status: blocked` the same way.

## 3. Set the quarter's goals

Follow `set-goal`. 3–5 goals, each an outcome true by the quarter's last day, linked to its project or area and to a year goal as `parent`. No year plan → offer `plan-year` first, or plan the quarter without parents.

Rolled-over goals: **ask** keep, rewrite (`update_task` its `text`) or drop (`update_task` `state: "cancelled"`) each.

Check the set against the user's real capacity in one sentence (how many projects in Move at once, besides the user's other commitments), but only as a question for them. Don't cut anything yourself.

## 4. Milestones

For each goal, name the month it should be visibly on its way and the month it should be done. These become the month goals in `plan-month`; write them as a short list in the output, not into the vault.

## 5. Write

`plan_period` `{period: <quarter>, goals}`, plus the `set_frontmatter`, `update_task` and `edit_note` calls above. Preview all, show, **ask**, execute each with its `versions`. Report the block ids, and offer to run `plan-month` for the quarter's first month now.

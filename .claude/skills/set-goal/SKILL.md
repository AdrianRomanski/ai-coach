---
name: set-goal
description: Set goals in the life vault's year, quarter, month or week plans and connect them into one chain - each goal an outcome linked to the project, workstream or area it counts for and to the goal it serves one level up. Also fixes broken chains (goals with no parent) and turns habits into counted goals. Use when the user says "set a goal", "add a goal for this week", "link my goals", "why does W45 say no parent", or "make gym a goal".
argument-hint: '<goal> [for YYYY | YYYY-Qn | YYYY-MM | YYYY-Www]'
allowed-tools: mcp__life-vault__planning_overview, mcp__life-vault__review_period, mcp__life-vault__read_note, mcp__life-vault__list_notes, mcp__life-vault__search
---

# Set and connect goals

First read `.claude/skills/vault-planning/SKILL.md` and the three files beside it. The period skills (`plan-week` and up) call this one for their goals step; it also runs on its own.

## 1. Which period

Year, quarter, month or week; never a day. Default to the current week, or the period the user names. Call `planning_overview` with that period: it returns the goals already there and `parentGoals`, the goals one level up to connect to.

## 2. Make each goal a good one

Check each against these, and rewrite with the user until it passes:

| Test                                              | Fails                                 | Passes                                            |
| ------------------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| **Outcome, not activity**                         | "Work on talks"                       | "Talks announced: all 16 speakers posted"         |
| **Checkable at the period's end** by someone else | "Better marketing"                    | "Saturday schedule poster published"              |
| **Fits the period**                               | a week goal that is a quarter of work | split it, and put the bigger outcome one level up |
| **Has an owner** that holds the work              | no workstream for it yet              | create one with `organize-projects` first         |
| **Serves a parent**                               | an outcome nobody above asked for     | link the parent, or say why it stands alone       |

Habit goals are counts over the period: "Gym 4 times", "Walk every day, 7 times", "No sugar all 30 days". They link the habit workstream first and the area second.

Size a goal by the work behind it: `#S`, `#M`, `#L`. A plan holds 3–7 goals at week level, 3–6 at month level, 3–5 at quarter level, 3–7 at year level. More than that is allowed if the user wants it; just say so once.

## 3. Connect

- **Owner**: `link`, the first link on the line, which the goal counts for.
- **Second link** (workstream then area): `links` in order, the owner first: `{"text": "Gym 4 times", "links": ["Gym and walks", "Sport"]}`. In `plan_period` never put a link in `text`; in `update_task` `text` carries the links.
- **Parent**: `parent: "<period>#^<blockId>"` from `parentGoals`. Pick the parent whose owner is the same project or area, or the one this goal plainly moves forward. If none fits, **ask**: add a parent goal one level up first (run this skill for that period), or leave the goal standalone.
- **No plan one level up**: offer to build the chain top-down (year → quarter → month), each with one or two goals, before writing this one. Without it, the goal reports "links no parent goal". That's allowed, but it is the warning `planning_overview` shows.

## 4. Repair existing goals

Change existing goal lines with `update_task`, addressed by the goal's `blockId` from `planning_overview`:

- **Missing parent**: `{note: "Plans/Weekly/2026-W45.md", blockId: "talks-announced-titles-a", set: {parent: "2026-11#^conference-delivered"}}`. The tool checks the parent is a goal exactly one level up, and keeps the slip tags and `⏫`.
- **Rewrite**: `set: {text: "<new outcome> [[Owner]]"}`; the size, slip tags and parent link stay.
- **Drop**: `set: {state: "cancelled"}` writes `[-]` and `❌ <today>`; `review_period` then counts it as dropped, not missed.
- **Done early**: `set: {state: "done"}`, or the user ticks it in Obsidian.
- **A second link** (workstream then area) on an existing goal: `set: {text}` with both links in it, the owner first.

Several repairs go in one `update_task` call.

## 5. Check the work behind each goal

For each goal, look at the owner's open tasks scheduled in the period (`scheduled` from `planning_overview`). If there are none, say so: the goal has no work behind it yet. Offer `add-task` or scheduling existing tasks (`plan-week`).

## 6. Write

`plan_period {period, goals: [{text, link or links, size, parent}]}`, and `update_task` for the repairs. Preview, show the goal lines exactly as they will be written, **ask**, execute with each preview's `versions`. Report each goal's block id from `goalIds`; child goals link to them.

---
name: add-task
description: Add tasks to the life vault, from one quick task to a whole checklist, and connect them - to their project, workstream or area, to the goals they serve, to a day, and to each other (subtasks and dependencies). Writes each task into its owner's note, with habits, subtasks and dependencies. Use when the user says "add a task", "remind me to", "I need to", "add these to the conference", "X depends on Y", "make this a habit", or dumps a list of things to do.
argument-hint: '<what needs doing>'
allowed-tools: mcp__life-vault__planning_overview, mcp__life-vault__read_note, mcp__life-vault__list_notes, mcp__life-vault__search
---

# Add tasks

First read `.claude/skills/vault-planning/SKILL.md` and the three files beside it.

## 1. Shape each task

For each thing the user said, settle these five, asking only for what you can't infer:

| Field                    | How to settle it                                                                                                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Text**                 | A concrete action or visible result. Rewrite vague items ("conference stuff" → "Send speakers the venue address"). Split anything holding "and" into two tasks unless they're one sitting. A post gets its time: `… on social media 14:00`. A wait names the person: `Chase John Smith for his abstract` |
| **Owner**                | The project, workstream or area it belongs to. Match against `planning_overview`'s names. One-off effort → a workstream; repeating upkeep → an area; personal habits → a habit workstream (rules.md). Nothing fits → propose a new workstream with `organize-projects` rather than forcing it            |
| **Size**                 | `S` under an hour, `M` a few hours, `L` a day or more. Ask whether an `L` should be split                                                                                                                                                                                                                |
| **Day**                  | `⏳` date, or none. Apply the scheduling rules: lead times early, a graphic before its post, any posting cap and slots from `rules.md`, a chase before the work it unblocks. Count the existing posts on a day before giving a slot                                                                      |
| **Links to other tasks** | Is it part of a bigger task (subtask)? Does it wait for another task, or does another wait for it (dependency)?                                                                                                                                                                                          |

Show the shaped tasks as a table and let the user correct them.

## 2. Choose where each task goes

Pick per task, top to bottom, the first that fits:

1. **The task has an owner note** (a workstream, an area, or a project note) → `add_tasks` into that note. This covers repeating work (`recurrence`), subtasks (`parent`), dependencies (`id` / `blockedBy`) and priority. A habit is not a task: see **Habits** below. Pick the `heading` the note already uses for that kind of task (`read_note` it when unsure): a speaker's tasks under `## Speakers` in `Talks.md`, a cleaning cycle under `## Cycles` in `Home.md`. In a folder workstream the owner note is its main note `<W>/<W>.md`, unless the user names another note inside it.
2. **A large batch of related tasks with its own purpose** (a thank-you round, a merch order with ten steps) → a **task note** in the owner's folder (section 3), when it reads better as its own checklist than as twenty lines in the workstream note.
3. **A one-off task no note owns**, or one the user wants on a plan only (an errand linked to an area) → an **ad-hoc task**: `plan_period {period: <day>, ad_hoc: [{text, link: <owner>, size, date: <day>}]}`, or with no `date` in the current month's plan (`period: <YYYY-MM>`) when it has no day yet.

Several tasks for the same note go in one `add_tasks` call per heading or parent.

## 3. Writing the tasks

`add_tasks` call for the shaped tasks:

```json
{
  "note": "1.Projects/Conference2026/Workstreams/Talks.md",
  "heading": "Thank-you round",
  "tasks": [
    {
      "text": "Collect the speakers' emails",
      "size": "S",
      "scheduled": "2026-11-16",
      "id": "emails"
    },
    {
      "text": "Write the thank-you message",
      "size": "S",
      "scheduled": "2026-11-16",
      "id": "message"
    },
    {
      "text": "Send the thank-you emails",
      "size": "M",
      "scheduled": "2026-11-17",
      "blockedBy": ["emails", "message"]
    }
  ]
}
```

- `text` is the description only. Size, date, priority, `🔁`, `🆔` and `⛔` go in their own fields; the tool refuses signifiers in the text.
- **Dependencies**: `id` on the task that must happen first, `blockedBy` on the one that waits. An existing task gets an `id` with `update_task` (`set: {id}`) before a new task can wait on it. Ids are short kebab-case words, unique in the vault. Keep the dates consistent: a blocked task is scheduled after what blocks it.
- **Subtasks**: a second `add_tasks` call with `parent` set to the parent task (`{task: "Recording links"}` or its `blockId`). For a new parent with subtasks, add the parent first, then its subtasks in a second call after the first is written.
- **Repeating work** that must still get done when a day is missed (a cleaning cycle, paying a bill): `recurrence` (`every week on Monday`, `every month on the 1st`) with only the next date as `scheduled`.
- **Habits**, a routine that is simply missed on a day it is not done (up at 6:00, a walk, reading): `add_habits {note, habits: [{text, rule}]}` into the habit's owner note, a habit workstream for a personal habit (rules.md). `rule` is `every day`, `every weekday`, `every weekend` or `every week on <days>`. It writes `- <text> 🔁 <rule>` under `## Habits`; the day plans then get a check for each due day. Change or end a habit with `edit_note` on its line. When the user says "make X a habit", ask which of the two it is only if it is unclear.
- **An existing task** that should change (new date, size, a dependency) is `update_task`, not a new line.

**Task note** (option 2): `capture` a note with a title that says what the batch is ("Speaker thank-you round", not "Tasks"), one line of purpose linking the owner (`Part of [[Talks]].`), and the tasks in full Tasks syntax with signifiers at the end of each line. `file_note` it into the owner's folder (`tools.md`). Preview `capture` with the full body, show it with the folder, **ask**, execute, then `file_note` (preview, execute). One yes covers both if `file_note` shows no collision or warning.

## 4. Connect to goals

Tasks never link goals. A task serves a goal when the goal links the task's owner first. After adding:

- Check `planning_overview` (with the week) for a goal on the same owner. If one exists, say which goal the tasks serve.
- If the tasks are the work behind something the user wants done this week or month and no goal covers it, offer `set-goal`.

## 5. Write

All tool writes in one batch: previews shown together (the exact lines each note gets), one **ask**, then execute each with its preview's `versions`. Subtasks under a parent added in the same batch are previewed after the parent is written. Finish with what was added where (note and heading, or plan; owner; day), so the user can find each task. The first time a line carries `🆔`, `⛔`, a priority or `🔁`, ask the user to check it in a Tasks query in Obsidian (`tools.md`).

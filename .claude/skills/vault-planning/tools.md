# The life-vault tools for planning

The server is registered in Claude Code as `life-vault` (see `.claude/skills/README.md`), so its tools are named `mcp__life-vault__<tool>`. If they are missing, tell the user to register it as that README shows. If `add_tasks`, `update_task`, `plan_days`, `set_frontmatter`, `edit_note` or `create_workstream` are missing, the server isn't running or runs an old build: tell the user to rebuild their kb-template checkout (`pnpm run build`) and to restart the `life-vault` server (`/mcp`, or restart Claude Code). Don't fall back to editing files.

## Every write: preview, versions, execute

Every write tool previews unless given `execute: true` (kb-template ADR-KI-0064):

1. Call it without `execute`. The preview lists each changed line as a before and after, the notes it creates, warnings, and `versions`: a hash of each existing note it would change.
2. Show the user the preview and wait for their yes.
3. Call it again with the **same arguments**, `execute: true`, and the preview's `versions` passed back unchanged. **Always pass `versions`.** Without them the write still runs, unchecked, with a warning; `update_task` with a task addressed by `line` refuses to run at all.
4. If the execute is refused because a note changed since its preview (the user edited it in Obsidian meanwhile), preview again, show the new before and after, and ask again.

A batch of previews shown together may be confirmed once; each call still gets its own `versions`. When several calls touch the same note (two `update_task` calls on one workstream), merge them into one call, or execute them one after the other and preview the second only after the first is written, or the second's `versions` are already stale. Run `update_task` calls that address tasks by `line` before any call that adds lines to the same note (`add_tasks`, `edit_note`), since added lines shift the line numbers; after such a write, re-read `planning_overview` for fresh lines.

**Signifier order is assumed, not tested.** New task lines get, after their text, links and tags: `🆔`, `⛔`, priority, `🔁`, then the dates. That is the Tasks plugin's default order as kb-template understands it, not checked against the plugin version in the vault. The first time in a session a skill writes a line with `🆔`, `⛔`, a priority or `🔁`, ask the user to check that the task shows correctly in a Tasks query in Obsidian (its priority, its repeat, its dependency).

## Read

| Tool                                | Use it for                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planning_overview`                 | With `period` and `scope: "period"`: only that period's `goals`, the tasks `scheduled` in it, the open tasks `overdue` before it, and the `parentGoals` one level up. Without `scope`: also every project (status, deadline, `done_when`, workstreams), area, existing plan, and every open task in the vault. `project` or `area` narrow all task lists                    |
| `review_period`                     | Effort per project, workstream and area (size-weighted done tasks), each goal as met, open, missed or dropped with its child goals, what slipped out, what slipped twice or more, done tasks without a size, and `habits`: each habit's `due`, `done` and `missed` days and its `streak` (habit checks are not effort). `today` sets the date open goals are judged against |
| `read_note`, `list_notes`, `search` | Read a project, workstream, area or plan note in full, for context such as a description, nested subtasks, a table or "needs:" notes                                                                                                                                                                                                                                        |

Reading `planning_overview`:

- **Use `scope: "period"` for a day or a week.** The full result holds every open task in the vault (about 81,000 characters for one day). Ask for the full result only when you need the projects, areas, plans or unscheduled work: planning a month or more, or finding a task's owner.
- `project` and `area` narrow `openTasks`, `scheduled` and `overdue` alike. To see a day across all owners, leave them out.
- Each task carries `note` and `line`, its address; `blockId` (`^id`, goals and some tasks); `id` (`🆔`) and `blockedBy` (`⛔`); `recurrence` (the `🔁` rule of repeating work); `owner` `{project, workstream, area}`; `size`, `scheduled`, `priority`, `slipped`, `state`.
- `line` is 0-based in the note's body, frontmatter excluded. Pass it to `update_task` exactly as returned; never count lines yourself.
- `text` keeps links but drops dates, priority, size, slip tags, `🔁`, `🆔` and `⛔`.
- **Habits.** The full result lists `habits` (each definition's `text`, `rule`, `note`, `line`, `owner`). For a day, the period part adds `habitsDue` (habits whose rule falls on that day) and `habitChecks` (the day plan's checks, with their `state`). Habit checks are never in `openTasks`, `scheduled` or `overdue`.

## Write

### `plan_period`: plans, goals, ad-hoc tasks, scheduling

```json
{
  "period": "2026-W45",
  "goals": [
    {
      "text": "Talks announced",
      "link": "Talks",
      "size": "L",
      "parent": "2026-11#^conference-delivered"
    },
    {
      "text": "Gym 4 times",
      "links": ["Gym and walks", "Sport"],
      "size": "M",
      "parent": "2026-11#^move-every-day"
    }
  ],
  "ad_hoc": [
    {
      "text": "Call the venue about parking",
      "link": "Conference2026",
      "size": "S",
      "date": "2026-11-03",
      "priority": "high"
    }
  ],
  "schedule": [
    {
      "note": "1.Projects/Conference2026/Workstreams/Talks.md",
      "task": "Graphic for Jane Doe",
      "date": "2026-11-03"
    }
  ]
}
```

- Creates the plan from its template if it doesn't exist. A plan that exists and gets no goals or ad-hoc tasks is left untouched, so `schedule` alone only edits task lines.
- `goals` are not allowed in a day plan. `parent` must be a goal exactly one level up, as `<period>#^<id>`. Take ids from `parentGoals[].blockId`.
- **Owner and more links.** Give `link` (the owner), or `links` (the first is the owner), or both (`link` first, then `links`). The owner must be a project, workstream or area (a name such as `Talks`, or a note path); further links may be any note. A habit goal is `{"text": "Gym 4 times", "links": ["Gym and walks", "Sport"]}`. Never put a link in `text`.
- Ad-hoc tasks also take `priority` (`highest | high | medium | low | lowest`), `recurrence` (a Tasks rule such as `every week on Monday`), `id` and `blockedBy`. `text` is the description only.
- Every `date` (ad-hoc and schedule) must lie inside `period`.
- `schedule.task` is a part of the task text that must match **exactly one** open task in that note. Use a distinctive part ("Graphic for Jane Doe", not "Graphic"). Scheduling replaces an existing `⏳`. For identical lines (`Gym #M` ×4) use `update_task` by `line` or `blockId`.
- The result's `goalIds` gives the block id of each new goal. Use them for child goals.

### `plan_days`: several days in one preview

```json
{
  "days": {
    "2026-11-03": {
      "schedule": [
        {
          "note": "1.Projects/Conference2026/Workstreams/Talks.md",
          "task": "Graphic for Jane Doe"
        }
      ],
      "ad_hoc": [
        {
          "text": "Call the venue about parking",
          "link": "Conference2026",
          "size": "S",
          "date": "2026-11-03"
        }
      ]
    },
    "2026-11-04": {}
  }
}
```

Each day is planned as `plan_period` plans a day, and missing day plans are created. A `schedule` item's `date` defaults to its day; an ad-hoc task without `date` lands in that day's plan unscheduled, so give it `date` when it should show in the day's query. `{}` just creates the day plan. One error refuses every day. Use it for a week's layout, spreading slipped tasks, and moving several tasks across days.

### `add_tasks`: tasks into their owner's note

```json
{
  "note": "1.Projects/Conference2026/Workstreams/Talks.md",
  "heading": "Speakers",
  "tasks": [
    {
      "text": "Alex Kim announced on social media 16:00",
      "size": "S",
      "scheduled": "2026-11-07",
      "id": "kim-post",
      "blockedBy": ["kim-abstract"]
    }
  ]
}
```

- `note` is an existing project, workstream, area or plan note. Not an Intermediate Packet, not an archived project.
- Where: `heading` puts the tasks at the end of that section (created when missing); `parent` (`{line}`, `{blockId}` or `{task}`, as in `update_task`) indents them under an existing task as subtasks; neither puts them at the end of the note. `heading` and `parent` together are refused.
- Each task: `text` (the description only; no `#S`, `⏳`, `⏫` or other signifiers in it), `size`, `scheduled`, `links`, `priority`, `recurrence`, `id`, `blockedBy`. In a plan, the first of `links` is the owner.
- Repeating work: `{"text": "Clean the bathroom", "size": "M", "recurrence": "every week on Saturday", "scheduled": "2026-11-07"}`, only the next date on the line. A habit is `add_habits`, not this.
- Refuses an `id` already used by a planned task and a `blockedBy` that names no existing `🆔`. Ids are short kebab-case words.

### `update_task`: change existing tasks and goals

```json
{
  "updates": [
    {
      "note": "Plans/Weekly/2026-W45.md",
      "blockId": "gym-4-times",
      "set": { "parent": "2026-11#^move-every-day" }
    },
    {
      "note": "1.Projects/Healthy Year/Workstreams/Gym and walks.md",
      "line": 12,
      "set": { "scheduled": "2026-11-06" }
    },
    {
      "note": "1.Projects/Conference2026/Workstreams/Talks.md",
      "task": "Order stickers",
      "set": { "state": "done" }
    }
  ]
}
```

- **Address** each task by `note` and exactly one of: `blockId` (`^id` or `🆔`; best when there is one), `line` (from `planning_overview`; needs `versions` on execute), or `task` (a part of the text matching exactly one open task).
- **`set`** takes `text`, `size`, `priority`, `scheduled`, `state` (`open | done | cancelled`), `parent` (goals only, a goal one level up), `id`, `blockedBy`, `recurrence`. `null` removes a field. Only the fields given change: slip tags, the parent link and the rest of the line stay as they are. `text` replaces the description with its links; size, slip tags and parent link are kept.
- `done` writes `✅ <today>`; `cancelled` writes `[-]` and `❌ <today>` (a dropped goal counts as dropped, not missed); `open` clears both.
- **Repeating tasks:** never tick or cancel a `🔁` task with this tool. Tasks writes the next occurrence only when it is ticked in Obsidian, so the tool refuses unless the same update sets `recurrence: null`, which ends it for good. Tell the user to tick it in Obsidian.
- **Habit checks** in a day plan are plain tasks: tick one with `{note: "Plans/Daily/<day>.md", task: "<habit text>", set: {state: "done"}}`.
- Several updates go in one call, one preview.
- Goals rolled over before 2026-11-02 may have `⏫` before their `↑` parent link, where Tasks doesn't read it. `update_task` with `priority: "high"` on such a goal rewrites it in the right place.

### `add_habits`: define habits

```json
{
  "note": "1.Projects/Healthy Year/Workstreams/Morning routine.md",
  "habits": [
    { "text": "Up at 6:00", "rule": "every day" },
    { "text": "Glass of water before coffee", "rule": "every weekday" }
  ]
}
```

- Writes `- <text> 🔁 <rule>` under `## Habits` in a project, workstream or area note (section created when missing). Refuses a plan note, a rule other than `every day`, `every weekday`, `every weekend`, `every week on <days>`, a habit the note already has, and text with links, size or signifiers.
- The day plans get the checks: `plan_period` for a day and `plan_days` add a `- [ ] <text> [[<owner note>]]` to `## Habits` for every due habit the plan lacks (in `habits` of the result). Running them again adds nothing twice. A day plan Obsidian creates from the template has an empty `## Habits` until one of them runs for that day.
- Change a habit's text or rule, or end it, with `edit_note` on its definition line (`old` / `new`). Checks already written in day plans stay.
- A habit of a workstream or area whose status is `done`, or of an archived project, is not checked any more.

### `roll_over`: close a week, month or quarter

`{ "period": "2026-W45" }`, run at the start of the next period. Preview first and show the user the list of what slips. After executing, spread the slipped tasks over the new period with `plan_days` (they all land on its first day).

### `set_frontmatter`: status, deadline, definition of done

`{ "note": "1.Projects/Podcast/Podcast.md", "set": { "status": "in-progress", "done_when": "20 episodes published" } }`

Changes only the named keys' lines. `status` is `todo | in-progress | blocked | done`, `deadline` is `YYYY-MM-DD`, `null` removes a key. Refuses `coach_id`, `converted_from`, `raw_role` and `pages`.

### `edit_note`: prose and tables in a note's body

- Exact text: `{ "note", "edits": [{ "old": "<exact text, once in the body>", "new": "<replacement>" }] }`, applied in order.
- One section: `{ "note", "heading": "Review", "content": "<text>", "mode": "replace" | "append" }`. A missing section is added at the end of the note (with a warning); two sections with the same heading are refused.

For a description, a table column, a project note's text, a plan's `## Review`, a day's `## Log`. Never for task lines (`add_tasks`, `update_task`) or frontmatter (`set_frontmatter`). Refuses `Coach/` and raw text under `3.Resources/0.Raw/`.

### `create_workstream`

`{ "project": "Conference2026", "name": "Talks", "folder": false, "status": "todo", "description": "<one paragraph>", "area": "Public Speaking" }`

Writes `1.Projects/<P>/Workstreams/<W>.md` (or `<W>/<W>.md` with `folder: true`) with its status, description and area in frontmatter, and lists it under the project note's `## Workstreams`. The project must be active. Add its first tasks after with `add_tasks`.

### `capture` + `file_note`: new projects, areas and task notes

`capture` writes a new note into `0.Inbox` with exactly the body given, frontmatter included. `file_note` moves one note into any folder under the PARA folders, and creates the folder. Together they create:

| New thing                          | `capture` title     | `file_note` `to`                 |
| ---------------------------------- | ------------------- | -------------------------------- |
| Project                            | `<P>`               | `1.Projects/<P>`                 |
| Area                               | `<A>`               | `2.Areas`                        |
| Task note in a folder workstream   | a descriptive title | `1.Projects/<P>/Workstreams/<W>` |
| Task note for a project as a whole | a descriptive title | `1.Projects/<P>`                 |

A workstream is made with `create_workstream`, not these. A task note is for a large batch of related tasks that reads well as its own note (a checklist with its own purpose); most tasks go into their owner's note with `add_tasks`. `capture`'s preview lists only the file it will write, not the body, so show the user the body you are sending and where it will be filed. Preview `capture`, execute, then preview and execute `file_note`. One yes from the user covers both steps when `file_note`'s preview has no collision or warning. Titles must be unique and must not contain `\ / : * ? " < > | # ^ [ ]`. These two filing tools return no `versions`.

### `harvest_workstream`

For a workstream whose `status` is `done`: call without `packets` to list candidates, agree with the user which are worth reusing and how to describe them, then preview with `packets` and execute.

## What no tool can do

| Change                                                              | Instead                                                   |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| Tick a repeating task (`🔁`) so its next occurrence is written      | the user ticks it in Obsidian                             |
| Delete a stray note (for example `2026-10-31.md` at the vault root) | the user deletes it in Obsidian                           |
| Move a task line from one note to another                           | `add_tasks` in the new note, `update_task` cancel the old |

## The hand edit

When a change has no tool, never edit the file yourself. Give the user one block per note they can apply in Obsidian, naming the note, the place, and what to do. Group hand edits at the end of the session's output, and after the user says they're done, re-read with `planning_overview` before planning on top of them.

# The planning model (kb-template ADR-KI-0062)

## Structure

| Thing               | Where                                                                                                                                     | Notes                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Project             | `1.Projects/<P>/<P>.md`                                                                                                                   | frontmatter `status`, `deadline` (YYYY-MM-DD), `done_when` (one sentence: what is true when it is finished)                |
| Workstream          | `1.Projects/<P>/Workstreams/<W>.md`, or a folder `Workstreams/<W>/` with main note `<W>/<W>.md`                                           | frontmatter `status`. Every note inside a folder workstream counts as that workstream's. A workstream holds no workstreams |
| Area                | `2.Areas/<A>.md` (or a folder, same rule)                                                                                                 | ongoing responsibility with no end date                                                                                    |
| Plan                | `Plans/Yearly/YYYY.md`, `Plans/Quarterly/YYYY-Qn.md`, `Plans/Monthly/YYYY-MM.md`, `Plans/Weekly/YYYY-Www.md`, `Plans/Daily/YYYY-MM-DD.md` | made from `Plans/Templates/`                                                                                               |
| Intermediate Packet | `1.Projects/<P>/Intermediate Packets/`                                                                                                    | the reusable output harvested when a workstream is done. Always write "Intermediate Packet" in full, never "IP"            |

Status vocabulary, for projects, workstreams and areas: `todo | in-progress | blocked | done`.

A task belongs to the note it is written in: a task in a workstream note (or any note in a folder workstream) belongs to that workstream, a task anywhere else in a project folder belongs to the project, a task in an area note belongs to the area. A task in a plan belongs to whatever its **first** link names.

## Task line

Obsidian Tasks syntax, signifiers at the end of the line:

```
- [ ] Order stickers and t-shirts #S ⏳ 2026-11-03
- [ ] Jane Doe announced on social media 14:00 #S ⏳ 2026-11-04
- [ ] Clean the bathroom #M 🔁 every week on Saturday ⏳ 2026-11-07
- [x] Pasta drawer #S ⏳ 2026-11-01 ✅ 2026-11-01
```

| Mark                | Meaning                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `⏳ YYYY-MM-DD`     | scheduled: the day the user intends to do it. The only date the planner uses                                      |
| `✅ YYYY-MM-DD`     | done on that day (Obsidian adds it on tick)                                                                       |
| `⏫`                | high priority. `roll_over` adds it to everything that slipped                                                     |
| `#S` `#M` `#L`      | size, weighing 1, 3 and 8 in reviews. Untagged counts as 1                                                        |
| `#slipped/<period>` | added by `roll_over`, once per slip; two tags means it slipped twice                                              |
| `🔁 every week…`    | repeating work. Carries only its next date. Ticking it makes the next one. Never slips, but stays open until done |
| `🆔 id` / `⛔ id`   | Tasks dependencies: `⛔ a` means "blocked until the task with `🆔 a` is done"                                     |

Sizes, as a rule of thumb: **S** fits in under an hour, **M** takes a few hours, **L** is a day or more of work. When a task is L, ask whether it should be split.

A good task is a concrete action that is either done or not, starting with a verb or naming a visible result: "Order stickers and t-shirts", "Picture of Jane Doe in Marketing/Speakers". When a task waits on someone, name the person and the thing: "Chase John Smith for his abstract".

## Habit

A habit is a routine that is either kept on a day or missed: up at 6:00, a walk, reading. It is not a task line. It is defined once, as a plain list item (no checkbox) under `## Habits` in its owner's note, with its rule after `🔁`:

```
## Habits

- Up at 6:00 🔁 every day
- Glass of water before coffee 🔁 every weekday
- Long walk 🔁 every week on Saturday and Sunday
```

Rules: `every day`, `every weekday`, `every weekend`, `every week on <days>`. Each day plan gets a `## Habits` section with that day's checks, written by `plan_period` / `plan_days`:

```
## Habits

- [ ] Up at 6:00 [[Morning routine]]
- [x] Glass of water before coffee [[Morning routine]] ✅ 2026-11-03
```

An unticked check is a **missed day**. It has no `⏳`, so no other day lists it, it is never overdue and it never rolls over. `review_period` counts each habit's ticked days of its due days and its streak. Work that must still get done after a missed day (a cleaning cycle) is a `🔁` task, not a habit.

## Goal line

Goals live in the `## Goals` section of year, quarter, month and week plans (never in day plans):

```
- [ ] Gym 4 times [[Gym and walks]] [[Sport]] ↑ [[2026-11#^move-every-day]] ^gym-4-times
```

- The text is an **outcome**, checkable at the end of the period: "Talks announced", not "Work on talks". Habit goals count: "Gym 4 times".
- The **first** link is the owner the goal counts for: a project, workstream or area. A habit goal links its workstream first, then its area.
- `↑ [[<period>#^<id>]]` links the goal one level up it serves. A goal with no parent is allowed but reported.
- `^id` is the goal's block id, written by `plan_period`, which child goals link to and `update_task` addresses it by.
- A goal is met when it is ticked. `review_period` judges it **missed** when it is still open after its period ended, and **dropped** when the user marked it cancelled.

## The chain

```
Year goal  ──↑──  Quarter goal  ──↑──  Month goal  ──↑──  Week goal
    │                  │                    │                  │
 links owner       links owner          links owner        links owner
                                                                │
                              tasks in that owner, scheduled with ⏳ into days
```

Tasks never link goals. A task serves a goal through their shared owner: a week goal linking `[[Talks]]` is served by the tasks in `Talks.md` scheduled that week. So when a goal needs work that has no owner yet, create the workstream first (`organize-projects`).

## Plan sections

| Level         | Sections                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------ |
| Year, quarter | Goals, Review                                                                              |
| Month         | Goals, Scheduled (query), Ad-hoc, Review                                                   |
| Week          | Goals, This week (query), Ad-hoc, Done (query), Review                                     |
| Day           | Today (query: not done, scheduled on or before the day), Habits, Ad-hoc, Done (query), Log |

The queries are live only in Obsidian with the Tasks plugin. The day query shows overdue tasks too, so an unfinished task stays visible every day until it is moved or its week rolls over.

## Closing a period

- `roll_over` closes a **week, month or quarter**: open tasks scheduled in it move to the next period's first day with `⏫ #slipped/<period>`, and open goals are copied into the next plan with the same marks. The originals stay open as the record. 🔁 tasks stay put, and habit checks are never touched.
- A **day** never slips: its open tasks stay listed until the week rolls over.
- A **year** never rolls over: each open year goal is kept, dropped or rewritten by hand in the new year's plan.
- When several periods close on the same day, roll over the smallest first (week, then month, then quarter), so a task slips once and not three times.
- `roll_over` puts every slipped task on the **first day** of the next period. Always spread them across the new period right after with `plan_days`, or that first day piles up.

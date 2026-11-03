---
name: organize-projects
description: Shape the structure planning hangs on in the life vault - create a project (with deadline and definition of done), a workstream, or an area; check the structure for gaps; finish a workstream and harvest its Intermediate Packets. Use when the user says "new project", "start a workstream for X", "add an area", "set up Meetups 2027", "this workstream is done", or when a task or goal has no owner to link.
argument-hint: '<project | workstream | area | harvest> <name>'
allowed-tools: mcp__life-vault__planning_overview, mcp__life-vault__read_note, mcp__life-vault__list_notes, mcp__life-vault__search
---

# Organize projects, workstreams and areas

First read `.claude/skills/vault-planning/SKILL.md` and the three files beside it. Every goal and task must link a project, workstream or area, so this skill comes first whenever planning finds work with no home.

## Decide what it is

| It is a        | when                                           | Example                                  |
| -------------- | ---------------------------------------------- | ---------------------------------------- |
| **Project**    | it has an end and a definition of done         | Conference2026, Meetups 2027             |
| **Workstream** | it is a part of a project, finished on its own | Marketing, Meetup 2026-12-10, Deep clean |
| **Area**       | it is a standard kept up with no end           | Health, Home, Finances                   |

One-off effort is a workstream; repeating upkeep is an area. A project with one workstream is fine. A workstream holds no workstreams. Check `planning_overview` first that nothing with the same or a close name exists.

## Create a project

Settle with the user: the name, `deadline`, and `done_when` (one sentence a stranger could check), the workstreams it starts with, and a one-paragraph purpose.

`capture` title `<P>`, body:

```markdown
---
status: in-progress
deadline: 2027-12-31
done_when: Every meetup of 2027 held
---

# Meetups 2027

<purpose>

## Workstreams
```

then `file_note` to `1.Projects/<P>`. Then create each workstream as below; `create_workstream` fills the `## Workstreams` list.

For a **recurring yearly project** (`rules.md`), also add the hand-off task to start the year after, with `add_tasks` into the project note once it is filed: `{text: "Start the Meetups <year+1> project", scheduled: "<year+1>-01-01"}`.

## Create a workstream

Settle: the project, the name, `status` (`todo` or `in-progress`), one paragraph on what it delivers and when it is done, a link to its area if it has one, and its first tasks (shaped as in `add-task`, with full Tasks syntax: sizes, dates, `🔁`, `🆔`/`⛔`, subtasks).

A note workstream holds its tasks in one note; a **folder** workstream (`Workstreams/<W>/<W>.md`) can later receive task notes, pictures and files. Prefer a folder when the workstream will collect files or many batches of tasks (Marketing); a note when it is a single list (Deep clean).

`create_workstream {project, name, folder, status, description, area}` writes the note with its frontmatter and lists it under the project note's `## Workstreams`. Then `add_tasks` into it with its first tasks, under the headings it needs:

```json
{
  "note": "1.Projects/Meetups 2026/Workstreams/Meetup 2026-12-10.md",
  "heading": "Speakers",
  "tasks": [
    {
      "text": "Confirm two speakers",
      "size": "M",
      "scheduled": "2026-11-16",
      "id": "speakers"
    },
    {
      "text": "Speaker graphics",
      "size": "S",
      "scheduled": "2026-11-23",
      "blockedBy": ["speakers"]
    }
  ]
}
```

The `add_tasks` preview can only run once the workstream note exists: execute `create_workstream`, then preview the tasks. One yes covers both when the user saw the tasks with the workstream.

## Create an area

`capture` title `<A>`, body: `# <A>`, one paragraph on the standard it keeps, links to the workstreams that carry its habits this year, and a `## Cycles` section with 🔁 tasks if it has upkeep. Then `file_note` to `2.Areas`.

## Check the structure

On request, or when a planning skill finds trouble, list from `planning_overview`:

- projects without `deadline` or `done_when`, and workstreams and areas without `status`;
- projects with all workstreams `done`: ready to close;
- workstreams `done`: ready to harvest;
- open tasks with no size;
- notes the planner warns about.

Fix what the user agrees to: `set_frontmatter` for a missing `status`, `deadline` or `done_when`, `update_task` for a missing size, `edit_note` for a missing description. Show all previews together, one **ask**.

## Finish a workstream

1. Show its open tasks first; each is done (`update_task` `state: "done"`), dropped (`state: "cancelled"`) or moved elsewhere. Then `set_frontmatter {note, set: {status: "done"}}`.
2. `harvest_workstream {project, workstream}` lists candidates. Go through them with the user: which would another project start from (a checklist, a template, a message, a design)? Name each packet for its reuse ("Speaker announcement checklist") and describe it in the user's words.
3. Preview with `packets`, show, **ask**, execute. Each becomes a note in `1.Projects/<P>/Intermediate Packets/`.
4. When the whole project is done, archiving it (`archive_project`, ADR-0022 for which knowledge notes to keep) moves the packets to `3.Resources/Intermediate Packets/<P>/`.

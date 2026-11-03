# Planning skills for Claude Code

**Plan your year, quarter, month, week and day in your Obsidian vault by talking to [Claude Code](https://claude.com/claude-code).**

These skills turn Claude Code into a planning partner that works on the same vault as the `coach` CLI. You say "plan my week". Claude closes last week, shows what slipped, helps you set this week's goals under the month's, spreads the work over the days by your own scheduling rules, and writes it all into your vault after you've seen a preview and said yes.

They are instructions, not code. All the bookkeeping (plans, goal links, roll-overs, effort counts, habit streaks) is done by the planning tools of kb-template's `docs-mcp` server. The skills teach Claude when to call which tool, how to read the results, and how to talk you through a plan.

---

## Contents

- [The skills](#the-skills)
- [Set it up](#set-it-up)
- [The planning model](#the-planning-model)
- [Make the rules yours](#make-the-rules-yours)
- [Safety](#safety)
- [How the skills are built](#how-the-skills-are-built)
- [Troubleshooting](#troubleshooting)

---

## The skills

| Skill               | Say                                                            | It                                                                                                              |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `plan-day`          | "plan my day", "what's on today", "close the day"              | shows today's tasks, overdue work, habits and fixed times; adds and moves tasks; in the evening, closes the day |
| `plan-week`         | "plan my week", "weekly review"                                | reviews and rolls over last week, sets 3–7 week goals, lays the work out day by day, creates the day plans      |
| `plan-month`        | "plan the month", "monthly review"                             | reviews and rolls over last month, sets 3–6 goals, places deadlines and sketches which week carries what        |
| `plan-quarter`      | "plan the quarter", "plan Q1"                                  | reviews the quarter, sorts projects into move / keep alive / pause, sets 3–5 goals, checks every deadline       |
| `plan-year`         | "plan 2027", "yearly review"                                   | keeps, drops or rewrites each year goal, asks what should change in every area, sets 3–7 year goals             |
| `add-task`          | "remind me to…", "add these to the conference", a list         | shapes each task (text, owner, size, day, dependencies) and writes it into its owner's note                     |
| `set-goal`          | "set a goal", "link my goals", "make gym a goal"               | writes outcome goals, links each to its owner and to the goal it serves, repairs broken chains                  |
| `organize-projects` | "new project", "start a workstream", "this workstream is done" | creates projects, workstreams and areas, checks the structure for gaps, harvests a finished workstream          |
| `review-period`     | "how did my week go", "where did my time go"                   | reads any period back: goals met or missed, effort per project and area, what keeps slipping, habit streaks     |
| `vault-planning`    | "help me plan", "what should I work on"                        | the shared model, tool reference and your rules; every other skill reads it first                               |

Type the skill as a slash command (`/plan-week`, `/plan-day tomorrow`, `/review-period 2026-10`) or just ask in plain words.

When a request spans periods, the skills run from the largest down: a year before its quarter, a quarter before its month, a month before its week.

---

## Set it up

**1. Have the vault server ready.** Build kb-template's `docs-mcp` as in the [main README](../../README.md#set-it-up). The planning tools need a recent build. If a skill reports that `add_tasks`, `plan_days` or `add_habits` is missing, pull and rebuild kb-template.

**2. Create your `.mcp.json`.** Claude Code reaches the vault server through a `.mcp.json` file at the repository root. The repository doesn't ship one, because it holds your own paths: it is git-ignored. Copy the example and fill in two absolute paths:

```sh
cp .mcp.example.json .mcp.json
```

```json
{
  "mcpServers": {
    "life-vault": {
      "command": "node",
      "args": [
        "/absolute/path/to/kb-template/packages/cli/bin/docs-mcp.js",
        "serve",
        "--vault",
        "/absolute/path/to/your-vault"
      ]
    }
  }
}
```

- Keep the name **`life-vault`**. The skills call its tools as `mcp__life-vault__<tool>`.
- Use **absolute paths**. `~` is not expanded here.
- Use the same vault as `vault` in your `coach.config.json`.
- Never leave out `--vault`: without it, `docs-mcp serve` starts kb-template's documentation server instead of the vault server.

Prefer the command line? This registers the same server in your own Claude Code settings instead of a file:

```sh
claude mcp add life-vault -- node /absolute/path/to/kb-template/packages/cli/bin/docs-mcp.js serve --vault /absolute/path/to/your-vault
```

**3. Approve and check it.** Start Claude Code in the ai-coach folder. It asks once whether to trust the `life-vault` server from `.mcp.json`: say yes. Then run `/mcp` (or `claude mcp list` in a shell): `life-vault` should show as connected. Ask "what's on today?" to try it.

**4. Set up `Plans/`.** `coach init` (or the server's `init_vault` tool) creates `Plans/` with its templates. Your first `plan-year`, `plan-month` or `plan-week` creates the plans themselves.

**5. Write down your rules.** Edit [`vault-planning/rules.md`](vault-planning/rules.md): see [Make the rules yours](#make-the-rules-yours).

To view your plans in a browser, run `npm run coach -- view` and open http://127.0.0.1:4747/plans.

---

## The planning model

The model belongs to kb-template (its ADR-KI-0062, 0064 and 0065). In short:

| Thing          | Where in the vault                                                                         | Is                                                                         |
| -------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Project**    | `1.Projects/<P>/<P>.md`                                                                    | something with an end: `status`, `deadline` and `done_when` in frontmatter |
| **Workstream** | `1.Projects/<P>/Workstreams/<W>.md`, or a folder `<W>/<W>.md`                              | a part of a project that is finished on its own                            |
| **Area**       | `2.Areas/<A>.md`                                                                           | a standard you keep up, with no end date                                   |
| **Plan**       | `Plans/Yearly/2027.md` … `Plans/Weekly/2026-W45.md`, `Plans/Daily/2026-11-03.md`           | the goals and reviews of one period                                        |
| **Task**       | a line in its owner's note, in [Obsidian Tasks](https://publish.obsidian.md/tasks/) syntax | `- [ ] Order stickers #S ⏳ 2026-11-03`                                    |
| **Habit**      | a line under `## Habits` in its owner's note                                               | `- Up at 6:00 🔁 every day`, checked off in each day plan                  |

**Goals chain upward.** Each goal is an outcome you can check at the end of its period. Its first link is the owner it counts for, and `↑` links the goal it serves one level up:

```markdown
- [ ] Talks announced [[Talks]] ↑ [[2026-11#^conference-delivered]] ^talks-announced
```

**Tasks never link goals.** A task serves a goal through their shared owner: a week goal on `[[Talks]]` is served by the tasks in `Talks.md` scheduled that week.

**Closing a period.** Rolling over a week, month or quarter moves its open tasks to the next period's first day, marked `⏫ #slipped/<period>`, and copies its open goals forward. Two slip tags mean a task slipped twice and needs a decision. A day never slips, a year never rolls over (each goal is kept, dropped or rewritten by hand), and a habit not ticked is a missed day, never carried over.

**Effort is size-weighted.** `#S` counts 1, `#M` 3, `#L` 8. Reviews report effort per project, workstream and area as points, not hours.

The full model, with every task signifier, is in [`vault-planning/conventions.md`](vault-planning/conventions.md).

---

## Make the rules yours

[`vault-planning/rules.md`](vault-planning/rules.md) holds your own planning rules. Every skill reads it, and its rules win over general planning advice. It ships with sensible defaults and clearly marked examples:

| Rule                         | Default                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| **Load**                     | Day load is shown as information and never used to argue you out of a full day.                  |
| **Lead times first**         | Orders, prints and anything waiting on another person go early in the week.                      |
| **Chase blockers first**     | The chase goes on day one, the work that depends on it last.                                     |
| **Graphic before post**      | A graphic is scheduled on an earlier day than its post.                                          |
| **Posting cap** (example)    | At most 4 social posts a day in fixed slots. Delete it if you don't post.                        |
| **Where work belongs**       | One-off effort in a workstream, repeating upkeep in an area, personal habits in a habit project. |
| **Known projects** (example) | A snapshot of your projects, so Claude uses their exact names.                                   |

Change them freely. When you tell Claude a new rule during a session, it follows it straight away and offers to add it to the file.

To keep your own rules out of a public fork, add `.claude/skills/vault-planning/rules.md` to your local `.git/info/exclude` after editing it, or keep the shipped file generic and tell Claude your specifics in the session.

---

## Safety

- **Preview, show, confirm, execute.** Every write tool runs once as a preview. Claude shows you which lines change in which notes, and executes only after your yes.
- **Your edits in Obsidian are never overwritten.** Each preview returns a version hash of every note it would change. The skills pass them back on execute, and the server refuses the write if a note changed in between. Claude then previews again and shows you what's different.
- **Vault files are never touched directly.** The skills' `allowed-tools` are read-only planning tools. Every write tool asks for Claude Code's permission as well as yours.
- **What no tool can do becomes a hand edit.** For example, ticking a repeating `🔁` task so that Obsidian Tasks writes its next occurrence. Claude gives you the exact note, place and line, and you make the change in Obsidian.
- **What Claude reads, its model sees.** Planning runs on whatever model Claude Code uses, so the notes the skills read are sent to it. The coach's offline guarantee covers the `coach` CLI, not these skills.

---

## How the skills are built

```text
.claude/skills/
├── vault-planning/
│   ├── SKILL.md         shared rules and which skill does what
│   ├── conventions.md   the planning model: structure, task and goal lines, the chain
│   ├── tools.md         every planning tool: arguments, traps, ordering, the hand edit
│   └── rules.md         your scheduling rules
├── plan-day/  plan-week/  plan-month/  plan-quarter/  plan-year/
├── add-task/  set-goal/  organize-projects/
└── review-period/
```

Each `SKILL.md` has a frontmatter `description` (when Claude should use it), an `argument-hint`, and `allowed-tools` (the read tools it may call without asking). Each one starts by reading `vault-planning`, then walks through numbered steps with explicit **Ask** points where it stops for you.

The decisions behind them are [ADR-0029](../../docs/adr/0029-plan-the-vault-with-agent-skills-through-the-vault-tools-only.md) (skills, not CLI commands, and the vault only through the server), [ADR-0030](../../docs/adr/0030-plan-the-vault-with-the-full-set-of-vault-planning-tools.md) (the full tool set and passing versions back) and [ADR-0031](../../docs/adr/0031-plan-habits-as-definitions-checked-off-per-day-never-carried-over.md) (habits checked off per day).

To change a skill, edit its `SKILL.md`. If kb-template changes a tool's arguments, update `vault-planning/tools.md` first: every skill relies on it.

---

## Troubleshooting

| You see                                              | Try                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Claude says the `life-vault` tools are missing       | Register the server as above, then `/mcp` to reconnect, or restart Claude Code.                       |
| `add_tasks`, `plan_days` or `add_habits` is missing  | Your kb-template build is older than the skills. Pull, `pnpm run build`, reconnect the server.        |
| A write is refused because a note changed            | You edited it in Obsidian after the preview. Let Claude preview again.                                |
| All slipped tasks land on Monday                     | That's what a roll-over does. `plan-week` spreads them out right after; ask it to if it didn't.       |
| A goal reports "links no parent goal"                | There's no plan one level up, or no goal there to link. Run `set-goal` to build the chain.            |
| A task's priority or repeat doesn't show in Obsidian | The signifier order the server writes is untested against your Tasks plugin version. Report the line. |

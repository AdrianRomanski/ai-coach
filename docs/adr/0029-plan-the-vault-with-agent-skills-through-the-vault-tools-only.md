---
id: ADR-0029
title: 'Plan the vault with agent skills that use only the vault tools'
status: superseded
date: 2026-11-01
supersedes: []
superseded_by: ['ADR-0030']
links: ['ADR-0003', 'ADR-0009', 'ADR-0001']
---

# ADR-0029: Plan the vault with agent skills that use only the vault tools

## Context

kb-template's vault server now plans (its ADR-KI-0062): projects, workstreams and areas; year to day plans in `Plans/`; goals linked to an owner and to the goal one level up; and the tools `planning_overview`, `plan_period`, `roll_over`, `review_period` and `harvest_workstream`. From 2026-11-01 the user plans from this repository instead of from a kb-template session. The `coach` CLI calls none of these tools, and the user asked for agent skills for daily, weekly, monthly, quarterly and yearly planning, for adding and connecting tasks, and for setting goals.

The server has no tool to add a task line to an existing note, edit a task or goal line, set a note's frontmatter, or schedule one of several identical tasks. On 2026-11-01 those edits were made by hand in the vault files. The user was offered three ways forward (keep ADR-0003, let ai-coach change kb-template, or let the skills edit task lines directly) and chose on 2026-11-01 to keep ADR-0003.

## Decision

1. **Planning is a set of Claude Code skills in `.claude/skills/`**, not `coach` commands: `vault-planning` (the shared model, tool contracts and the user's rules), `plan-day`, `plan-week`, `plan-month`, `plan-quarter`, `plan-year`, `add-task`, `set-goal`, `organize-projects` and `review-period`.
2. **The skills reach the vault only through the vault server's tools (ADR-0003 stands).** They never read or write vault files directly. The repository's `.mcp.json` registers the server as `life-vault`, with the server and vault paths taken from `DOCS_MCP_BIN` and `DOCS_MCP_VAULT` and defaulting to the sibling checkout and `~/Documents/life-vault`.
3. **What the tools allow, the skills use fully:**
   - new projects, workstreams, areas and task notes are written with `capture` and moved into place with `file_note`; a task note in a folder workstream or a project folder belongs to that owner and can carry the full Tasks syntax, including repeats, subtasks and `🆔`/`⛔` dependencies;
   - one-off tasks with no fitting note are ad-hoc tasks in a plan, linked to their owner;
   - a goal that links a workstream and an area puts the first link in its text, so the workstream stays the owner.
4. **What the tools can't do becomes a hand edit:** the skill shows the note, the place and the exact line before and after, and the user makes the change in Obsidian. The skills never claim a change they did not make.
5. **Every write previews first and executes only after the user says yes (ADR-0009).** A batch of previews shown together may be confirmed once.
6. **The user's planning preferences live in `.claude/skills/vault-planning/rules.md`**, not in the server: lead times first, a graphic before its post, a cap on social media posts a day in fixed slots, habits in a workstream of one personal habit project, and showing a day's load as information, never as pushback.

## Consequences

- Planning works today with no code change in ai-coach or kb-template. The `coach` CLI stays a sparring tool; planning commands there remain possible later behind application ports.
- Some edits stay manual. These are requests for kb-template, not ai-coach work:
  - add a task line to an existing workstream, area or project note;
  - edit a task's or goal's text, size, priority or state, including adding a parent link or a dependency to an existing line;
  - schedule one of several identical tasks, by line number or block id;
  - set `status`, `deadline` and `done_when`, and list a new workstream in its project note;
  - write a plan's `## Review` or a day's `## Log`;
  - plan a run of days in one call;
  - report a task's `🔁` rule in `planning_overview`, which today strips it from the text.
- Ad-hoc tasks live in plans, not in their workstream note, so opening a workstream in Obsidian doesn't show them; reviews and queries still count them.
- The skills depend on the vault server's tool names and argument shapes; a change there needs the skills updated.
- `.mcp.json` is new and shared: anyone opening the repository in Claude Code is asked to approve the `life-vault` server.

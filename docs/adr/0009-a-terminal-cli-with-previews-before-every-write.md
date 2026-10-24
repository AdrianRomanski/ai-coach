---
id: ADR-0009
title: 'Drive the coach from a terminal CLI that previews every write'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0003', 'ADR-0008']
---

# ADR-0009: Drive the coach from a terminal CLI that previews every write

## Context

The talk needs a demo that is easy to run live. Recording a session or moving a note changes the user's vault, so nothing should happen without the user seeing it first.

## Decision

1. The interface is the `coach` terminal app: `due` (default), `list`, `spar`, `judge`, `file`, `capture`, `archive`, `init` and `view` (the vault graph on `http://127.0.0.1:4747/`).
2. **Every write shows a preview and asks first:** the Tier 1 and Tier 2 sessions before they are recorded, and every filing move before it runs. A filing preview with collisions never runs.
3. Answers are multi-line; a blank line sends, `/skip` skips a note, `/quit` stops. `--today` pins the date for demos.
4. Configuration comes from `coach.config.json` in the working directory or `$XDG_CONFIG_HOME/ai-coach/config.json`, or `--config`; environment variables win over the file. Unknown keys are rejected. `coach.config.json` is git-ignored and `coach.config.example.json` shows every option.
5. Each command builds only what it needs, so a missing `OLLAMA_MODEL` or `GEMINI_API_KEY` fails only the command that needs it.
6. Exit codes: 0 success, 1 a known failure with a plain message, 2 a usage error.

## Consequences

- The CLI is a driving adapter only; all logic sits in the use cases (ADR-0008).
- A web or TUI front end would be another driving adapter over the same use cases.

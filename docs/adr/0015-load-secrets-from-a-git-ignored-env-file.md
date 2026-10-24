---
id: ADR-0015
title: 'Load secrets from a git-ignored .env file'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0002', 'ADR-0009']
---

# ADR-0015: Load secrets from a git-ignored .env file

## Context

The judge needs `GEMINI_API_KEY` (ADR-0002). The owner keeps it in `.env` at the repository root, and the CLI read only the shell environment, so the key had to be exported by hand before every `coach judge`.

## Decision

1. `npm run coach` starts the CLI with Node's built-in `--env-file-if-exists=.env`, so variables in `.env` reach the process; a missing file is not an error.
2. Variables already set in the shell win over `.env`, as Node applies them.
3. `.env` and `.env.*` stay git-ignored, and no secret goes into `coach.config.json`, which is git-ignored too but holds settings, not secrets.
4. No dotenv library is added.

## Consequences

- `coach judge` works with the key in `.env` and nothing exported.
- Running `node packages/cli/dist/main.js` directly does not load `.env`; use `npm run coach` or pass the flag.

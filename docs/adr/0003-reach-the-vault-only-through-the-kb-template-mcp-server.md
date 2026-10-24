---
id: ADR-0003
title: "Reach the vault only through kb-template's MCP vault server"
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0007', 'ADR-0008']
---

# ADR-0003: Reach the vault only through kb-template's MCP vault server

## Context

The notes live in an Obsidian vault organised by PARA (`0.Inbox`, `1.Projects`, `2.Areas`, `3.Resources`, `4.Archive`), with sessions under `Coach/`. A separate repository, kb-template, already ships a vault server over MCP (its ADR-KI-0058) that classifies notes, records sessions, derives mastery and builds the Tier 2 payload.

## Decision

1. **ai-coach reads and writes the vault only through that server's tools**, started as `node <kb-template>/packages/cli/bin/docs-mcp.js serve --vault <path>` over stdio. ai-coach never opens vault files, and never writes `Coach/` directly.
2. **ai-coach never changes kb-template.** When the server lacks something, the change is requested and made in kb-template.
3. The vault path is configurable (`--vault` via config, `DOCS_MCP_VAULT`, or the server's own config) and never hard-coded; the server path comes from `DOCS_MCP_BIN` or config.
4. A sparred note is identified by its `coach_id`, not its path, so it keeps its history when moved or renamed.
5. Only notes under `3.Resources` are sparred. Mastery (`unsparred`, `attempted`, `tier1_passed`, `tier2_passed`) is derived by the server from sessions.
6. Every write previews first and writes only with `execute: true`; the CLI shows the preview and asks before executing (ADR-0009).
7. The per-note session history ai-coach needs for scheduling, `read_note`'s `history.entries`, was added to kb-template on request rather than kept locally (ADR-0007).

## Consequences

- The vault server is the single source of truth for notes, sessions and mastery.
- ai-coach depends on a sibling checkout of kb-template, built with `pnpm run build`; nothing is published to a registry.
- Known server gap, reported to kb-template: search folds `ż`, `ó`, `ę`, `ś` but not `ł`.

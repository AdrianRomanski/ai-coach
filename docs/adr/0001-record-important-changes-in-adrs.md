---
id: ADR-0001
title: 'Record every important change in an architecture decision record'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: []
---

# ADR-0001: Record every important change in an architecture decision record

## Context

ai-coach was built in one session from a written brief, and its decisions lived in that conversation, in commit messages and in `ARCHITECTURE.md`. A reader could not tell why a rule exists, which choices were deliberate, or which were later replaced. ADR-0002 to ADR-0011 gather what had been built by 2026-10-24.

## Decision

1. Decisions are recorded as ADRs in `docs/adr/`, one file each, named `NNNN-kebab-title.md` and numbered in order. `template.md` is the shape; `README.md` is the index.
2. **Every important or major change ships with an ADR** in the same commit: a new ADR for a new decision, or a new ADR that supersedes or amends an earlier one. A change is important when it does any of these:
   - changes what the user sees or does: commands, flows, prompts, verdicts, scheduling;
   - changes the architecture: a layer, port, adapter, use case or domain rule;
   - adds, removes or swaps a dependency, model or external service;
   - touches the privacy boundary or what data leaves the machine;
   - changes a contract with kb-template, the config format or stored state;
   - changes how the project is built, tested or worked on;
   - reverses or narrows an existing ADR.
3. Changes that need no ADR: bug fixes that restore what an ADR already says, refactors inside one layer that keep its behaviour, new tests for existing behaviour, typos, formatting, and dependency patch updates. When in doubt, write one; it may be a few lines.
4. An accepted ADR is not rewritten. A changed decision gets a new ADR; the old one gets `status: superseded` and `superseded_by`, and nothing else in it changes.
5. Status is one of `proposed`, `accepted`, `superseded` or `deprecated`. An ADR is `accepted` when the change it describes is committed.
6. The code is the source of truth for how; the ADR is the source of truth for why.

## Consequences

- Important commits carry their reasoning, so reviewers and agents can check a change against its ADR.
- Small fixes stay cheap.
- `CLAUDE.md` and `AGENTS.md` point agents at this rule.

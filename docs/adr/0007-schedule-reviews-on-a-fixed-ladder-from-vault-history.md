---
id: ADR-0007
title: "Schedule reviews on a fixed ladder read from the vault's session history"
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0003', 'ADR-0006']
---

# ADR-0007: Schedule reviews on a fixed ladder read from the vault's session history

## Context

The vault server only compares `next_review` with today; choosing it is ai-coach's job. The schedule should be easy to explain on a slide. Every round runs Tier 1 (which schedules 3 days) before Tier 2, so the last interval cannot tell which step a note was on.

## Decision

1. **Intervals:** any fail, 1 day; a Tier 1 pass, 3 days; a Tier 2 pass moves the note up one rung of 7, 14, 30, 60, 120, 240 and 365 days, and stays at the top.
2. A Tier 2 fail drops the note one rung per gap, at least one. Tier 1 never moves the rung.
3. **The rung is computed from the note's Tier 2 entries in `read_note`'s `history.entries`** on every run. ai-coach keeps no local copy of ladder steps.
4. The ladder is configurable (`ladder` in `coach.config.json`) and validated: whole days, at least 1, Tier 2 steps strictly increasing.
5. Dates are calendar days in `YYYY-MM-DD`, computed in UTC so time zones do not shift them.
6. **The Tier 1 sessions waiting for the judge are kept in a local queue** (`$XDG_STATE_HOME/ai-coach/pending-judgement.json`), each with its notes' `coach_id`s in session order. The judge's verdicts come back by position, and the vault cannot say which item of a multi-note session belongs to which note. The queue holds no note content and is removed per session once judged.

## Consequences

- Scheduling is pure domain code with no state.
- If kb-template adds an item position to each history entry, the queue can be replaced by a vault lookup.
- A lost queue file means those sessions cannot be judged; they stay recorded at Tier 1.

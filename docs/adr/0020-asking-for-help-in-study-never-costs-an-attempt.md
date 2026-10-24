---
id: ADR-0020
title: 'Asking for help in study never costs an attempt, and a bad model reply never ends a session'
status: proposed
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0017', 'ADR-0019']
---

# ADR-0020: Asking for help in study never costs an attempt, and a bad model reply never ends a session

## Context

Stuck on a gap, the owner typed "what precise mechanism are you speaking about - teach me". Study graded it as an explanation, it failed, and the gap was marked still open. Later, a clue Gemma could not phrase as a usable sentence ended the whole study session with an error.

## Decision

1. **A request for help is recognised and answered, not graded.** `/hint`, `?`, "hint", "help", "teach me", "I don't know", "no idea", "what do you mean", "I'm stuck" and similar phrases, alone or inside a longer reply, are a request for help.
2. The answer to a request for help is a one-sentence clue in the round's style, which points where to look without giving the answer, and the author's passage for the gap with its page. It does not count as an attempt; the learner then explains in their own words.
3. Gemma still never explains the answer itself (ADR-0017).
4. **An unusable reply from the study partner never ends the session.** A hint falls back to "How would you explain this point in your own words?", a clue to "Reread the passage below, then explain the gap in your own words.", a quote to none, and a check to a miss with a message saying the coach could not judge the answer. An outage of Ollama still stops the session.

## Consequences

- In a real run, "teach me" showed a clue and the passage and kept both attempts.
- The fallbacks are plain and generic, but the session continues.

---
id: ADR-0005
title: 'Run Tier 1 as a Socratic dialogue with banned buzzwords and bounded follow-ups'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0002', 'ADR-0004']
---

# ADR-0005: Run Tier 1 as a Socratic dialogue with banned buzzwords and bounded follow-ups

## Context

The coach must make the learner explain mechanisms in their own words, not recite terms. A local model left to itself tends to explain, summarise or quote.

## Decision

1. A round opens with one challenge that asks for the central mechanism, then alternates the learner's answer with either one follow-up or a conclusion (`pass` or `fail`, gaps, feedback).
2. **Banned buzzwords are checked locally**, ignoring case and diacritics (including `ł`) and matching whole words only. An answer with one sends the same question back for a rephrase without calling the model. After `maxRephrases` (default 2) the answer is accepted, and the buzzwords used are added to the gaps.
3. At most `maxFollowUps` (default 3) follow-ups; after that the round concludes even if the model wants to probe.
4. A challenge that quotes the note is asked again with the rejected text, up to `maxChallengeAttempts` (default 3); then the round refuses to start. A follow-up that keeps quoting is replaced with a fixed neutral probe.
5. The Socratic rules are given to the model as instructions: one question per turn, never explain or hint, demand the mechanism, define terms plainly, probe the edges, challenge hand-waving.
6. The buzzword list, the rules, the limits and the question language are configurable in `coach.config.json` (`sparring`), with defaults in the domain.
7. The recorded answer is the first answer plus each follow-up and its answer.

## Consequences

- These rules live in the `SparringRound` domain object, so they hold whichever model runs Tier 1.
- The first real run on `gemma3:latest` gave vague gaps and empty feedback; prompt tuning is expected.

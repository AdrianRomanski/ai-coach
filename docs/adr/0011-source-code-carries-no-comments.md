---
id: ADR-0011
title: 'Source code carries no comments'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0001']
---

# ADR-0011: Source code carries no comments

## Context

The owner asked for comment-free code. Reasons belong in ADRs (ADR-0001) and in commit messages, where they are dated and reviewed; comments drift from the code they describe.

## Decision

1. No comments in source code: no `//`, no `/** */`, no explanatory notes in tests or config.
2. A comment is added only when the owner asks for that specific comment.
3. Names, types and small functions carry the meaning instead.

## Consequences

- Generated files from Nx and other tools may carry their own comments; code we write does not.

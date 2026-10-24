---
id: ADR-0010
title: 'Test each layer on its own, and drop tests that need the kb-template server for now'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0004', 'ADR-0008']
---

# ADR-0010: Test each layer on its own, and drop tests that need the kb-template server for now

## Context

The layers of ADR-0008 can each be tested without the others. Tests that start kb-template's vault server need a sibling checkout and a build, which CI does not have.

## Decision

1. **Domain:** plain tests of functions and objects.
2. **Use cases:** tests against in-memory adapters in `application/src/testing`, kept out of the library build. They include a check that a private line planted in a note never reaches the judge.
3. **Adapters, against the real technology:** a loopback HTTP server for Ollama with all other traffic blocked (the offline test), the real Gemini SDK with a fake client, and a temporary directory for the local queue.
4. **Tests that start the kb-template vault server are dropped for now:** the two `adapter-vault-mcp` integration tests and the two CLI end-to-end tests, including the privacy test that wired every real adapter and checked a planted sentinel reached Gemma and never Gemini. `adapter-vault-mcp` has no tests and passes with none.
5. Tests never point at the user's real vault.

## Consequences

- `nx run-many -t test` needs nothing outside the repository.
- No test exercises `McpVault` or the CLI end to end, and the full-chain privacy test of ADR-0004 is gone. It can return without the server by wiring the real Ollama and Gemini adapters to an in-memory vault.

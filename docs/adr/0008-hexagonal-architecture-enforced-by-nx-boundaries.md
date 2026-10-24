---
id: ADR-0008
title: 'Structure ai-coach as ports and adapters, enforced by Nx module boundaries'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0003', 'ADR-0004', 'ADR-0010']
---

# ADR-0008: Structure ai-coach as ports and adapters, enforced by Nx module boundaries

## Context

The first build split the code by feature (`vault-client`, `sparring-partner`, `external-judge`, `scheduler`, `coach`), and business rules sat next to Ollama, Gemini and MCP code. Swapping a model or the vault transport would have touched the rules, and nothing stopped a rule from importing an SDK. The restructure followed ten references on hexagonal architecture, DDD and Nx boundaries (Cockburn, Graça, Sairyss's domain-driven-hexagon, the Netflix case study, Angular Atlas, Marmicode, the Nx docs and others).

## Decision

1. The workspace is an Nx monorepo on npm workspaces, TypeScript, Vitest and ESLint, with seven projects:

   | Project               | Tags                                  | Holds                                                                                                                                             |
   | --------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `domain`              | `type:domain`                         | Rules that guard themselves: `SparringRound`, sparring rules, buzzword and verbatim checks, the review ladder, the verdict rule, `tier2Payload()` |
   | `application`         | `type:application`                    | Use cases (`Sparring`, `SparringConversation`, `Judging`, `Review`, `Filing`) and the ports they need                                             |
   | `adapter-vault-mcp`   | `type:adapter`, `adapter:vault-mcp`   | `McpVault` over kb-template's MCP server                                                                                                          |
   | `adapter-ollama`      | `type:adapter`, `adapter:ollama`      | `OllamaSparringPartner`, prompts and the loopback guard                                                                                           |
   | `adapter-gemini`      | `type:adapter`, `adapter:gemini`      | `GeminiJudge` and the judge protocol                                                                                                              |
   | `adapter-local-state` | `type:adapter`, `adapter:local-state` | The pending-judgement queue and the clock                                                                                                         |
   | `cli`                 | `type:app`                            | Terminal, config, commands and `composeCoach`, the composition root                                                                               |

2. **Dependencies point inward.** Ports are TypeScript interfaces shaped by what the use cases need; there is no DI container, so the composition root binds them by hand.
3. Adapters translate technology failures into application errors (`UnavailableError`, `UnusableReplyError`, `VaultRefusedError`); the CLI maps those to messages and exit codes.
4. **`@nx/enforce-module-boundaries` enforces it on `lint`:** inward-only tags, no adapter importing another adapter, no circular dependencies, and an `allowedExternalImports` whitelist per tag (none for `domain` and `application`; only its own SDK, `zod` and Node for each adapter).
5. `no-restricted-imports` bans Node built-ins in `domain` and `application`, which the whitelist does not cover.
6. `ARCHITECTURE.md` describes the layout; this ADR records why.

## Consequences

- A new model or transport is a new adapter plus one line in `composeCoach`.
- Each boundary rule was checked by planting a violation and seeing lint fail.
- CI already runs `lint`, so the rules hold there too.

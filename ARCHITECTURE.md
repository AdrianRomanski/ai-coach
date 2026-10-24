# Architecture

ai-coach is a ports-and-adapters (hexagonal) application. The core knows nothing about MCP, Ollama, Gemini, the file system or the terminal; those sit behind ports the core defines, and one composition root wires them together.

```
                    driving side                      driven side
                                         ┌──────────────────────────────┐
  terminal ──► cli ──► application ──►   │ NotesRepository, SessionLog,  │ ◄── adapter-vault-mcp   (kb-template over MCP)
             (composition root)   │      │ VaultFiling                   │
                                  │      │ SparringPartner               │ ◄── adapter-ollama      (local Gemma, loopback only)
                                  ▼      │ Judge                         │ ◄── adapter-gemini      (Gemini Argon)
                                domain   │ PendingJudgements, Clock      │ ◄── adapter-local-state (queue file, clock)
                                         └──────────────────────────────┘
```

## Projects

| Project               | Tag                                   | Contains                                                                                                                                                             | May import                                      |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `domain`              | `type:domain`                         | The sparring round aggregate, sparring rules, buzzword and verbatim checks, the review ladder, the judge's verdict rule, the Tier 2 payload invariant, domain errors | `domain` only; no npm package, no Node built-in |
| `application`         | `type:application`                    | Use cases (`Sparring`, `SparringConversation`, `Judging`, `Review`, `Filing`), the ports they need, application errors                                               | `domain`; no npm package, no Node built-in      |
| `adapter-vault-mcp`   | `type:adapter`, `adapter:vault-mcp`   | `McpVault`: the vault ports over kb-template's MCP server                                                                                                            | core; `@modelcontextprotocol/sdk`, `zod`, Node  |
| `adapter-ollama`      | `type:adapter`, `adapter:ollama`      | `OllamaSparringPartner`: prompts, fencing, structured replies, the loopback-only guard                                                                               | core; `zod`, Node                               |
| `adapter-gemini`      | `type:adapter`, `adapter:gemini`      | `GeminiJudge`: the blind claim-extraction protocol, fallback model, boundary re-check of the payload                                                                 | core; `@google/genai`, `zod`, Node              |
| `adapter-local-state` | `type:adapter`, `adapter:local-state` | `FilePendingJudgements`, `SystemClock`                                                                                                                               | core; `zod`, Node                               |
| `cli`                 | `type:app`                            | Terminal I/O, config, commands, and `composeCoach`, the only place a port meets its adapter                                                                          | everything                                      |

Adapters never import each other, and nothing imports the `cli`.

## Rules

- Dependencies point inward. Ports are shaped by what the use cases need, not by a tool's API.
- Business rules live in the domain, in objects that guard their own invariants: a `SparringRound` will not accept a challenge that quotes the note, and `tier2Payload()` rejects any field other than `challenge` and `answer`.
- Use cases orchestrate: they load through ports, let the domain decide, and save through ports.
- Adapters translate technology failures into application errors (`UnavailableError`, `UnusableReplyError`, `VaultRefusedError`); the CLI turns those into messages and exit codes.
- The only data that may leave the machine is a `Tier2Payload`. The Gemini adapter accepts nothing else and re-checks it.

## Enforcement

`npm exec nx run-many -- -t lint` runs `@nx/enforce-module-boundaries` with the tags above:

- `onlyDependOnLibsWithTags` keeps dependencies inward and stops adapters importing each other.
- `allowedExternalImports` is a whitelist per tag: empty for `domain` and `application`, and only its own SDK for each adapter.
- `no-restricted-imports` bans Node built-ins in `domain` and `application`, which the whitelist does not cover.
- Circular project dependencies are errors.

## Tests

| Level     | Where                                                     | Against                                                                                                    |
| --------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Domain    | `domain`                                                  | Plain functions and objects                                                                                |
| Use cases | `application`                                             | In-memory adapters in `src/testing`, including a check that a planted private line never reaches the judge |
| Adapters  | `adapter-ollama`, `adapter-gemini`, `adapter-local-state` | A loopback HTTP server for Ollama, the real Gemini SDK with a fake client, a temporary directory           |

Tests that start the kb-template vault server (the MCP adapter and end-to-end CLI tests) are dropped for now, so `adapter-vault-mcp` has no tests and passes with none.

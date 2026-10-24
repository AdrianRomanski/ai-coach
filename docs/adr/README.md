# Architecture decision records

Every important or major change to ai-coach ships with an ADR in this folder; ADR-0001 says which changes count. Copy `template.md`, take the next number, and add a line below.

| ADR                                                                           | Decision                                                                            | Status   |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| [0001](0001-record-important-changes-in-adrs.md)                              | Record every important change in an architecture decision record                    | accepted |
| [0002](0002-two-tier-coach-offline-gemma-and-zero-knowledge-gemini.md)        | Coach in two tiers: offline Gemma, zero-knowledge Gemini Argon                      | accepted |
| [0003](0003-reach-the-vault-only-through-the-kb-template-mcp-server.md)       | Reach the vault only through kb-template's MCP vault server                         | accepted |
| [0004](0004-only-the-tier2-payload-leaves-the-machine.md)                     | Only the Tier 2 payload leaves the machine                                          | accepted |
| [0005](0005-tier1-socratic-dialogue-rules.md)                                 | Run Tier 1 as a Socratic dialogue with banned buzzwords and bounded follow-ups      | accepted |
| [0006](0006-blind-claim-extraction-and-the-verdict-rule.md)                   | Judge Tier 2 by blind claim extraction, and pass only flawless answers              | accepted |
| [0007](0007-schedule-reviews-on-a-fixed-ladder-from-vault-history.md)         | Schedule reviews on a fixed ladder read from the vault's session history            | accepted |
| [0008](0008-hexagonal-architecture-enforced-by-nx-boundaries.md)              | Structure ai-coach as ports and adapters, enforced by Nx module boundaries          | accepted |
| [0009](0009-a-terminal-cli-with-previews-before-every-write.md)               | Drive the coach from a terminal CLI that previews every write                       | accepted |
| [0010](0010-test-each-layer-and-drop-server-dependent-tests-for-now.md)       | Test each layer on its own, and drop tests that need the kb-template server for now | accepted |
| [0011](0011-source-code-carries-no-comments.md)                               | Source code carries no comments                                                     | accepted |
| [0012](0012-spar-book-chapters-never-the-book-index.md)                       | Spar book chapters, never the book index                                            | accepted |
| [0013](0013-set-gemma-context-window-explicitly.md)                           | Set Gemma's context window explicitly and refuse prompts that would not fit         | accepted |
| [0014](0014-anchor-tier1-on-a-focus-and-keep-the-note-out-of-the-dialogue.md) | Anchor Tier 1 on a focus, and keep the note out of the challenge and the dialogue   | accepted |

# @ai-coach/adapter-vault-mcp

**The bridge to your Obsidian vault.** ai-coach never opens the files in your vault itself. Every read and every change goes through the vault server from **kb-template**, which this package starts and talks to over [MCP](https://modelcontextprotocol.io).

That keeps one program in charge of your vault: it knows the folder layout, keeps sparring history, checks quotes against books and refuses unsafe moves. ai-coach just asks.

## What it lets the coach do

| The coach wants to…                       | Vault server tool                                       |
| ----------------------------------------- | ------------------------------------------------------- |
| list notes and read one, with its history | `list_notes`, `read_note`                               |
| see what's due for review                 | `due_for_review`                                        |
| record a sparring or judging session      | `record_session`                                        |
| get exactly what may be sent to the judge | `tier2_payload`                                         |
| file, capture, archive, set up PARA       | `file_note`, `capture`, `archive_project`, `init_vault` |
| see where each book stands                | `reading_progress`                                      |
| find a passage in a book                  | `find_passages`                                         |
| write a concept note                      | `create_concept`                                        |

Every tool that writes **previews first**. ai-coach only executes after you confirm in the terminal.

## Setting it up

Check out and build kb-template, then point ai-coach at its server and your vault:

```json
{
  "vault": "~/Documents/my-vault",
  "docsMcpBin": "~/projects/kb-template/packages/cli/bin/docs-mcp.js"
}
```

or with environment variables: `DOCS_MCP_VAULT` and `DOCS_MCP_BIN`.

If `docsMcpBin` is left out, ai-coach looks for kb-template at `~/projects/kb-template`.

## Good to know

- **Everything that comes back is checked.** Replies are validated against a schema. If kb-template changes a reply's shape, you get a clear "unexpected response from the vault server" error rather than odd behaviour.
- **Refusals come through as they are.** When the server refuses something (a quote not found in the book, a name collision), you see its own explanation as a `VaultRefusedError`.
- **If something is missing, change kb-template, not this package.** New vault abilities belong in kb-template's server. This package only wraps what the server offers.
- **Server problems are easy to see.** If the server won't start, the error includes the end of its log.

## Classes

| Class         | What it is                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| `McpVault`    | What the coach uses: implements the application's vault and library ports. |
| `VaultClient` | A thin, typed wrapper around each vault server tool.                       |

## Tests

There are no automated tests here for now. They would need a running kb-template server (see ADR-0010). Try changes by hand against a **copy** of a vault, never your real one.

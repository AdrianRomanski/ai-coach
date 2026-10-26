# @ai-coach/cli

**The `coach` command.** This is the part you actually use: it reads your configuration, connects the vault, the local model and the judge, and walks you through each session in the terminal.

For a full tour of the commands, see the [main README](../../README.md#commands).

## Running it

From the repository root, after building:

```sh
npm run coach -- <command> [options]
```

`npm run coach` also loads `.env` from the repository root, which is where `GEMINI_API_KEY` lives.

```sh
npm run coach                       # what's due today
npm run coach -- distill            # turn your book marks into concept notes
npm run coach -- spar               # spar what's due
npm run coach -- spar --style devil # …in devil's-advocate style
npm run coach -- judge              # judge waiting sessions (online)
npm run coach -- study "3.Resources/Concepts/Layers of a Note.md"
npm run coach -- due --today 2026-11-01
```

## How a session feels

- **Answers can be several lines.** An empty line sends.
- **`/skip`** moves on, and **`/quit`** stops. Nothing is recorded unless you confirm.
- **Every change is previewed:** sessions to record, notes to write, files to move. You answer `y` or `n`, and `Enter` takes the default shown in capitals (`[Y/n]` or `[y/N]`).
- **After a fail, the coach offers to study the gaps right away.**
- **When you finish a study session**, the coach offers to keep your explanations as a note in `0.Inbox`.
- **Colours show how well you know a note:** dim for never sparred, red for attempted, yellow for a Tier 1 pass, green for a Tier 2 pass.

## Configuration

The CLI finds its settings in `--config <file>`, then `./coach.config.json`, then `~/.config/ai-coach/config.json`. Environment variables override the file. Every setting is explained in the [main README](../../README.md#configuration).

A minimal file:

```json
{
  "vault": "~/Documents/my-vault",
  "ollama": { "model": "gemma3:latest" }
}
```

Mistakes in the file are reported clearly, with the setting that's wrong.

## What's inside

| File (in `src/lib/`, `main.ts` in `src/`) | What it does                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `main.ts`                                 | The entry point.                                                                                |
| `cli.ts`                                  | Parses the command line, shows help, and turns errors into readable messages.                   |
| `config.ts`                               | Finds and checks the configuration and applies environment variables.                           |
| `composition.ts`                          | Plugs the real adapters into the use cases. The one place where everything meets.               |
| `commands.ts`                             | Each command's conversation: due, list, spar, judge, study, file, capture, archive, init, view. |
| `distill.ts`                              | The `distill` conversation.                                                                     |
| `terminal.ts`                             | Reading answers, confirmations and colours.                                                     |

To add a command, write its conversation in `commands.ts` (or its own file), register it in `cli.ts`, and add a line to the help text.

## Tests

```sh
npx nx test @ai-coach/cli
```

The tests drive commands with a scripted terminal and stubbed use cases, so they need no vault, Ollama or Gemini.

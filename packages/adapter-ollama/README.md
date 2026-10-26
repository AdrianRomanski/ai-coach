# @ai-coach/adapter-ollama

**The local sparring partner.** Everything the coach asks you during sparring, studying and distilling comes from a Gemma model running on your own machine through [Ollama](https://ollama.com). Your notes never leave the computer.

## What it does

| Class                   | Its job                                                                                                                                                 | Used by          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `OllamaSparringPartner` | Writes the opening challenge and the follow-up questions, and decides the Tier 1 verdict. Each gap it raises is checked against what you actually said. | `coach spar`     |
| `OllamaStudyPartner`    | Gives a guiding question per gap, a clue when you ask for help, and checks whether your new explanation closes the gap.                                 | `coach study`    |
| `OllamaStyleClassifier` | Reads a note and picks the coaching style that suits it, when you haven't chosen one.                                                                   | spar, study      |
| `OllamaDistillPartner`  | Groups your marks into ideas, asks gap questions, drafts core assertions from your words, and suggests buzzwords.                                       | `coach distill`  |
| `OllamaClient`          | The shared connection to Ollama, with retries and checks on what comes back.                                                                            | all of the above |

All the prompts are in `prompts.ts`, so tuning how the coach talks starts there.

## Setting it up

```sh
ollama pull gemma3
```

Then set the model in `coach.config.json`:

```json
{ "ollama": { "model": "gemma3:latest", "contextWindow": 16384 } }
```

| Setting         | Default                  | Notes                                                            |
| --------------- | ------------------------ | ---------------------------------------------------------------- |
| `model`         | (required)               | Any name from `ollama list`.                                     |
| `host`          | `http://127.0.0.1:11434` | Must be your own machine (see below).                            |
| `contextWindow` | `16384`                  | How many tokens Gemma reads at once. Raise it for long chapters. |

## Good to know

- **It refuses to go online.** The host must be `http` on `127.0.0.1`, `localhost` or `::1`. Anything else stops with `Tier 1 runs offline…`. This keeps the promise that your notes stay local.
- **Your notes are treated as data, never as instructions.** Note text, transcripts and marks are wrapped in tags with a random marker, so a note saying "ignore your instructions" has no effect.
- **The coach doesn't quote your note back to you.** If a question copies the note's wording, it's rewritten. If that keeps happening, the note is skipped with `ChallengeLeakError`.
- **Too long?** If a note won't fit in the context window, you get a clear `ContextTooSmallError` rather than a silently cut-off note.
- **Small models make mistakes.** Every reply is checked: right shape, a real question where a question is expected, no filler. A bad reply is retried once, and the use case falls back gracefully if it's still unusable.

## Tests

```sh
npx nx test @ai-coach/adapter-ollama
```

The tests use a tiny local HTTP server in place of Ollama, so they don't need Ollama or a model.

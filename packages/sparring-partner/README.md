# @ai-coach/sparring-partner

Tier 1: the offline sparring partner. It runs a Socratic, Feynman-style dialogue over one note with a local Gemma model served by Ollama.

## Configuration

| Variable       | Meaning                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `OLLAMA_MODEL` | The Gemma model, as `ollama list` shows it. Required.                          |
| `OLLAMA_HOST`  | Defaults to `http://127.0.0.1:11434`. Only plain http on loopback is accepted. |

`sparringConfig()` sets the banned buzzwords, the Socratic rules, how many follow-ups and rephrases are allowed, and the language of the questions.

## How a round works

1. `start()` asks Gemma for one opening challenge about the note.
2. `answer(text)` checks the learner's words for banned buzzwords locally. A buzzword sends the same question back for a rephrase, without calling the model.
3. Gemma either probes the weakest point with one follow-up or concludes with `pass` or `fail` and the gaps it found.
4. `result()` gives the challenge, the learner's answers and the verdict, ready for `record_session`.

## Guarantees

- **Offline.** The only network target is Ollama on loopback; any other host is refused before a request is made. The offline test disables every non-loopback request and runs a full round.
- **Notes are data.** Each note is fenced in tags carrying a random nonce, and anything in the note that looks like a closing tag is neutralised, so a note cannot end its own fence and issue instructions.

## The privacy limit

The Tier 2 payload carries Tier 1's challenge and the learner's answer, and the challenge is written from the note. So the judge never sees the note, but it does see a question shaped by it.

What this package does about it: the prompts forbid quoting or closely paraphrasing the note, and every challenge and follow-up is checked against the note body. A challenge that shares a run of `verbatimRunWords` (default 6) words with the note is sent back for a rewrite; after `maxChallengeAttempts` the round refuses to start. A follow-up that keeps quoting is replaced with a neutral probe.

What it cannot do: stop a challenge from naming the topic, or from paraphrasing an idea loosely. Treat the challenge as a description of what the note is about. The learner's answer is their own writing and goes to the judge as written.

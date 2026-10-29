# @ai-coach/application

**The things you can do with the coach**, written once and independent of any particular model, vault or screen.

Each command you type in the terminal maps to one _use case_ here. A use case describes what it needs ("something that can read notes", "a sparring partner", "a judge") as an interface, called a **port**. The adapter packages provide the real implementations, and the `cli` package plugs them in.

## The use cases

| Use case         | What it does                                                                                                                                                   | Behind the command                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Review**       | Lists what's due today, what was never sparred, what's waiting for the judge, and what's waiting to be filed.                                                  | `coach due`, `coach list`                  |
| **Sparring**     | Picks the notes to spar, runs each conversation, plans the session with next review dates, records it after you confirm, and queues it for the judge.          | `coach spar`                               |
| **Judging**      | Takes queued sessions, builds the privacy-checked payload, asks the judge, applies the verdict rule and records the result.                                    | `coach judge`                              |
| **Studying**     | Walks the gaps of a note's latest failed session with hints, the author's passage and a limited number of tries. Can keep your explanations as a new note.     | `coach study`                              |
| **Synthesizing** | Finds a book, gathers your marks and reading notes, proposes ideas, asks gap questions, drafts assertions and quotes, then previews and writes a concept note. | `coach synthesize`                         |
| **Filing**       | Previews and applies moves in the vault: file, capture, archive, set up PARA.                                                                                  | `coach file`, `capture`, `archive`, `init` |

## The ports

These are the interfaces an adapter has to provide:

| Port                                                                     | Provided by           | In plain words                               |
| ------------------------------------------------------------------------ | --------------------- | -------------------------------------------- |
| `NotesRepository`, `SessionLog`, `VaultFiling`                           | `adapter-vault-mcp`   | read notes, record sessions, move notes      |
| `Library`                                                                | `adapter-vault-mcp`   | books, passage search, writing concept notes |
| `SparringPartner`, `StudyPartner`, `StyleClassifier`, `SynthesisPartner` | `adapter-ollama`      | the local model, in its different jobs       |
| `Judge`                                                                  | `adapter-gemini`      | the online judge                             |
| `PendingJudgements`, `Clock`                                             | `adapter-local-state` | the judge's queue, and today's date          |

## Using it

Create a use case with whatever implements its ports. This is how the CLI does it:

```ts
import { Studying } from '@ai-coach/application';

const studying = new Studying({
  notes: vault,
  partner: studyPartner,
  classifier,
  rules,
});
const { note, session } = await studying.open(path);
```

## Errors you'll meet

All errors extend `ApplicationError` and carry a message that's fine to show to a user:

| Error                  | Means                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| `UnavailableError`     | Ollama, Gemini or the vault server can't be reached.                      |
| `UnusableReplyError`   | A model answered with something unusable, even after a retry.             |
| `VaultRefusedError`    | The vault server said no, e.g. a quote that isn't in the book.            |
| `NotFoundError`        | No note, session or book matches what you asked for.                      |
| `NotSparrableError`    | The note is outside `3.Resources`, or is raw source material.             |
| `ChallengeLeakError`   | The model kept quoting the note in its question, so the note was skipped. |
| `PayloadMismatchError` | What would be sent to the judge doesn't match what was recorded.          |
| `ContextTooSmallError` | The note is too long for the model's context window.                      |

Most use cases recover from an unusable model reply on their own, with a sensible fallback, rather than ending your session.

## Good to know

- **No Node built-ins and no SDKs here.** Lint enforces it. Anything that touches the outside world is a port.
- **In-memory fakes** for every port live in `src/testing/in-memory.ts`: a vault, a library, scripted partners and judge, a fixed clock. They're for tests only and aren't part of the build.

## Tests

```sh
npx nx test @ai-coach/application
```

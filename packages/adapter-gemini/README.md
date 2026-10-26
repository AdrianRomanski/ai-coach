# @ai-coach/adapter-gemini

**The online judge.** After you've sparred offline, `coach judge` sends your answers to Google's Gemini for a stricter, independent check.

The judge **never sees your notes**. It gets only the questions you were asked, your answers and, unless you turn it off, the idea's core assertions. So it judges your reasoning on its own merits. An answer copied from the note gains nothing, because the judge has no note to compare it with.

## What the judge does

For each answer, the judge:

1. breaks it into separate **claims**, each marked as a mechanism, an assertion or a definition,
2. checks each claim for **fallacies** (from a fixed list of 12) and **hand-waving**,
3. lists the **gaps**: what the question asked that your answer doesn't explain,
4. gives a verdict and a one-sentence reason.

The verdict rule is then applied on top: **a pass stands only if no claim is flawed and no gap remains.** If the model said "pass" but flaws remain, you'll see `(judge said pass, but flaws remain)`.

## Setting it up

Put your key in `.env` in the repository root (git ignores it):

```sh
GEMINI_API_KEY=your-key-here
```

Optional settings in `coach.config.json`:

```json
{
  "judge": {
    "model": "gemini-4-argon",
    "fallbackModel": "gemini-3.8-flash",
    "thinkingLevel": "MEDIUM",
    "includeAssertions": true
  }
}
```

| Setting             | Default          | Notes                                                                            |
| ------------------- | ---------------- | -------------------------------------------------------------------------------- |
| `model`             | `gemini-4-argon` | The main judge model.                                                            |
| `fallbackModel`     | none             | Tried once if the main model is overloaded or failing (rate limit or 5xx error). |
| `thinkingLevel`     | `MEDIUM`         | `HIGH` thinks harder and takes longer.                                           |
| `includeAssertions` | `true`           | Set to `false` to keep the idea's core assertions on your machine too.           |

## Good to know

- **Only the payload leaves your machine.** It's built and re-checked in the domain, so nothing else can slip in.
- **Your answers are data, not instructions.** They're wrapped in tags with a random marker, so an answer can't tell the judge what to decide.
- **One request per session.** All answers of a session are judged together and must come back in the same order. A malformed reply is retried once.
- **Nothing is lost if it fails.** Sessions stay queued until they're judged and recorded.

## Tests

```sh
npx nx test @ai-coach/adapter-gemini
```

The tests use a fake client, so they never call Gemini or need a key.

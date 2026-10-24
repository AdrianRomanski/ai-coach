# @ai-coach/external-judge

Tier 2: the zero-knowledge judge. It sends one session's `tier2_payload` to Gemini and returns a verdict per item. This is the only package that imports `@google/genai`.

## Configuration

| Variable                      | Meaning                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`              | Gemini Developer API key from Google AI Studio. Read by `new GoogleGenAI()`; Vertex AI is switched off. If `GOOGLE_API_KEY` is also set, the SDK uses that one instead. |
| `GEMINI_JUDGE_MODEL`          | Defaults to `gemini-4-argon`.                                                                                                                                           |
| `GEMINI_JUDGE_FALLBACK_MODEL` | Optional, e.g. `gemini-3.8-flash`. Used when the main model answers 429 or 5xx, or cannot be reached.                                                                   |
| `GEMINI_JUDGE_THINKING_LEVEL` | `MEDIUM` (default) or `HIGH`.                                                                                                                                           |

## Blind claim extraction

The judge never sees a note. For each `{ challenge, answer }` it returns:

- `claims`: every atomic claim in the answer, as `mechanism`, `assertion` or `definition`, with `supported`, `fallacies` (from a fixed list) and `handWave`
- `gaps`: what the challenge asks that the answer does not explain
- `verdict` and a one-sentence `reason`

The model's `pass` is kept only when no claim has a fallacy or a hand-wave and no gap is left; otherwise the verdict becomes `fail`. The model's own verdict stays in `modelVerdict`. `sessionGaps()` turns a judgement into the gaps recorded with the Tier 2 session.

## Privacy

`judge()` accepts only the exact `tier2_payload` shape and rejects any extra field, at any level. Items are fenced as untrusted data. `privacy.spec.ts` runs the real vault server, plants a sentinel line in a note, runs Tier 1 on it, records the session, and checks every request the Gemini SDK sends: the challenge and answer are there, and the sentinel, the note's title, folder, path, body, `coach_id` and `session_id` are not.

The challenge itself is written by Tier 1 from the note; see the privacy limit in the sparring-partner README.

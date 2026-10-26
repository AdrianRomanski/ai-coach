# @ai-coach/adapter-local-state

**ai-coach's own small memory**, kept outside your vault.

Sparring works offline, but judging needs the internet. So after each sparring session, ai-coach writes down that the session is **waiting for the judge**. The next time you run `coach judge`, it picks up everything still waiting, even days later or after a failed attempt.

## What it stores

| Class                   | What it does                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `FilePendingJudgements` | Keeps the list of sessions waiting for the judge in `pending-judgement.json`.                          |
| `SystemClock`           | Tells the coach what day it is. `--today YYYY-MM-DD` on the command line makes it pretend another day. |

The file lives in:

- `stateDir` from your configuration, if you set it, otherwise
- `$XDG_STATE_HOME/ai-coach/`, otherwise
- `~/.local/state/ai-coach/`.

It's a small, readable JSON file:

```json
{
  "sessions": [{ "sessionId": "…", "date": "2026-10-25", "coachIds": ["…"] }]
}
```

## Good to know

- **Your progress isn't stored here.** Verdicts, gaps and review dates live in the vault's session history. Deleting this file only means `coach judge` won't know about sessions that are still waiting.
- **Writes are safe.** The file is replaced in one step, so an interrupted run can't leave it half-written. If it's ever damaged, ai-coach says so instead of guessing.

## Tests

```sh
npx nx test @ai-coach/adapter-local-state
```

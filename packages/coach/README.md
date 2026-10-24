# @ai-coach/coach

The `coach` terminal app. It ties the vault server, the offline sparring partner, the judge and the scheduler together.

## Setup

1. Build kb-template's vault server: `pnpm run build` in `~/projects/kb-template`.
2. Install Ollama and pull a Gemma model; set `OLLAMA_MODEL` to its name in `ollama list`.
3. For Tier 2, export `GEMINI_API_KEY` (Google AI Studio).
4. Copy `coach.config.example.json` to `coach.config.json` (or `~/.config/ai-coach/config.json`) and adjust it.
5. Build: `npm exec nx run-many -- -t build`, then run `npm run coach -- <command>`.

Environment variables win over the config file: `DOCS_MCP_VAULT`, `DOCS_MCP_BIN`, `OLLAMA_MODEL`, `OLLAMA_HOST`, `GEMINI_JUDGE_MODEL`, `GEMINI_JUDGE_FALLBACK_MODEL`, `GEMINI_JUDGE_THINKING_LEVEL`.

## Commands

| Command                      | What it does                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `coach` or `coach due`       | Notes due for review, notes never sparred, and sessions waiting for the judge                          |
| `coach list`                 | Every Resources note with its mastery and next review                                                  |
| `coach spar [ref ...]`       | Tier 1, offline. Without refs it offers the due and never-sparred notes; refs are paths or `coach_id`s |
| `coach judge [session ...]`  | Tier 2, online. Judges the Tier 1 sessions waiting in the queue                                        |
| `coach file <note> <folder>` | Moves a note, after showing the preview                                                                |
| `coach capture <title>`      | Writes a new note into `0.Inbox`                                                                       |
| `coach archive <project>`    | Moves a project folder into `4.Archive`                                                                |
| `coach init`                 | Brings the vault onto the five PARA folders                                                            |
| `coach view`                 | Starts the vault graph on `http://127.0.0.1:4747/`                                                     |

`--today YYYY-MM-DD` pins the date, which helps in a demo.

## The flow

1. `coach spar`: answer in your own words; a blank line sends the answer, `/skip` skips a note, `/quit` stops. Banned buzzwords send the question back. When you confirm, the Tier 1 session is recorded in the vault and queued for the judge.
2. `coach judge`, once online: only each session's `tier2_payload` goes to Gemini. Verdicts map back to notes by order, and the Tier 2 session is recorded after you confirm.
3. Next review dates come from the scheduler. The Tier 2 ladder step is read from the note's `history.entries` in the vault on every run; nothing about it is stored locally.

## Local state

`~/.local/state/ai-coach/pending-judgement.json` (or `$XDG_STATE_HOME/ai-coach`) lists the Tier 1 sessions not yet judged, each with its notes' `coach_id`s in session order. The vault cannot tell which item of a session belongs to which note, and the judge's answers come back by position, so this order is kept until the session is judged. It holds no note content.

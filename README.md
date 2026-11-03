# ai-coach

[![CI](https://github.com/AdrianRomanski/ai-coach/actions/workflows/ci.yml/badge.svg)](https://github.com/AdrianRomanski/ai-coach/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node 24+](https://img.shields.io/badge/node-%E2%89%A524-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Runs locally](https://img.shields.io/badge/Tier%201-runs%20offline-success)

**A study partner that makes you explain what you've read, in your own words, until you really understand it.**

You read a book and mark what matters. ai-coach helps you turn those marks into a few clear ideas. Then it quizzes you on them in the terminal, the way a demanding tutor would. It never hands you the answer. It asks questions, pushes back on vague answers and buzzwords, and tells you what you left out. Then it schedules the next review, so ideas you know well come back less often and shaky ones come back tomorrow.

It works on your own notes in an [Obsidian](https://obsidian.md) vault, and most of it runs **entirely on your machine**.

```text
$ npm run coach -- spar

coach> Explain, as if to a newcomer, why a note is distilled in layers rather than all at once.
you> You bold what matters on the first pass, then highlight the best of the bold,
...  so later you can read just the highlights.
...
coach> You said "the best of the bold". What makes one bolded sentence better than
       another when you come back to the note months later?
```

_(An illustration: the questions depend on your note and the model.)_

The repository holds two things that share one vault:

| Part                                                                | What it is                                                                                                                | Talks to the vault through                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **The `coach` CLI** (`packages/`)                                   | The study partner: synthesize, spar, judge, study, review.                                                                | kb-template's `docs-mcp` server            |
| **Planning skills** ([`.claude/skills/`](.claude/skills/README.md)) | [Claude Code](https://claude.com/claude-code) skills that plan your year, quarter, month, week and day in the same vault. | the same server, registered in Claude Code |

---

## Contents

- [How it works](#how-it-works)
- [How the pieces fit](#how-the-pieces-fit)
- [What you need](#what-you-need)
- [Set it up](#set-it-up)
- [Your first session](#your-first-session)
- [Commands](#commands)
- [Coaching styles](#coaching-styles)
- [Privacy: what leaves your machine](#privacy-what-leaves-your-machine)
- [Configuration](#configuration)
- [Planning with Claude Code](#planning-with-claude-code)
- [When something goes wrong](#when-something-goes-wrong)
- [How the code is organised](#how-the-code-is-organised)
- [Working on ai-coach](#working-on-ai-coach)
- [Status and limits](#status-and-limits)
- [License](#license)

---

## How it works

Learning with ai-coach follows one loop:

```text
  read ──► distill ──► synthesize ──► spar ──► judge ──► study
                                        ▲                   │
                                        └──── review ◄──────┘
```

| Step           | What you do                                                                                    | Where                                  |
| -------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Read**       | Read a book that has been converted into your vault, one note per chapter.                     | Obsidian                               |
| **Distill**    | Bold what matters, highlight the best of it, and write a short summary of each chapter.        | Obsidian, or `coach view`              |
| **Synthesize** | Turn your marks into _concept notes_: one idea each, in your words, backed by quotes.          | `coach synthesize`                     |
| **Spar**       | Explain a concept to the coach. It asks follow-up questions and gives a verdict.               | `coach spar` (offline)                 |
| **Judge**      | A stronger model checks your answers for gaps and hand-waving, without ever seeing your notes. | `coach judge` (online)                 |
| **Study**      | Work through what you missed, with hints and the author's own words.                           | `coach study`, or offered after a fail |
| **Review**     | Come back when the idea is due. The better you know it, the longer the gap.                    | `coach due`                            |

Two models do the work:

- **Tier 1, the sparring partner:** [Gemma](https://ai.google.dev/gemma), running locally through [Ollama](https://ollama.com). It works offline and sees your notes, but nothing it reads leaves your machine.
- **Tier 2, the judge:** Google's Gemini. It sees **only** the questions you were asked and your answers (plus the idea's core assertions, unless you switch that off). It never sees your notes, so an answer copied from them gains nothing.

The rules that decide a verdict live in code, not in prompts: a model saying "pass" is overruled when flaws remain, and an answer that copies six words in a row from the note counts as reciting, not explaining.

### The review schedule

| Result                   | Next review                                                   |
| ------------------------ | ------------------------------------------------------------- |
| Failed                   | tomorrow                                                      |
| Passed Tier 1 (sparring) | in 3 days                                                     |
| Passed Tier 2 (judge)    | 7 days, then 14, 30, 60, 120, 240 and 365 as you keep passing |

Every number can be changed in the [configuration](#configuration).

---

## How the pieces fit

ai-coach never opens a file in your vault. One program owns the vault: the `docs-mcp` server from **kb-template**, a separate repository. Everything else asks it, over the [Model Context Protocol](https://modelcontextprotocol.io).

```text
┌──────────────────────────────── your machine ────────────────────────────────┐
│                                                                              │
│  coach CLI ───── stdio (MCP) ─────┐                                          │
│     │                             ▼                                          │
│     │                    docs-mcp serve --vault ───► Obsidian vault          │
│     │                       (kb-template)            0.Inbox … 4.Archive,    │
│     │                             ▲                  Plans/, Coach/          │
│  Claude Code + planning skills ───┘                                          │
│     │                                                                        │
│     └── loopback HTTP ──► Ollama (Gemma)                                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
        │
        └── HTTPS, the Tier 2 payload only ──► Gemini (coach judge)
```

| Piece               | Owns                                                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **kb-template**     | The vault: PARA layout, converting PDFs into chapter notes, quote checks, sparring history in `Coach/sessions/`, the planning model in `Plans/`, the graph view on port 4747. Every write it offers is a preview until called with `execute`. |
| **coach CLI**       | The learning rules (the `domain` package), the conversations with Gemma and Gemini, and the confirm-before-write terminal flow.                                                                                                               |
| **Planning skills** | Instructions that teach Claude Code to plan with the server's planning tools. No code.                                                                                                                                                        |
| **Ollama**          | Runs Gemma locally. ai-coach refuses any Ollama host that is not on loopback.                                                                                                                                                                 |

The coach CLI starts the server itself (`node <docsMcpBin> serve --vault <vault>`) and stops it when the command ends. Claude Code starts its own copy from its MCP registration.

---

## What you need

| You need                                                                             | Why                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Node.js 24 or newer**                                                              | ai-coach is a Node command-line tool.                                                                                          |
| **An Obsidian vault**, organised in [PARA](https://fortelabs.com/blog/para/) folders | Your notes. `coach init` can set up the folders for you.                                                                       |
| **kb-template**, checked out and built                                               | Its `docs-mcp` vault server is the only way ai-coach reads or changes your vault. See [Status and limits](#status-and-limits). |
| **[Ollama](https://ollama.com)** with a Gemma model, e.g. `ollama pull gemma3`       | Runs the sparring partner on your machine.                                                                                     |
| **A Gemini API key** (optional)                                                      | Only for `coach judge`. Everything else works without it.                                                                      |
| **[Claude Code](https://claude.com/claude-code)** (optional)                         | Only for the planning skills.                                                                                                  |

Your vault uses five top-level folders, plus two the server manages:

```text
0.Inbox/        new notes land here (captures, study notes, reading notes)
1.Projects/     things with a deadline, each with its workstreams
2.Areas/        ongoing responsibilities
3.Resources/    what you're learning: this is where sparring happens
   0.Raw/         converted books and other source material (read and quote it, never spar it)
   Concepts/      the concept notes you synthesize
4.Archive/      finished projects
Plans/          year, quarter, month, week and day plans (planning skills)
Coach/          sparring sessions and the graph, written by the server
```

---

## Set it up

**1. Build kb-template's server**

```sh
cd ../kb-template
pnpm install        # builds everything on install
pnpm run build      # rebuild after pulling changes
```

The server is `packages/cli/bin/docs-mcp.js` in that checkout.

**2. Install and build ai-coach**

```sh
cd ../ai-coach
npm install
npx nx run-many -t build
```

**3. Pull a Gemma model**

```sh
ollama pull gemma3
```

**4. Create `coach.config.json`** in the repository root. It is git-ignored, so your paths stay private. [`coach.config.example.json`](coach.config.example.json) is a starting point.

```json
{
  "vault": "~/Documents/my-vault",
  "docsMcpBin": "~/projects/kb-template/packages/cli/bin/docs-mcp.js",
  "ollama": { "model": "gemma3:latest" }
}
```

`docsMcpBin` can be left out if kb-template lives at `~/projects/kb-template`. Always set `vault`: without it the server has no vault to open.

**5. (Optional) Add your Gemini key** for the judge, in a `.env` file in the repository root. It is git-ignored too.

```sh
GEMINI_API_KEY=your-key-here
```

**6. (Optional, for the planning skills) Create `.mcp.json`** so Claude Code can reach the same vault server. It is git-ignored, like your config:

```sh
cp .mcp.example.json .mcp.json
```

Then replace the two placeholders with absolute paths (`~` is not expanded here): kb-template's `docs-mcp.js` and your vault. Keep the server name `life-vault`. Details are in the [skills guide](.claude/skills/README.md#set-it-up).

**7. Check that everything is connected**

```sh
npm run coach -- init   # preview the PARA folders, confirm to create the missing ones
npm run coach -- due
```

You should see what's due for review and which notes have never been sparred.

> [!TIP]
> Try ai-coach on a **copy** of your vault first. Every change is previewed and needs your confirmation, but a copy lets you experiment freely.

---

## Your first session

Say you've read _Building a Second Brain_, which kb-template has converted into chapter notes under `3.Resources/0.Raw/Books/…`.

**Distill it.** In Obsidian (or in the graph view, `npm run coach -- view`), bold the sentences that matter, highlight the best of them with `==…==`, and add a summary of each chapter in your own words:

```markdown
> [!summary]
> Notes only pay off if future me can find their point fast, so I distill them in layers.
```

**Synthesize it.**

```sh
npm run coach -- synthesize
```

The coach lists your books, groups your marks into a few ideas and lets you pick one. For each idea:

1. You write a summary in your own words.
2. The coach asks up to two questions about anything your marks say that your summary leaves out, then always asks why the idea matters (`/skip` passes).
3. It drafts the idea's **core assertions** (the key points you'll be tested on) from _your_ summary and answers, never from the book. You keep, drop (`d`) or rewrite each one.
4. It suggests **buzzwords** you won't be allowed to hide behind when you explain the idea.
5. It picks **quotes** from your highlights, and the vault server checks they really are in the book.
6. You see a preview, and the note is written to `3.Resources/Concepts/` only if you say yes.

**Spar it.**

```sh
npm run coach -- spar
```

Pick a note from the list. The coach asks you to explain the idea. Type your answer; **an empty line sends it**. The coach may:

- ask you to **rephrase** if you used a buzzword or copied the note word for word,
- ask **follow-up questions** about what's missing (up to three),
- then give a **verdict**: pass, or fail with the gaps it found.

At the end you see a preview of the session and confirm to record it. If you failed, the coach offers to study the gaps right away.

**Judge it** (when you're online):

```sh
npm run coach -- judge
```

The judge checks every recorded session that is still waiting. It passes an answer only if no claim is wrong or hand-waved and nothing the question asked is missing.

**Come back tomorrow.**

```sh
npm run coach -- due
```

---

## Commands

Run any command as `npm run coach -- <command>`.

| Command                | What it does                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `due`                  | What's due for review today, and what has never been sparred. The default when you type no command.                                        |
| `list`                 | Every note in Resources with how well you know it (unsparred, attempted, Tier 1 passed, Tier 2 passed).                                    |
| `synthesize [book]`    | Turn your marks and reading notes on a book into concept notes. Without a book, you pick one from a list.                                  |
| `spar [note …]`        | Tier 1, offline. Spar the notes that are due, or the notes you name (by path or coach id).                                                 |
| `judge [session …]`    | Tier 2, online. Judge the sparring sessions waiting for it.                                                                                |
| `study <note>`         | Work through the gaps from a note's latest failed session.                                                                                 |
| `capture <title>`      | Write a quick note into `0.Inbox`. End it with a line holding a single `.`.                                                                |
| `file <note> <folder>` | Move a note into a PARA folder, e.g. `file "0.Inbox/Idea.md" 3.Resources/TypeScript`. Without arguments, lists what's waiting to be filed. |
| `archive <project>`    | Move a finished project into `4.Archive`. It first asks which concept and sparred notes to keep in Resources.                              |
| `init`                 | Set up the five PARA folders in your vault.                                                                                                |
| `view`                 | Open the vault graph in your browser at http://127.0.0.1:4747/, where you can also mark chapters. `/plans` shows your plans.               |

**Options**

| Option               | Meaning                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `--style <style>`    | Coach in this style for this run. See [Coaching styles](#coaching-styles). |
| `--config <file>`    | Use a different configuration file.                                        |
| `--today YYYY-MM-DD` | Pretend it's another day, e.g. to see what will be due next week.          |
| `--help`, `-h`       | Show the command list.                                                     |

**While you answer**

| Type                  | To                                                                |
| --------------------- | ----------------------------------------------------------------- |
| an empty line         | send your answer (answers can span several lines)                 |
| `/skip`               | skip this note, question or gap                                   |
| `/quit`               | stop; nothing is recorded unless you confirm it                   |
| `/hint` or "teach me" | in study: get a clue and the author's words, without losing a try |

**Every change to your vault is shown first.** Nothing is written, moved or recorded until you confirm.

Exit codes: `0` success, `1` an error the coach explained, `2` a usage error (unknown command or bad option).

---

## Coaching styles

The coach can push you in four different ways:

| Style      | Pushes you to…                                                 | Good for                         |
| ---------- | -------------------------------------------------------------- | -------------------------------- |
| `feynman`  | explain it in plain words, as if to a beginner, with no jargon | technical ideas, how things work |
| `socratic` | defend your claims against counter-examples                    | arguments and beliefs            |
| `cornell`  | state the author's thesis and how they argue for it            | book chapters, essays            |
| `devil`    | name failure modes, trade-offs and when the idea doesn't apply | methods and best practices       |

The style is chosen in this order:

1. `--style` on the command line,
2. a `style:` field in the note's frontmatter,
3. `sparring.style` in your configuration,
4. otherwise the coach picks one by reading the note.

The judge holds each answer to the bar of the style it was sparred in.

---

## Privacy: what leaves your machine

- **Sparring, studying and synthesizing never leave your machine.** Gemma runs locally, and ai-coach refuses to talk to an Ollama host that isn't `http` on `127.0.0.1`, `localhost` or `::1`.
- **Only `coach judge` goes online.** For each question it sends the question and your answer, plus the idea's core assertions. To keep the assertions private too, set `"judge": { "includeAssertions": false }`.
- **Your notes are never sent anywhere**, not even to the judge. The payload is built by the vault server, re-checked in the domain, and checked once more by the Gemini adapter before it is sent.
- **Notes and answers are data, never instructions.** They are fenced with a random marker in every prompt, so a note saying "ignore your instructions" has no effect.
- **Your vault is only touched through kb-template's vault server**, never directly, and only after you confirm a preview.
- **Your Gemini key lives in `.env`**, which git ignores.
- The planning skills run inside Claude Code, so what they read from your vault goes to the model Claude Code uses. They never run the coach's judge.

---

## Configuration

ai-coach looks for its configuration in this order:

1. the file given with `--config`,
2. `coach.config.json` in the current folder,
3. `$XDG_CONFIG_HOME/ai-coach/config.json` (by default `~/.config/ai-coach/config.json`).

Relative paths in the file are resolved from the file's folder, and `~` means your home folder. Unknown keys are refused, so typos don't go unnoticed.

Only the Gemma model is required. A full example:

```json
{
  "vault": "~/Documents/my-vault",
  "docsMcpBin": "~/projects/kb-template/packages/cli/bin/docs-mcp.js",
  "stateDir": "~/.local/state/ai-coach",

  "ollama": {
    "model": "gemma3:latest",
    "checkModel": "gemma3:12b",
    "host": "http://127.0.0.1:11434",
    "contextWindow": 16384
  },

  "judge": {
    "model": "gemini-4-argon",
    "fallbackModel": "gemini-3.8-flash",
    "thinkingLevel": "MEDIUM",
    "includeAssertions": true
  },

  "sparring": {
    "style": "auto",
    "maxFollowUps": 3,
    "maxRephrases": 2,
    "maxChallengeAttempts": 3,
    "verbatimRunWords": 6,
    "buzzwords": ["synergy", "leverage", "best practice"],
    "language": "English"
  },

  "ladder": {
    "failDays": 1,
    "tier1PassDays": 3,
    "tier2PassDays": [7, 14, 30, 60, 120, 240, 365]
  }
}
```

| Setting                         | Default                                                    | Meaning                                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vault`                         | none                                                       | Your Obsidian vault. Set it: the server needs it.                                                                                                                                                      |
| `docsMcpBin`                    | `~/projects/kb-template/packages/cli/bin/docs-mcp.js`      | kb-template's server launcher.                                                                                                                                                                         |
| `stateDir`                      | `$XDG_STATE_HOME/ai-coach`, else `~/.local/state/ai-coach` | Where ai-coach keeps its own small state: the list of sessions waiting for the judge.                                                                                                                  |
| `ollama.model`                  | **required**                                               | The Gemma model, as listed by `ollama list`.                                                                                                                                                           |
| `ollama.checkModel`             | none                                                       | A larger Gemma model, e.g. `gemma3:12b`, that checks your answers against each core assertion of a concept note at the end of a round. Slower, but much fairer. Without it, `model` decides the round. |
| `ollama.host`                   | `http://127.0.0.1:11434`                                   | Must be loopback.                                                                                                                                                                                      |
| `ollama.contextWindow`          | `16384`                                                    | How many tokens Gemma reads at once (at least 2048). Raise it if a long chapter is refused.                                                                                                            |
| `judge.model`                   | `gemini-4-argon`                                           | The judge model.                                                                                                                                                                                       |
| `judge.fallbackModel`           | none                                                       | Tried once when the main judge model is rate-limited or failing.                                                                                                                                       |
| `judge.thinkingLevel`           | `MEDIUM`                                                   | `MEDIUM` or `HIGH`: how hard the judge thinks.                                                                                                                                                         |
| `judge.includeAssertions`       | `true`                                                     | Whether the judge may see the idea's core assertions.                                                                                                                                                  |
| `sparring.style`                | `auto`                                                     | `auto`, `feynman`, `socratic`, `cornell` or `devil`.                                                                                                                                                   |
| `sparring.maxFollowUps`         | `3`                                                        | How many follow-up questions before the verdict.                                                                                                                                                       |
| `sparring.maxRephrases`         | `2`                                                        | How many times you can be asked to rephrase.                                                                                                                                                           |
| `sparring.maxChallengeAttempts` | `3`                                                        | How many times the coach may retry an opening question that quotes the note before skipping it.                                                                                                        |
| `sparring.verbatimRunWords`     | `6`                                                        | Copying this many words in a row from the note counts as reciting, not explaining.                                                                                                                     |
| `sparring.buzzwords`            | a built-in list                                            | Words you're not allowed to hide behind (replaces the built-in list).                                                                                                                                  |
| `sparring.socraticRules`        | none                                                       | Extra rules for the coach to follow, one sentence each.                                                                                                                                                |
| `sparring.language`             | the note's language                                        | The language the coach speaks.                                                                                                                                                                         |
| `ladder`                        | `1`, `3`, `[7 … 365]`                                      | The [review schedule](#the-review-schedule), in days.                                                                                                                                                  |

Environment variables override the file. Put them in `.env` or your shell:

| Variable                      | Overrides                           |
| ----------------------------- | ----------------------------------- |
| `GEMINI_API_KEY`              | (the judge's key)                   |
| `DOCS_MCP_VAULT`              | `vault`                             |
| `DOCS_MCP_BIN`                | `docsMcpBin`                        |
| `OLLAMA_MODEL`                | `ollama.model`                      |
| `OLLAMA_CHECK_MODEL`          | `ollama.checkModel`                 |
| `OLLAMA_HOST`                 | `ollama.host`                       |
| `OLLAMA_NUM_CTX`              | `ollama.contextWindow`              |
| `GEMINI_JUDGE_MODEL`          | `judge.model`                       |
| `GEMINI_JUDGE_FALLBACK_MODEL` | `judge.fallbackModel`               |
| `GEMINI_JUDGE_THINKING_LEVEL` | `judge.thinkingLevel`               |
| `XDG_CONFIG_HOME`             | where the config file is looked for |
| `XDG_STATE_HOME`              | the default `stateDir`              |

---

## Planning with Claude Code

The same vault can hold your plans: projects with deadlines, workstreams, areas, and a chain of goals from the year down to the week, with tasks scheduled into days. kb-template's server does the bookkeeping; the skills in [`.claude/skills/`](.claude/skills/README.md) teach Claude Code how to plan with it.

```text
Year goal ──↑── Quarter goal ──↑── Month goal ──↑── Week goal
                                                      │ links its owner (a project, workstream or area)
                                                      ▼
                                tasks in that owner, scheduled into day plans
```

| Skill                                       | For                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `plan-day`                                  | the day's tasks, habits and overdue work; closing the day            |
| `plan-week`                                 | closing last week, setting week goals, spreading tasks over the days |
| `plan-month`, `plan-quarter`, `plan-year`   | reviews and goals for the larger periods                             |
| `add-task`, `set-goal`, `organize-projects` | adding work, linking goals, shaping projects and areas               |
| `review-period`                             | looking back at any period without changing anything                 |

Every write is previewed and needs your yes. The skills never edit vault files directly. Setup, the planning model and how to put your own scheduling rules in: [`.claude/skills/README.md`](.claude/skills/README.md).

---

## When something goes wrong

| You see                                                           | Try                                                                                                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `No Gemma model configured`                                       | Set `ollama.model` to a name from `ollama list`.                                                                                                            |
| `Ollama is not reachable`                                         | Start Ollama (`ollama serve` or the app).                                                                                                                   |
| `Tier 1 runs offline: the Ollama host must be http on loopback`   | ai-coach only talks to Ollama on your own machine. Point `ollama.host` at `127.0.0.1` or `localhost`.                                                       |
| `This note needs about N tokens, but Gemma's context window is …` | Raise `ollama.contextWindow`, or spar a shorter note.                                                                                                       |
| `Could not start the vault server`                                | Check `docsMcpBin` points at kb-template's `docs-mcp.js`, and that kb-template is built (`pnpm run build`). The error includes the end of the server's log. |
| `unexpected response from the vault server`                       | Your kb-template build and ai-coach disagree on a tool's reply. Update and rebuild kb-template.                                                             |
| `only notes under 3.Resources can be sparred`                     | File the note into Resources first: `coach file <note> 3.Resources/<topic>`.                                                                                |
| `… is raw material: spar a concept note that quotes it instead`   | Book chapters are source material. Run `coach synthesize` to make a concept note from them.                                                                 |
| `Nothing marked in … yet`                                         | Bold or highlight some passages, or write a chapter summary, then run `synthesize` again.                                                                   |
| `A concept note needs at least one core assertion`                | Keep at least one of the drafted assertions, or type your own.                                                                                              |
| The judge fails with a quota or server error                      | Try again later, or set `judge.fallbackModel`. Your sessions stay queued until judged.                                                                      |
| `config.json: …` with a setting name                              | The file has a typo or an unknown key. The message names it.                                                                                                |

---

## How the code is organised

ai-coach is built in layers, so the rules of learning don't depend on any particular model, vault or screen. The full map is in [ARCHITECTURE.md](ARCHITECTURE.md), and each package has its own README:

| Package                                                         | In one line                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`domain`](packages/domain/README.md)                           | The rules of learning: rounds, verdicts, the review schedule. No I/O at all.    |
| [`application`](packages/application/README.md)                 | The things you can do (spar, judge, study, synthesize) and the ports they need. |
| [`adapter-ollama`](packages/adapter-ollama/README.md)           | The local sparring partner, powered by Gemma.                                   |
| [`adapter-gemini`](packages/adapter-gemini/README.md)           | The online judge, powered by Gemini.                                            |
| [`adapter-vault-mcp`](packages/adapter-vault-mcp/README.md)     | Talks to your vault through kb-template's server.                               |
| [`adapter-local-state`](packages/adapter-local-state/README.md) | Remembers which sessions are waiting for the judge, and what day it is.         |
| [`cli`](packages/cli/README.md)                                 | The `coach` command you type.                                                   |

```text
                     cli
                      │  wires everything together
   ┌──────────────┬───┴──────────┬──────────────────┐
adapter-ollama  adapter-gemini  adapter-vault-mcp  adapter-local-state
   └──────────────┴───┬──────────┴──────────────────┘
                 application
                      │
                    domain
```

Arrows only point down: `domain` knows nothing about the others, and adapters never know about each other. Lint enforces this.

Every decision behind the design, from the two tiers to why the judge never sees your notes, is an architecture decision record in [`docs/adr/`](docs/adr/README.md).

---

## Working on ai-coach

```sh
npx nx run-many -t build          # build everything
npx nx run-many -t test           # run every test
npx nx run-many -t lint typecheck # check style, types and package boundaries
npx nx format:check               # check formatting
npx nx test @ai-coach/domain      # test one package
npx nx graph                      # see how the packages depend on each other
```

CI runs format, lint, test, build and typecheck on every push to `main` and every pull request.

House rules:

- **Important changes come with a decision record** in [`docs/adr/`](docs/adr/README.md), in the same commit. ADR-0001 says what counts. Start from `docs/adr/template.md`. Accepted records are never rewritten, only superseded.
- **No comments in source code.** Names and tests carry the meaning (ADR-0011).
- **Rules go in the domain, not in prompts.** If a model could talk its way past it, it belongs in code.
- **New vault abilities belong in kb-template**, not in `adapter-vault-mcp`, which only wraps what the server offers.
- **Never point tests or experiments at your real vault.** Use a copy.
- Tests don't need Ollama, Gemini or kb-template: each layer is tested with fakes or a local stub server.

---

## Status and limits

ai-coach is a personal project, used daily, and still changing. Please know this before you rely on it:

- **kb-template is required and is not public yet.** Every vault read and write goes through its `docs-mcp` server, so ai-coach can't run without a checkout of it. The domain and application packages, and their tests, run without it.
- **The judge's default model names** (`gemini-4-argon`, `gemini-3.8-flash`) follow what was available when they were set. Override them with `judge.model` and `judge.fallbackModel` if your key has others.
- **The vault adapter has no automated tests** (ADR-0010). Try changes against a copy of a vault.
- **Small local models make mistakes.** Every reply is checked and retried once, and `ollama.checkModel` makes the end-of-round verdict fairer, but a Tier 1 verdict is a first opinion. That's what the judge is for.

---

## License

[MIT](LICENSE) © 2026 Adrian Romanski. kb-template, which ai-coach needs to run, is a separate project with its own license.

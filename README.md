# ai-coach

**A study partner that makes you explain what you've read, in your own words, until you really understand it.**

You read a book and mark what matters. ai-coach helps you turn those marks into a few clear ideas. Then it quizzes you on them in the terminal, like a demanding tutor would. It never hands you the answer. It asks questions, pushes back on vague answers and buzzwords, and tells you what you left out. Then it schedules the next review, so ideas you know well come back less often and shaky ones come back tomorrow.

It works on your own notes in an [Obsidian](https://obsidian.md) vault, and most of it runs **entirely on your machine**.

---

## Contents

- [How it works](#how-it-works)
- [What you need](#what-you-need)
- [Set it up](#set-it-up)
- [Your first session](#your-first-session)
- [Commands](#commands)
- [Coaching styles](#coaching-styles)
- [Privacy: what leaves your machine](#privacy-what-leaves-your-machine)
- [Configuration](#configuration)
- [When something goes wrong](#when-something-goes-wrong)
- [How the code is organised](#how-the-code-is-organised)
- [Working on ai-coach](#working-on-ai-coach)

---

## How it works

Learning with ai-coach follows one loop:

```
  read ──► mark ──► distill ──► spar ──► judge ──► study
                                  ▲                   │
                                  └──── review ◄──────┘
```

| Step        | What you do                                                                                    | Where                                  |
| ----------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Read**    | Read a book that has been converted into your vault, one note per chapter.                     | Obsidian                               |
| **Mark**    | Bold what matters, highlight the best of it, and write a short summary of each chapter.        | Obsidian, or `coach view`              |
| **Distill** | Turn your marks into _concept notes_: one idea each, in your words, backed by quotes.          | `coach distill`                        |
| **Spar**    | Explain a concept to the coach. It asks follow-up questions and gives a verdict.               | `coach spar` (offline)                 |
| **Judge**   | A stronger model checks your answers for gaps and hand-waving, without ever seeing your notes. | `coach judge` (online)                 |
| **Study**   | Work through what you missed, with hints and the author's own words.                           | `coach study`, or offered after a fail |
| **Review**  | Come back when the idea is due. The better you know it, the longer the gap.                    | `coach due`                            |

Two models do the work:

- **Tier 1, the sparring partner:** [Gemma](https://ai.google.dev/gemma) running locally through [Ollama](https://ollama.com). It works offline and sees your notes, but it never leaves your machine.
- **Tier 2, the judge:** Google's Gemini. It sees **only** the questions you were asked and your answers (plus the idea's key points, unless you switch that off). It never sees your notes, so it can't be fooled by an answer you copied from them.

### The review schedule

| Result                   | Next review                                                   |
| ------------------------ | ------------------------------------------------------------- |
| Failed                   | tomorrow                                                      |
| Passed Tier 1 (sparring) | in 3 days                                                     |
| Passed Tier 2 (judge)    | 7 days, then 14, 30, 60, 120, 240 and 365 as you keep passing |

Every number can be changed in the [configuration](#configuration).

---

## What you need

| You need                                                                             | Why                                                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Node.js 24 or newer**                                                              | ai-coach is a Node command-line tool.                                                                                    |
| **An Obsidian vault**, organised in [PARA](https://fortelabs.com/blog/para/) folders | Your notes. `coach init` can set up the folders for you.                                                                 |
| **kb-template** (a separate repository), checked out locally                         | Its vault server is the only way ai-coach reads or changes your vault. It also converts books (PDFs) into chapter notes. |
| **[Ollama](https://ollama.com)** with a Gemma model, e.g. `ollama pull gemma3`       | Runs the sparring partner on your machine.                                                                               |
| **A Gemini API key** (optional)                                                      | Only for `coach judge`. Everything else works without it.                                                                |

Your vault uses five top-level folders:

```
0.Inbox/        new notes land here (captures, study notes, reading notes)
1.Projects/     things with a deadline
2.Areas/        ongoing responsibilities
3.Resources/    what you're learning: this is where sparring happens
   0.Raw/         converted books and other source material (read and quote it, never spar it)
   Concepts/      the concept notes you distill
4.Archive/      finished projects
```

---

## Set it up

**1. Install and build**

```sh
npm install
npx nx run-many -t build
```

**2. Pull a Gemma model**

```sh
ollama pull gemma3
```

**3. Create `coach.config.json`** in the repository root. It is git-ignored, so your paths stay private.

```json
{
  "vault": "~/Documents/my-vault",
  "docsMcpBin": "~/projects/kb-template/packages/cli/bin/docs-mcp.js",
  "ollama": { "model": "gemma3:latest" }
}
```

`docsMcpBin` can be left out if kb-template lives at `~/projects/kb-template`.

**4. (Optional) Add your Gemini key** for the judge, in a `.env` file in the repository root. It is git-ignored too.

```sh
GEMINI_API_KEY=your-key-here
```

**5. Check that everything is connected**

```sh
npm run coach -- due
```

You should see what's due for review and which notes have never been sparred.

> **Tip:** Try ai-coach on a **copy** of your vault first. Every change is previewed and needs your confirmation, but a copy lets you experiment freely.

---

## Your first session

Say you've read _Building a Second Brain_, which kb-template has converted into chapter notes under `3.Resources/0.Raw/Books/…`.

**Mark it.** In Obsidian (or in the graph view, `npm run coach -- view`), bold the sentences that matter, highlight the best of them with `==…==`, and add a summary of each chapter in your own words:

```markdown
> [!summary]
> Notes only pay off if future me can find their point fast, so I distill them in layers.
```

**Distill it.**

```sh
npm run coach -- distill
```

The coach lists your books, groups your marks into a few ideas and lets you pick one. For each idea:

1. You write a summary in your own words.
2. The coach asks up to two questions about anything your marks say that your summary leaves out, then always asks why the idea matters (`/skip` passes).
3. It drafts the idea's **core assertions** (the key points you'll be tested on) from _your_ summary and answers, never from the book. You keep, drop (`d`) or rewrite each one.
4. It suggests **buzzwords** you won't be allowed to hide behind when you explain the idea.
5. It picks **quotes** from your highlights, and the vault checks they really are in the book.
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
| `distill [book]`       | Turn your marks and reading notes on a book into concept notes. Without a book, you pick one from a list.                                  |
| `spar [note …]`        | Tier 1, offline. Spar the notes that are due, or the notes you name (by path or coach id).                                                 |
| `judge [session …]`    | Tier 2, online. Judge the sparring sessions waiting for it.                                                                                |
| `study <note>`         | Work through the gaps from a note's latest failed session.                                                                                 |
| `capture <title>`      | Write a quick note into `0.Inbox`. End it with a line holding a single `.`.                                                                |
| `file <note> <folder>` | Move a note into a PARA folder, e.g. `file "0.Inbox/Idea.md" 3.Resources/TypeScript`. Without arguments, lists what's waiting to be filed. |
| `archive <project>`    | Move a finished project into `4.Archive`. It first asks which concept and sparred notes to keep in Resources.                              |
| `init`                 | Set up the five PARA folders in your vault.                                                                                                |
| `view`                 | Open the vault graph in your browser at http://127.0.0.1:4747/, where you can also mark chapters.                                          |

**Options**

| Option               | Meaning                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `--style <style>`    | Coach in this style for this run. See [Coaching styles](#coaching-styles). |
| `--config <file>`    | Use a different configuration file.                                        |
| `--today YYYY-MM-DD` | Pretend it's another day, e.g. to see what will be due next week.          |
| `--help`             | Show the command list.                                                     |

**While you answer**

| Type                  | To                                                                |
| --------------------- | ----------------------------------------------------------------- |
| an empty line         | send your answer (answers can span several lines)                 |
| `/skip`               | skip this note, question or gap                                   |
| `/quit`               | stop; nothing is recorded unless you confirm it                   |
| `/hint` or "teach me" | in study: get a clue and the author's words, without losing a try |

**Every change to your vault is shown first.** Nothing is written, moved or recorded until you confirm.

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

---

## Privacy: what leaves your machine

- **Sparring, studying and distilling never leave your machine.** Gemma runs locally, and ai-coach refuses to talk to an Ollama server that isn't on your computer.
- **Only `coach judge` goes online.** For each question it sends the question and your answer, plus the idea's core assertions. To keep the assertions private too, set `"judge": { "includeAssertions": false }`.
- **Your notes are never sent anywhere**, not even to the judge.
- **Your vault is only touched through kb-template's vault server**, never directly, and only after you confirm a preview.
- Your Gemini key lives in `.env`, which git ignores.

---

## Configuration

ai-coach looks for its configuration in this order:

1. the file given with `--config`,
2. `coach.config.json` in the current folder,
3. `~/.config/ai-coach/config.json`.

Everything is optional except the Gemma model. Here is a full example. Apart from `vault`, `buzzwords` and `language`, the values shown are the defaults:

```json
{
  "vault": "~/Documents/my-vault",
  "docsMcpBin": "~/projects/kb-template/packages/cli/bin/docs-mcp.js",
  "stateDir": "~/.local/state/ai-coach",

  "ollama": {
    "model": "gemma3:latest",
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

| Setting                     | Meaning                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `vault`                     | Your Obsidian vault.                                                                  |
| `docsMcpBin`                | kb-template's `docs-mcp.js`.                                                          |
| `stateDir`                  | Where ai-coach keeps its own small state: the list of sessions waiting for the judge. |
| `ollama.model`              | The Gemma model, as listed by `ollama list`. **Required.**                            |
| `ollama.contextWindow`      | How much text Gemma can read at once. Raise it if a long chapter is refused.          |
| `judge.fallbackModel`       | Used when the main judge model is busy or unavailable.                                |
| `judge.thinkingLevel`       | `MEDIUM` or `HIGH`: how hard the judge thinks.                                        |
| `judge.includeAssertions`   | Whether the judge may see the idea's core assertions.                                 |
| `sparring.maxFollowUps`     | How many follow-up questions before the verdict.                                      |
| `sparring.maxRephrases`     | How many times you can be asked to rephrase.                                          |
| `sparring.verbatimRunWords` | Copying this many words in a row from the note counts as reciting, not explaining.    |
| `sparring.buzzwords`        | Words you're not allowed to hide behind (replaces the built-in list).                 |
| `sparring.language`         | The language the coach speaks. Defaults to the language of the note.                  |
| `ladder`                    | The [review schedule](#the-review-schedule), in days.                                 |

Environment variables override the file. Put them in `.env` or your shell:

| Variable                      | Overrides              |
| ----------------------------- | ---------------------- |
| `GEMINI_API_KEY`              | (the judge's key)      |
| `DOCS_MCP_VAULT`              | `vault`                |
| `DOCS_MCP_BIN`                | `docsMcpBin`           |
| `OLLAMA_MODEL`                | `ollama.model`         |
| `OLLAMA_HOST`                 | `ollama.host`          |
| `OLLAMA_NUM_CTX`              | `ollama.contextWindow` |
| `GEMINI_JUDGE_MODEL`          | `judge.model`          |
| `GEMINI_JUDGE_FALLBACK_MODEL` | `judge.fallbackModel`  |
| `GEMINI_JUDGE_THINKING_LEVEL` | `judge.thinkingLevel`  |

---

## When something goes wrong

| You see                                                           | Try                                                                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `No Gemma model configured`                                       | Set `ollama.model` to a name from `ollama list`.                                                      |
| `Ollama is not reachable`                                         | Start Ollama (`ollama serve` or the app).                                                             |
| `Tier 1 runs offline: the Ollama host must be http on loopback`   | ai-coach only talks to Ollama on your own machine. Point `ollama.host` at `127.0.0.1` or `localhost`. |
| `This note needs about N tokens, but Gemma's context window is …` | Raise `ollama.contextWindow`, or spar a shorter note.                                                 |
| `Could not start the vault server`                                | Check `docsMcpBin` points at kb-template's `docs-mcp.js`, and that kb-template is built.              |
| `only notes under 3.Resources can be sparred`                     | File the note into Resources first: `coach file <note> 3.Resources/<topic>`.                          |
| `… is raw material: spar a concept note that quotes it instead`   | Book chapters are source material. Run `coach distill` to make a concept note from them.              |
| `Nothing marked in … yet`                                         | Bold or highlight some passages, or write a chapter summary, then run `distill` again.                |
| `A concept note needs at least one core assertion`                | Keep at least one of the drafted assertions, or type your own.                                        |
| The judge fails with a quota or server error                      | Try again later, or set `judge.fallbackModel`. Your sessions stay queued until judged.                |

---

## How the code is organised

ai-coach is built in layers, so the rules of learning don't depend on any particular model, vault or screen. Each package has its own README:

| Package                                                         | In one line                                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`domain`](packages/domain/README.md)                           | The rules of learning: rounds, verdicts, the review schedule. No I/O at all. |
| [`application`](packages/application/README.md)                 | The things you can do (spar, judge, study, distill) and what they need.      |
| [`adapter-ollama`](packages/adapter-ollama/README.md)           | The local sparring partner, powered by Gemma.                                |
| [`adapter-gemini`](packages/adapter-gemini/README.md)           | The online judge, powered by Gemini.                                         |
| [`adapter-vault-mcp`](packages/adapter-vault-mcp/README.md)     | Talks to your vault through kb-template's server.                            |
| [`adapter-local-state`](packages/adapter-local-state/README.md) | Remembers which sessions are waiting for the judge, and what day it is.      |
| [`cli`](packages/cli/README.md)                                 | The `coach` command you type.                                                |

```
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

---

## Working on ai-coach

```sh
npx nx run-many -t build          # build everything
npx nx run-many -t test           # run every test
npx nx run-many -t lint typecheck # check style and types
npx nx test @ai-coach/domain      # test one package
npx nx graph                      # see how the packages depend on each other
```

A few house rules:

- **Important changes come with a decision record** in [`docs/adr/`](docs/adr/README.md). Start from `docs/adr/template.md`. Accepted records are never rewritten, only superseded by a new one.
- **No comments in source code.** Names and tests carry the meaning (ADR-0011).
- **Never point tests or experiments at your real vault.** Use a copy.
- Tests don't need Ollama, Gemini or kb-template: each layer is tested with fakes or a local stub server.

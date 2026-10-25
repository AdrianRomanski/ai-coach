# Handoff: kb-template vault server changes (2026-10-25)

This continues `docs/kb-template-handoff-2026-10-24.md`. Read that first. It covers
concept notes, the rule that raw text is never sparred, the optional `core_assertions`
in `tier2_payload`, and the reading stages.

The changes are in ~/projects/kb-template on branch `ar/ai-coach`: commits `7db9455`,
`2fd8085`, `ab476d4` and `460e7ea`. They are local, not pushed, and the build is
current. Restart the MCP connection to pick up the changed tools.

Decisions: ADR-KI-0058 (amended for `archive_project`) and ADR-KI-0061 (Decisions 9
and 10). Full tool reference: kb-template/scripts/docs/mcp-servers.md.

## 1. `archive_project` keeps knowledge notes in Resources

How PARA filing works here: a note goes to the most actionable place, so a note that
serves an active project lives in that project. Concept notes are the exception. They
stay in `3.Resources/Concepts`, because only notes under `3.Resources` (outside
`0.Raw`) are sparred. Link them from project notes, e.g. `[[Progressive Summarization]]`,
instead of moving them into the project.

When a project ends:

`archive_project { project, keep?: [{ note, to? }], keep_suggested?: boolean, execute? }`

- The preview's `suggestions` list each note that looks like knowledge rather than
  project work, as `{ path, to, reasons[] }`. A note is suggested when it:
  - is a concept note (`to` = `3.Resources/Concepts`);
  - has sparring history (a `coach_id`);
  - links to a raw resource;
  - is linked from notes outside the project.

  For every reason except the first, `to` is `3.Resources/<project>`.
- Kept notes move into `3.Resources` first and stay sparrable. The rest of the folder
  then moves to `4.Archive`. If every file was kept, the empty project folder is
  removed instead.
- It refuses a kept note that is not in the project, a `to` outside `3.Resources` or
  inside `0.Raw`, and any target that already exists. Nothing is ever overwritten.

**What ai-coach should do:**
1. Call `archive_project { project }`.
2. Show the user the suggestions with their reasons.
3. Ask which to keep, and let them change any `to` folder.
4. Call `archive_project` again with `keep` (or `keep_suggested: true`) and
   `execute: true`.

## 2. Statistics per raw source

- `list_raw` items now carry `notes` (the user's own notes linking the source or any
  of its chapters) and `concepts` (concept notes quoting or linking it). Both are
  arrays of vault-relative paths. A converted book counts through its `text.md`; a raw
  markdown note counts on its own.
- `reading_progress` already carries the same lists in `steps.notes` and
  `steps.concepts`.
- For a book's stage, show each step on its own (`steps.readOn`, `steps.notes.length`,
  chapters started, all chapters complete, `steps.concepts.length`). `stage` is only
  the furthest step reached, so a step skipped on the way stays visible.

## 3. The user can distil in the graph view, which writes the chapter note

The graph view (`docs-mcp view --vault ~/Documents/life-vault`, at
http://127.0.0.1:4747/) can now edit book chapters. This is not an MCP tool; it is
the browser UI. What changes:

- **Marks:** the user selects text on a page and clicks Bold, Highlight or Clear
  (keys `B` / `H` / `X`). The chapter note gets ordinary Obsidian markdown, e.g.
  `**a side effect of the way ==her mind works==**`.
- **Summaries:** the user can add, edit or remove page summaries and chapter
  summaries (`> [!summary]` callouts). A chapter summary completes the chapter.
- **Edit mode** (key `E`) shows the page large in the middle of the screen, with
  the chapter's pages and both summary editors beside it.
- **Writes happen immediately** when the user clicks; there is no preview. If the
  page changed in Obsidian since it was shown, the edit is refused and the latest
  text is shown. Only chapter notes can be written this way.
- **Security:** the view server checks the Host header on every request, and a write
  needs a per-run token that only the page it served knows. Do not call the view's
  `/api/*` endpoints from ai-coach; use the MCP tools.

**Consequences for ai-coach:**
- **Chapter text can change between calls**, because the user marks it while reading.
  - Re-read before relying on a page (`read_note { path, pages }`).
  - Quote matching in `create_concept` already ignores `**`, `__` and `==`, and never
    matches summary callouts.
- **The user's distillation is the best input for `coach distill`.** On each page,
  bold is what mattered and highlight is the best of it. The chapter summary is the
  chapter in the user's own words.
  - `reading_progress` tells you which pages carry marks (`mark: none | bold | highlight`).
  - `read_note` on a chapter returns the text with the marks in it.
- **`write_summary` (MCP) still refuses to replace an existing summary.** Only the
  view edits existing summaries.
- There is still no MCP tool to bold or highlight a passage. If ai-coach needs one,
  ask kb-template for it; it is an open question in ADR-KI-0061.

## 4. Graph view redesign (for the conference demo; nothing to call)

- Full-screen dark canvas with floating panels and a light theme toggle.
- Books carry a progress ring. Hovering a note lights up its links.
- The side panel shows an overview, a book's stage tracker, chapter and page cells,
  and a page reader.
- Keys: `P` presentation mode (full screen), `F` fit, `/` search, `←` `→` pages,
  `E` edit mode, `Esc` back.
- Bookmark a starting state: `http://127.0.0.1:4747/?present#open=<url-encoded chapter path>&page=N`.
  `?theme=light` or `?theme=dark` picks the theme.
- Graph node fields added in `Coach/graph.json`: `readOn`, `notesFrom` and
  `conceptsFrom` (for raw sources). It is generated by the view server; don't depend
  on it.

## Current vault state (2026-10-25)

Same as the previous handoff, unless the user has worked in Obsidian or the view
since:
- One converted book: Building a Second Brain.
- No concept notes, no sessions.
- `0.Inbox` now exists for reading notes.

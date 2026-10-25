---
id: ADR-0004
title: 'Only the Tier 2 payload leaves the machine'
status: superseded
date: 2026-10-24
supersedes: []
superseded_by: ['ADR-0021']
links: ['ADR-0002', 'ADR-0005', 'ADR-0006', 'ADR-0010']
---

# ADR-0004: Only the Tier 2 payload leaves the machine

## Context

The judge runs on a cloud model. The notes are private. A single careless field in a request would send a note, its title or its path to Google.

## Decision

1. **The only data sent to the judge is a `Tier2Payload`: `{ items: [{ challenge, answer }] }`**, built by the vault server's `tier2_payload` tool. No note body, title, path, `coach_id`, session id, verdict or gap is sent.
2. The domain enforces it: `tier2Payload()` rejects any other field at any level, empty items and empty strings, and returns a frozen value.
3. The Gemini adapter re-checks every payload at its boundary with the same function, and is the only code that imports `@google/genai`.
4. Note bodies are untrusted data. Tier 1 fences each note in tags carrying a random nonce and neutralises anything that looks like a closing tag; Tier 2 does the same for challenges and answers.
5. Tier 1 is told not to quote or closely paraphrase the note, and every challenge and follow-up is checked: one sharing a run of `verbatimRunWords` (default 6) words with the note is rejected and asked again (ADR-0005).
6. Tier 1 makes no request beyond Ollama on loopback.

## Consequences

- **The limit, stated honestly:** the challenge is written from the note, so the judge sees a question shaped by it. The verbatim check stops copied phrases, not a challenge that names the topic or paraphrases an idea loosely. This is a talking point in the talk.
- The learner's answer is their own writing and goes to the judge as written.
- What tests cover this today is recorded in ADR-0010.

---
id: ADR-0002
title: 'Coach in two tiers: an offline sparring partner on local Gemma and a zero-knowledge judge on Gemini Argon'
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0004', 'ADR-0005', 'ADR-0006']
---

# ADR-0002: Coach in two tiers: an offline sparring partner on local Gemma and a zero-knowledge judge on Gemini Argon

## Context

ai-coach is the demo for a conference talk that argues against "chat with your docs" tools: they hand out summaries and stop the reader thinking. The coach must instead make the learner explain their own private notes. It must work with no network (on a train or a plane), and the notes must never leave the machine.

## Decision

1. **Tier 1, the sparring partner, runs offline on a local Gemma model served by Ollama.** It reads the notes and runs a Socratic, Feynman-style dialogue (ADR-0005). The model comes from `OLLAMA_MODEL`; the host defaults to `http://127.0.0.1:11434` and must be plain http on loopback, or the adapter refuses to start.
2. **Tier 2, the judge, runs online on Gemini through `@google/genai`.** It never sees a note: it gets only the challenge Tier 1 asked and the learner's answer (ADR-0004), and judges them with the blind claim-extraction protocol (ADR-0006).
3. The judge model is `gemini-4-argon` with `thinkingLevel: 'MEDIUM'` (or `'HIGH'`). An optional fallback, for example `gemini-3.8-flash`, is used only when Argon answers 429 or 5xx or cannot be reached; a 400 still fails.
4. Authentication is `GEMINI_API_KEY` read by `new GoogleGenAI()` against the Gemini Developer API; Vertex AI is switched off.
5. Tier 1 records a session first; Tier 2 judges it later, whenever the learner is back online.

## Consequences

- Sparring needs Ollama and a pulled Gemma model; judging needs network and a key.
- If `GOOGLE_API_KEY` is also set, the SDK uses it instead of `GEMINI_API_KEY`.
- Tier 1's verdict and Tier 2's verdict are recorded separately, and mastery is derived from both (ADR-0003).

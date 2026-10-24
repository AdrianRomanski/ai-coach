---
id: ADR-0013
title: "Set Gemma's context window explicitly and refuse prompts that would not fit"
status: accepted
date: 2026-10-24
supersedes: []
superseded_by: []
links: ['ADR-0002', 'ADR-0012']
---

# ADR-0013: Set Gemma's context window explicitly and refuse prompts that would not fit

## Context

Ollama runs a model with a small default context window unless the request sets `num_ctx`, and it truncates a longer prompt without saying so. A chapter part can be 20,000 characters (ADR-0012), roughly 5,000 to 7,000 tokens, plus the instructions and the transcript. Gemma would see only part of the note and ask about a fragment, and the learner would never know.

## Decision

1. Every Ollama request sets `options.num_ctx` to the configured context window, **16,384 tokens by default**. It is set by `ollama.contextWindow` in `coach.config.json` or `OLLAMA_NUM_CTX`, a whole number of at least 2,048.
2. **Before each request the adapter estimates the prompt at one token per 3 characters and keeps 1,024 tokens for the reply.** A prompt that would not fit is refused with `ContextTooSmallError`, which names the estimate, the window and the setting to raise. Nothing is sent and nothing is truncated.
3. The estimate is deliberately pessimistic; Polish text takes more tokens per character than English.

## Consequences

- A larger window uses more memory on the machine running Ollama; 16,384 fits a 20,000-character chapter with room for a dialogue.
- A first real chapter of Building a Second Brain fitted the default window.
- The same guard protects long hand-written notes, not only book chapters.

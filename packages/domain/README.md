# @ai-coach/domain

**The rules of learning.** This package decides what counts as a good explanation, when a round is over, what a pass means and when you'll see an idea again. Models, files, the network and the terminal all live in other packages.

If you want to change _how the coach behaves_ (how many follow-ups it allows, what counts as copying, how the review schedule grows), this is usually the place.

## What's inside

| Area                    | What it decides                                                                                                                    | File                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **Sparring rules**      | The tunable knobs: banned buzzwords, follow-ups, rephrases, how many copied words count as reciting, the coaching style, language. | `sparring-rules.ts` |
| **A sparring round**    | One Tier 1 conversation: the challenge, rephrase requests, follow-ups and the verdict. A fail must name the gaps.                  | `sparring-round.ts` |
| **Coaching styles**     | The four styles (feynman, socratic, cornell, devil), what each asks for, and spotting "teach me"-style requests for help.          | `coaching-style.ts` |
| **Text checks**         | Finding buzzwords, and noticing when an answer or question copies the note word for word.                                          | `text.ts`           |
| **The judge's verdict** | A Tier 2 pass stands only if no claim is wrong or hand-waved and no gap remains, whatever the model said.                          | `judgement.ts`      |
| **What the judge sees** | The exact shape of what may go online: questions, answers and (optionally) core assertions. Nothing else gets through.             | `tier2-payload.ts`  |
| **The review schedule** | When an idea comes back: tomorrow after a fail, in 3 days after a Tier 1 pass, then 7 → 14 → 30 → … → 365 days on Tier 2 passes.   | `review-ladder.ts`  |
| **A study round**       | Working through the gaps of a failed round: tries per gap, hints, and finding the author's passage that answers a gap.             | `study-round.ts`    |
| **Synthesizing**        | Reading your bolds, highlights and summaries out of a chapter, picking quotes, and checking a concept note before it's written.    | `synthesis.ts`      |
| **Vocabulary**          | Shared words: verdicts, tiers, mastery levels, PARA folders, a note, an exchange.                                                  | `vocabulary.ts`     |

## Using it

Everything is plain functions and classes with no setup:

```ts
import {
  scheduleReview,
  findBuzzwords,
  DEFAULT_BUZZWORDS,
} from '@ai-coach/domain';

scheduleReview({
  tier: 1,
  verdict: 'pass',
  gaps: 0,
  date: '2026-10-25',
  tier2History: [],
});
// → { nextReview: '2026-10-28', intervalDays: 3, rung: -1 }

findBuzzwords('It just works, seamlessly.', DEFAULT_BUZZWORDS);
// → ['seamlessly', 'just works']
```

When a rule is broken (a ladder with no steps, a concept note with seven assertions, an empty buzzword), it throws a `DomainError` with a message you can show to the learner as is.

## Good to know

- **No I/O, ever.** No files, network, clock or Node built-ins. Lint enforces it. Dates come in as `YYYY-MM-DD` strings.
- **Rules live here, not in prompts.** A model can't talk its way past them. For example, the judge's "pass" is overruled here when flaws remain.
- The defaults (`DEFAULT_SPARRING_RULES`, `DEFAULT_LADDER`) are what users get unless their configuration says otherwise.

## Tests

```sh
npx nx test @ai-coach/domain
```

The tests read like a specification, so they're a good place to see how a round or the schedule behaves.

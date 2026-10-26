import { isCoachingStyle, type CoachingStyle } from './coaching-style.js';
import { InvalidTier2PayloadError } from './errors.js';

export interface Tier2Item {
  readonly challenge: string;
  readonly answer: string;
  readonly coreAssertions?: readonly string[];
  readonly style?: CoachingStyle;
}

export interface Tier2Payload {
  readonly items: readonly Tier2Item[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyKeys(
  value: Record<string, unknown>,
  keys: string[],
  where: string,
): void {
  const extra = Object.keys(value).filter((k) => !keys.includes(k));
  if (extra.length) {
    throw new InvalidTier2PayloadError(
      `${where} carries fields that may not leave Tier 1: ${extra.join(', ')}`,
    );
  }
}

export interface PayloadRules {
  allowAssertions?: boolean;
}

export function tier2Payload(
  value: unknown,
  rules: PayloadRules = {},
): Tier2Payload {
  if (!isRecord(value))
    throw new InvalidTier2PayloadError('The payload must be an object');
  onlyKeys(value, ['items'], 'The payload');
  const items = value['items'];
  if (!Array.isArray(items) || !items.length) {
    throw new InvalidTier2PayloadError('The payload needs at least one item');
  }
  return Object.freeze({
    items: Object.freeze(
      items.map((item, i) => {
        if (!isRecord(item))
          throw new InvalidTier2PayloadError(`Item ${i + 1} must be an object`);
        onlyKeys(
          item,
          rules.allowAssertions
            ? ['challenge', 'answer', 'style', 'coreAssertions']
            : ['challenge', 'answer', 'style'],
          `Item ${i + 1}`,
        );
        const { challenge, answer, coreAssertions, style } = item;
        if (typeof challenge !== 'string' || !challenge.trim()) {
          throw new InvalidTier2PayloadError(`Item ${i + 1} needs a challenge`);
        }
        if (typeof answer !== 'string' || !answer.trim()) {
          throw new InvalidTier2PayloadError(`Item ${i + 1} needs an answer`);
        }
        if (style !== undefined && !isCoachingStyle(style)) {
          throw new InvalidTier2PayloadError(
            `Item ${i + 1} has an unknown coaching style`,
          );
        }
        const styled = style === undefined ? {} : { style };
        if (coreAssertions === undefined) {
          return Object.freeze({ challenge, answer, ...styled });
        }
        if (
          !Array.isArray(coreAssertions) ||
          coreAssertions.some((a) => typeof a !== 'string')
        ) {
          throw new InvalidTier2PayloadError(
            `Item ${i + 1} has core assertions that are not a list of strings`,
          );
        }
        return Object.freeze({
          challenge,
          answer,
          ...styled,
          coreAssertions: Object.freeze([...coreAssertions]),
        });
      }),
    ),
  });
}

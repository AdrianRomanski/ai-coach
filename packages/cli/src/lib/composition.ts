import { GeminiJudge } from '@ai-coach/adapter-gemini';
import {
  FilePendingJudgements,
  SystemClock,
} from '@ai-coach/adapter-local-state';
import { OllamaSparringPartner } from '@ai-coach/adapter-ollama';
import { McpVault } from '@ai-coach/adapter-vault-mcp';
import {
  Filing,
  Judging,
  Review,
  Sparring,
  type Clock,
  type Judge,
  type SparringPartner,
} from '@ai-coach/application';
import { ollamaOptions, type CoachConfig } from './config.js';

export interface Coach {
  clock: Clock;
  review: Review;
  filing: Filing;
  sparring(): Sparring;
  judging(): Judging;
  close(): Promise<void>;
}

export interface AdapterOverrides {
  partner?: (config: CoachConfig) => SparringPartner;
  judge?: (config: CoachConfig) => Judge;
}

export async function composeCoach(
  config: CoachConfig,
  today: string | undefined,
  overrides: AdapterOverrides = {},
): Promise<Coach> {
  const vault = await McpVault.connect({
    serverBin: config.docsMcpBin,
    vault: config.vault,
  });
  const pending = new FilePendingJudgements(config.stateDir);

  return {
    clock: new SystemClock(today),
    review: new Review(vault, pending),
    filing: new Filing(vault),
    sparring: () =>
      new Sparring({
        notes: vault,
        sessions: vault,
        pending,
        partner:
          overrides.partner?.(config) ??
          new OllamaSparringPartner(ollamaOptions(config)),
        rules: config.sparring,
        ladder: config.ladder,
      }),
    judging: () =>
      new Judging({
        notes: vault,
        sessions: vault,
        pending,
        judge:
          overrides.judge?.(config) ??
          new GeminiJudge({
            model: config.judge.model,
            fallbackModel: config.judge.fallbackModel,
            thinkingLevel: config.judge.thinkingLevel,
          }),
        ladder: config.ladder,
      }),
    close: () => vault.close(),
  };
}

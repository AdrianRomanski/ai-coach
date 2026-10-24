import { GeminiJudge } from '@ai-coach/adapter-gemini';
import {
  FilePendingJudgements,
  SystemClock,
} from '@ai-coach/adapter-local-state';
import {
  OllamaSparringPartner,
  OllamaStudyPartner,
  OllamaStyleClassifier,
} from '@ai-coach/adapter-ollama';
import { McpVault } from '@ai-coach/adapter-vault-mcp';
import {
  Filing,
  Judging,
  Review,
  Sparring,
  Studying,
  type Clock,
  type Judge,
  type SparringPartner,
  type StudyPartner,
  type StyleClassifier,
} from '@ai-coach/application';
import { ollamaOptions, type CoachConfig } from './config.js';

export interface Coach {
  clock: Clock;
  review: Review;
  filing: Filing;
  sparring(): Sparring;
  judging(): Judging;
  studying(): Studying;
  close(): Promise<void>;
}

export interface AdapterOverrides {
  partner?: (config: CoachConfig) => SparringPartner;
  judge?: (config: CoachConfig) => Judge;
  studyPartner?: (config: CoachConfig) => StudyPartner;
  classifier?: (config: CoachConfig) => StyleClassifier;
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
  const classifier = () =>
    overrides.classifier?.(config) ??
    new OllamaStyleClassifier(ollamaOptions(config));

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
        classifier: classifier(),
        rules: config.sparring,
        ladder: config.ladder,
      }),
    studying: () =>
      new Studying({
        notes: vault,
        partner:
          overrides.studyPartner?.(config) ??
          new OllamaStudyPartner(ollamaOptions(config)),
        classifier: classifier(),
        rules: config.sparring,
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

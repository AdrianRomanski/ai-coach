import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_OLLAMA_HOST,
  type OllamaOptions,
} from '@ai-coach/adapter-ollama';
import {
  COACHING_STYLES,
  DEFAULT_LADDER,
  sparringRules,
  validateLadder,
  type Ladder,
  type SparringRules,
} from '@ai-coach/domain';

const ConfigFile = z.strictObject({
  vault: z.string().min(1).optional(),
  docsMcpBin: z.string().min(1).optional(),
  stateDir: z.string().min(1).optional(),
  ollama: z
    .strictObject({
      model: z.string().min(1).optional(),
      host: z.string().min(1).optional(),
      contextWindow: z.number().int().min(2048).optional(),
    })
    .optional(),
  judge: z
    .strictObject({
      model: z.string().min(1).optional(),
      fallbackModel: z.string().min(1).optional(),
      thinkingLevel: z.enum(['MEDIUM', 'HIGH']).optional(),
      includeAssertions: z.boolean().optional(),
    })
    .optional(),
  sparring: z
    .strictObject({
      style: z.enum(['auto', ...COACHING_STYLES]).optional(),
      buzzwords: z.array(z.string()).optional(),
      socraticRules: z.array(z.string()).optional(),
      maxFollowUps: z.number().optional(),
      maxRephrases: z.number().optional(),
      verbatimRunWords: z.number().optional(),
      maxChallengeAttempts: z.number().optional(),
      language: z.string().optional(),
    })
    .optional(),
  ladder: z
    .strictObject({
      failDays: z.number().optional(),
      tier1PassDays: z.number().optional(),
      tier2PassDays: z.array(z.number()).optional(),
    })
    .optional(),
});
type ConfigFile = z.infer<typeof ConfigFile>;

export interface CoachConfig {
  configFile: string | null;
  vault: string | undefined;
  docsMcpBin: string;
  stateDir: string;
  ollama: { model: string | undefined; host: string; contextWindow: number };
  judge: {
    model: string | undefined;
    fallbackModel: string | undefined;
    thinkingLevel: 'MEDIUM' | 'HIGH' | undefined;
    includeAssertions: boolean;
  };
  sparring: SparringRules;
  ladder: Ladder;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface LoadConfigOptions {
  file?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  home?: string;
}

function expand(path: string, home: string, base: string): string {
  const tilde =
    path === '~' || path.startsWith('~/') ? join(home, path.slice(1)) : path;
  return resolve(base, tilde);
}

function findConfigFile(
  options: Required<Omit<LoadConfigOptions, 'file'>>,
  file?: string,
) {
  if (file) {
    const path = expand(file, options.home, options.cwd);
    if (!existsSync(path))
      throw new ConfigError(`Config file not found: ${path}`);
    return path;
  }
  const candidates = [
    join(options.cwd, 'coach.config.json'),
    join(
      options.env['XDG_CONFIG_HOME'] || join(options.home, '.config'),
      'ai-coach',
      'config.json',
    ),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

function readConfigFile(path: string | null): ConfigFile {
  if (!path) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new ConfigError(
      `${path} is not valid JSON: ${(err as Error).message}`,
    );
  }
  const parsed = ConfigFile.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(`${path}: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export function loadConfig(options: LoadConfigOptions = {}): CoachConfig {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? homedir();
  const configFile = findConfigFile({ env, cwd, home }, options.file);
  const file = readConfigFile(configFile);
  const base = configFile ? resolve(configFile, '..') : cwd;
  const path = (p: string | undefined) =>
    p ? expand(p, home, base) : undefined;
  const fromEnv = (name: string) => env[name] || undefined;

  let ladder: Ladder;
  try {
    ladder = validateLadder({ ...DEFAULT_LADDER, ...file.ladder });
  } catch (err) {
    throw new ConfigError(`ladder: ${(err as Error).message}`);
  }
  let sparring: SparringRules;
  try {
    sparring = sparringRules(file.sparring);
  } catch (err) {
    throw new ConfigError(`sparring: ${(err as Error).message}`);
  }

  return {
    configFile,
    vault: fromEnv('DOCS_MCP_VAULT')
      ? expand(env['DOCS_MCP_VAULT']!, home, cwd)
      : path(file.vault),
    docsMcpBin: fromEnv('DOCS_MCP_BIN')
      ? expand(env['DOCS_MCP_BIN']!, home, cwd)
      : (path(file.docsMcpBin) ??
        join(
          home,
          'projects',
          'kb-template',
          'packages',
          'cli',
          'bin',
          'docs-mcp.js',
        )),
    stateDir:
      path(file.stateDir) ??
      join(
        fromEnv('XDG_STATE_HOME') ?? join(home, '.local', 'state'),
        'ai-coach',
      ),
    ollama: {
      model: fromEnv('OLLAMA_MODEL') ?? file.ollama?.model,
      host: fromEnv('OLLAMA_HOST') ?? file.ollama?.host ?? DEFAULT_OLLAMA_HOST,
      contextWindow:
        contextWindow(fromEnv('OLLAMA_NUM_CTX')) ??
        file.ollama?.contextWindow ??
        DEFAULT_CONTEXT_WINDOW,
    },
    judge: {
      model: fromEnv('GEMINI_JUDGE_MODEL') ?? file.judge?.model,
      fallbackModel:
        fromEnv('GEMINI_JUDGE_FALLBACK_MODEL') ?? file.judge?.fallbackModel,
      thinkingLevel:
        thinkingLevel(fromEnv('GEMINI_JUDGE_THINKING_LEVEL')) ??
        file.judge?.thinkingLevel,
      includeAssertions: file.judge?.includeAssertions ?? true,
    },
    sparring,
    ladder,
  };
}

function thinkingLevel(
  value: string | undefined,
): 'MEDIUM' | 'HIGH' | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  if (upper !== 'MEDIUM' && upper !== 'HIGH') {
    throw new ConfigError(
      `GEMINI_JUDGE_THINKING_LEVEL must be MEDIUM or HIGH, got ${value}`,
    );
  }
  return upper;
}

export function ollamaOptions(config: CoachConfig): OllamaOptions {
  if (!config.ollama.model) {
    throw new ConfigError(
      'No Gemma model configured: set OLLAMA_MODEL or ollama.model in coach.config.json to a model from `ollama list`',
    );
  }
  return {
    model: config.ollama.model,
    host: config.ollama.host,
    contextWindow: config.ollama.contextWindow,
  };
}

function contextWindow(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const tokens = Number(value);
  if (!Number.isInteger(tokens) || tokens < 2048) {
    throw new ConfigError(
      `OLLAMA_NUM_CTX must be a whole number of tokens, at least 2048, got ${value}`,
    );
  }
  return tokens;
}

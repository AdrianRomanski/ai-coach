import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigError, loadConfig, ollamaOptions } from './config.js';

describe('loadConfig', () => {
  let dir: string;
  const base = () => ({
    cwd: dir,
    home: join(dir, 'home'),
    env: { XDG_CONFIG_HOME: join(dir, 'xdg') },
  });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ai-coach-config-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('has defaults that need no file', () => {
    const config = loadConfig(base());
    expect(config).toMatchObject({
      configFile: null,
      vault: undefined,
      docsMcpBin: join(
        dir,
        'home',
        'projects',
        'kb-template',
        'packages',
        'cli',
        'bin',
        'docs-mcp.js',
      ),
      stateDir: join(dir, 'home', '.local', 'state', 'ai-coach'),
      ollama: {
        model: undefined,
        checkModel: undefined,
        host: 'http://127.0.0.1:11434',
        contextWindow: 16_384,
      },
      judge: {
        model: undefined,
        fallbackModel: undefined,
        thinkingLevel: undefined,
      },
      ladder: { failDays: 1, tier1PassDays: 3 },
    });
    expect(config.sparring.maxFollowUps).toBe(3);
    expect(() => ollamaOptions(config)).toThrow(/OLLAMA_MODEL/);
  });

  it('reads coach.config.json, resolving ~ and relative paths, and lets the environment win', async () => {
    await writeFile(
      join(dir, 'coach.config.json'),
      JSON.stringify({
        vault: '~/Documents/life-vault',
        docsMcpBin: './bin/docs-mcp.js',
        ollama: {
          model: 'gemma-from-file',
          checkModel: 'gemma-check-from-file',
          contextWindow: 8192,
        },
        judge: { thinkingLevel: 'HIGH' },
        sparring: { buzzwords: ['synergy'], maxFollowUps: 1 },
        ladder: { tier2PassDays: [5, 10] },
      }),
    );
    const config = loadConfig({
      ...base(),
      env: {
        ...base().env,
        OLLAMA_MODEL: 'gemma-from-env',
        OLLAMA_NUM_CTX: '32768',
        GEMINI_JUDGE_FALLBACK_MODEL: 'gemini-3.8-flash',
      },
    });
    expect(config).toMatchObject({
      configFile: join(dir, 'coach.config.json'),
      vault: join(dir, 'home', 'Documents', 'life-vault'),
      docsMcpBin: join(dir, 'bin', 'docs-mcp.js'),
      ollama: {
        model: 'gemma-from-env',
        checkModel: 'gemma-check-from-file',
        contextWindow: 32_768,
      },
      judge: { thinkingLevel: 'HIGH', fallbackModel: 'gemini-3.8-flash' },
      ladder: { tier2PassDays: [5, 10], failDays: 1 },
    });
    expect(config.sparring).toMatchObject({
      buzzwords: ['synergy'],
      maxFollowUps: 1,
      maxRephrases: 2,
    });
  });

  it('rejects unknown keys, bad JSON, a bad ladder and a missing --config file', async () => {
    const file = join(dir, 'c.json');
    await writeFile(file, JSON.stringify({ valut: '~/x' }));
    expect(() => loadConfig({ ...base(), file })).toThrow(ConfigError);
    await writeFile(file, '{');
    expect(() => loadConfig({ ...base(), file })).toThrow(/not valid JSON/);
    await writeFile(
      file,
      JSON.stringify({ ladder: { tier2PassDays: [7, 3] } }),
    );
    expect(() => loadConfig({ ...base(), file })).toThrow(/ladder/);
    expect(() => loadConfig({ ...base(), file: 'missing.json' })).toThrow(
      /not found/,
    );
    expect(() =>
      loadConfig({ ...base(), env: { GEMINI_JUDGE_THINKING_LEVEL: 'LOW' } }),
    ).toThrow(/MEDIUM or HIGH/);
    expect(() =>
      loadConfig({ ...base(), env: { OLLAMA_NUM_CTX: 'lots' } }),
    ).toThrow(/OLLAMA_NUM_CTX/);
  });
});

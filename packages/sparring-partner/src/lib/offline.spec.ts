import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  assertLoopback,
  DEFAULT_OLLAMA_HOST,
  OllamaChatModel,
  ollamaOptionsFromEnv,
} from './ollama.js';
import { SparringModelError } from './model.js';
import { SparringSession } from './session.js';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

function fakeOllama(replies: unknown[]) {
  const bodies: Record<string, unknown>[] = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (req.method !== 'POST' || req.url !== '/api/chat') {
        res.writeHead(404).end();
        return;
      }
      bodies.push(JSON.parse(raw));
      const content = JSON.stringify(replies.shift());
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          model: 'gemma',
          message: { role: 'assistant', content },
          done: true,
        }),
      );
    });
  });
  return { server, bodies };
}

describe('Tier 1 offline', () => {
  const realFetch = globalThis.fetch;
  const outbound: string[] = [];
  let server: Server;
  let bodies: Record<string, unknown>[];
  let host: string;

  beforeAll(async () => {
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = new URL(input instanceof Request ? input.url : input);
      outbound.push(url.href);
      if (!LOOPBACK.has(url.hostname)) {
        throw new TypeError(`network disabled: ${url.hostname}`);
      }
      return realFetch(input, init);
    }) as typeof fetch;

    const fake = fakeOllama([
      { challenge: 'What decides which queued callback runs next, and why?' },
      {
        action: 'conclude',
        question: '',
        verdict: 'pass',
        gaps: [],
        feedback: 'Solid.',
      },
    ]);
    server = fake.server;
    bodies = fake.bodies;
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    await new Promise((resolve) => server.close(resolve));
  });

  it('runs a whole sparring round with only loopback traffic', async () => {
    const model = new OllamaChatModel({ model: 'gemma-test', host });
    const session = new SparringSession({
      model,
      note: {
        title: 'Event loop',
        body: 'Microtasks drain before macrotasks.',
      },
    });

    await session.start();
    const verdict = await session.answer(
      'Promise callbacks queue as microtasks and run first.',
    );

    expect(verdict).toMatchObject({ kind: 'verdict', verdict: 'pass' });
    expect(outbound).toHaveLength(2);
    expect(outbound.every((u) => u.startsWith(`${host}/api/chat`))).toBe(true);
    expect(bodies[0]).toMatchObject({ model: 'gemma-test', stream: false });
    expect(bodies[0]!['format']).toMatchObject({ type: 'object' });
  });

  it('proves the network guard is active', async () => {
    await expect(
      fetch('https://generativelanguage.googleapis.com/'),
    ).rejects.toThrow(/network disabled/);
  });

  it('refuses any Ollama host that is not loopback http', () => {
    for (const bad of [
      'https://127.0.0.1:11434',
      'http://192.168.1.10:11434',
      'http://ollama.example.com',
      'not a url',
    ]) {
      expect(() => new OllamaChatModel({ model: 'g', host: bad })).toThrow(
        SparringModelError,
      );
    }
    expect(assertLoopback('http://localhost:11434').port).toBe('11434');
    expect(assertLoopback('http://[::1]:11434').hostname).toBe('[::1]');
  });

  it('reports a stopped Ollama clearly', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) =>
      closed.listen(0, '127.0.0.1', resolve),
    );
    const port = (closed.address() as AddressInfo).port;
    await new Promise((resolve) => closed.close(resolve));

    const model = new OllamaChatModel({
      model: 'g',
      host: `http://127.0.0.1:${port}`,
    });
    await expect(model.chat({ messages: [], schema: {} })).rejects.toThrow(
      /not reachable/,
    );
  });

  it('reads the model and host from the environment', () => {
    expect(ollamaOptionsFromEnv({ OLLAMA_MODEL: 'gemma-x' })).toEqual({
      model: 'gemma-x',
      host: DEFAULT_OLLAMA_HOST,
    });
    expect(() => ollamaOptionsFromEnv({})).toThrow(/OLLAMA_MODEL/);
  });
});

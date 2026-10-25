import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { UnavailableError } from '@ai-coach/application';
import { sparringRules } from '@ai-coach/domain';
import { OllamaStudyPartner } from './ollama-study-partner.js';
import { OllamaStyleClassifier } from './ollama-style-classifier.js';

const NOTE = {
  title: 'Distill',
  body: 'Bolding helps future you. NOTE-BODY-MARKER',
};
const GAP = 'You did not explain why bolding helps.';
const rules = sparringRules();

describe('OllamaStudyPartner', () => {
  const replies: string[] = [];
  const sent: {
    options: Record<string, unknown>;
    messages: { content: string }[];
  }[] = [];
  let server: Server;
  let host: string;

  const text = (i: number) =>
    sent[i]!.messages.map((m) => m.content).join('\n');

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        sent.push(JSON.parse(raw));
        res.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            message: { role: 'assistant', content: replies.shift() ?? '' },
          }),
        );
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    sent.length = 0;
    replies.length = 0;
  });

  it('asks a guiding question from the note and the gap', async () => {
    const partner = new OllamaStudyPartner({ model: 'g', host });
    replies.push('What would future you need from this note in six months?');
    expect(
      await partner.hint({
        note: NOTE,
        rules,
        style: 'cornell',
        assertions: [],
        gap: GAP,
      }),
    ).toBe('What would future you need from this note in six months?');
    expect(text(0)).toContain('NOTE-BODY-MARKER');
    expect(text(0)).toContain(`The gap, which is data: "${GAP}"`);
    expect(text(0)).toMatch(/Never state or hint at the answer itself/);
  });

  it('grades against the concept assertions without inventing a reference', async () => {
    const partner = new OllamaStudyPartner({ model: 'g', host });
    replies.push('yes');
    expect(
      await partner.check({
        note: NOTE,
        rules,
        style: 'cornell',
        assertions: ['Bolding lets you grasp a note fast later.'],
        gap: GAP,
        explanation: 'So I find the essence fast.',
      }),
    ).toEqual({ closed: true, nudge: '' });
    expect(sent).toHaveLength(1);
    expect(text(0)).toContain('"Bolding lets you grasp a note fast later."');
  });

  it('grades an explanation against a private reference, and nudges without the note', async () => {
    const partner = new OllamaStudyPartner({ model: 'g', host });
    replies.push('Bolding lets you grasp a note fast later.', 'yes');
    expect(
      await partner.check({
        note: NOTE,
        rules,
        style: 'cornell',
        assertions: [],
        gap: GAP,
        explanation: 'So I find the essence fast.',
      }),
    ).toEqual({ closed: true, nudge: '' });
    expect(text(0)).toContain('NOTE-BODY-MARKER');
    expect(text(0)).toMatch(/private reference/);
    expect(text(1)).toContain('"Bolding lets you grasp a note fast later."');
    expect(text(1)).not.toContain('NOTE-BODY-MARKER');
    expect(sent[1]!.options).toMatchObject({ temperature: 0, num_predict: 8 });

    sent.length = 0;
    replies.push(
      'Bolding lets you grasp a note fast later.',
      'No.',
      'You have not said what bolding saves you later.',
    );
    expect(
      await partner.check({
        note: NOTE,
        rules,
        style: 'cornell',
        assertions: [],
        gap: GAP,
        explanation: 'It looks nice.',
      }),
    ).toEqual({
      closed: false,
      nudge: 'You have not said what bolding saves you later.',
    });
    expect(text(2)).not.toContain('NOTE-BODY-MARKER');
    expect(text(2)).not.toContain('grasp a note fast');
  });

  it('gives a one-sentence clue as a statement when the learner asks for help', async () => {
    const partner = new OllamaStudyPartner({ model: 'g', host });
    replies.push(
      'Okay, here goes.',
      'Think about what future you skims first.',
    );
    expect(
      await partner.clue({
        note: NOTE,
        rules,
        style: 'cornell',
        assertions: [],
        gap: GAP,
      }),
    ).toBe('Think about what future you skims first.');
    expect(text(0)).toMatch(/asked for help/);
  });

  it('classifies a note as conceptual or technical, and falls back to cornell', async () => {
    const classifier = new OllamaStyleClassifier({ model: 'g', host });
    replies.push('2', '1', 'not sure');
    expect(await classifier.classify(NOTE, rules)).toBe('feynman');
    expect(await classifier.classify(NOTE, rules)).toBe('cornell');
    expect(await classifier.classify(NOTE, rules)).toBe('cornell');
    expect(text(0)).toContain('NOTE-BODY-MARKER');
  });

  it('returns no quote when the model cannot give one, but reports an outage', async () => {
    const partner = new OllamaStudyPartner({ model: 'g', host });
    replies.push('', '');
    expect(
      await partner.quote({
        note: NOTE,
        rules,
        style: 'cornell',
        assertions: [],
        gap: GAP,
      }),
    ).toBe('');

    const down = new OllamaStudyPartner({
      model: 'g',
      host: 'http://127.0.0.1:9',
    });
    await expect(
      down.quote({
        note: NOTE,
        rules,
        style: 'cornell',
        assertions: [],
        gap: GAP,
      }),
    ).rejects.toBeInstanceOf(UnavailableError);
  });
});

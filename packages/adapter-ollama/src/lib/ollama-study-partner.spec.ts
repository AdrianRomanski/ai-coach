import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { UnavailableError } from '@ai-coach/application';
import { sparringRules } from '@ai-coach/domain';
import { OllamaStudyPartner } from './ollama-study-partner.js';

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
    expect(await partner.hint({ note: NOTE, rules, gap: GAP })).toBe(
      'What would future you need from this note in six months?',
    );
    expect(text(0)).toContain('NOTE-BODY-MARKER');
    expect(text(0)).toContain(`The gap, which is data: "${GAP}"`);
    expect(text(0)).toMatch(/Never state or hint at the answer itself/);
  });

  it('checks an explanation, and nudges without the note when the gap stays open', async () => {
    const partner = new OllamaStudyPartner({ model: 'g', host });
    replies.push('yes');
    expect(
      await partner.check({
        note: NOTE,
        rules,
        gap: GAP,
        explanation: 'So I find the essence fast.',
      }),
    ).toEqual({
      closed: true,
      nudge: '',
    });
    expect(sent[0]!.options).toMatchObject({ temperature: 0, num_predict: 8 });

    sent.length = 0;
    replies.push('No.', 'You have not said what bolding saves you later.');
    expect(
      await partner.check({
        note: NOTE,
        rules,
        gap: GAP,
        explanation: 'It looks nice.',
      }),
    ).toEqual({
      closed: false,
      nudge: 'You have not said what bolding saves you later.',
    });
    expect(text(1)).not.toContain('NOTE-BODY-MARKER');
  });

  it('returns no quote when the model cannot give one, but reports an outage', async () => {
    const partner = new OllamaStudyPartner({ model: 'g', host });
    replies.push('', '');
    expect(await partner.quote({ note: NOTE, rules, gap: GAP })).toBe('');

    const down = new OllamaStudyPartner({
      model: 'g',
      host: 'http://127.0.0.1:9',
    });
    await expect(
      down.quote({ note: NOTE, rules, gap: GAP }),
    ).rejects.toBeInstanceOf(UnavailableError);
  });
});

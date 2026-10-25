import { stripVTControlCharacters } from 'node:util';
import type { FilingPlan, FilingRequest } from '@ai-coach/application';
import { archive } from './commands.js';
import type { Coach } from './composition.js';
import type { Terminal } from './terminal.js';

class ScriptedTerminal implements Terminal {
  readonly output: string[] = [];
  constructor(private readonly inputs: string[]) {}
  print(text = ''): void {
    this.output.push(text);
  }
  async ask(prompt: string): Promise<string | null> {
    this.output.push(prompt);
    return this.inputs.length ? this.inputs.shift()! : null;
  }
  text(): string {
    return stripVTControlCharacters(this.output.join('\n'));
  }
}

const SUGGESTIONS = [
  {
    path: '1.Projects/Talk/Concepts/CODE.md',
    to: '3.Resources/Concepts',
    reasons: ['concept note', 'has sparring history'],
  },
  {
    path: '1.Projects/Talk/Reading notes.md',
    to: '3.Resources/Talk',
    reasons: ['cites raw material'],
  },
];

function coachWith(
  previewed: FilingRequest[],
  applied: FilingRequest[],
): Coach {
  const plan = (request: FilingRequest, executed: boolean): FilingPlan => ({
    actions: [{ op: 'move', from: '1.Projects/Talk', to: '4.Archive/Talk' }],
    collisions: [],
    warnings: [],
    suggestions: request.kind === 'archive' ? SUGGESTIONS : [],
    executed,
  });
  return {
    filing: {
      preview: async (request: FilingRequest) => {
        previewed.push(request);
        return plan(request, false);
      },
      apply: async (request: FilingRequest) => {
        applied.push(request);
        return plan(request, true);
      },
    },
  } as unknown as Coach;
}

describe('coach archive', () => {
  it('lists the notes worth keeping with their reasons and keeps the ones picked', async () => {
    const previewed: FilingRequest[] = [];
    const applied: FilingRequest[] = [];
    const term = new ScriptedTerminal(['1', 'y']);
    await archive(coachWith(previewed, applied), term, ['Talk']);

    expect(term.text()).toContain(
      '1.Projects/Talk/Concepts/CODE.md → 3.Resources/Concepts',
    );
    expect(term.text()).toContain('concept note; has sparring history');
    expect(applied).toEqual([
      {
        kind: 'archive',
        project: 'Talk',
        keep: [
          {
            note: '1.Projects/Talk/Concepts/CODE.md',
            to: '3.Resources/Concepts',
          },
        ],
      },
    ]);
  });

  it('keeps every suggestion on Enter and none on "none"', async () => {
    const all: FilingRequest[] = [];
    await archive(coachWith([], all), new ScriptedTerminal(['', 'y']), [
      'Talk',
    ]);
    expect(all[0]).toMatchObject({
      keep: SUGGESTIONS.map((s) => ({ note: s.path, to: s.to })),
    });

    const none: FilingRequest[] = [];
    await archive(coachWith([], none), new ScriptedTerminal(['none', 'y']), [
      'Talk',
    ]);
    expect(none[0]).toMatchObject({ keep: [] });
  });

  it('moves nothing when the learner declines', async () => {
    const applied: FilingRequest[] = [];
    await archive(coachWith([], applied), new ScriptedTerminal(['1', 'n']), [
      'Talk',
    ]);
    expect(applied).toEqual([]);
  });
});

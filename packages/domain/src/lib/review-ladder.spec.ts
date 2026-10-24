import {
  DEFAULT_LADDER,
  addDays,
  ladderRung,
  scheduleReview,
  validateLadder,
  type Tier2Outcome,
} from './review-ladder.js';
import { DomainError } from './errors.js';

const pass: Tier2Outcome = { verdict: 'pass', gaps: 0 };
const fail = (gaps: number): Tier2Outcome => ({ verdict: 'fail', gaps });
const DATE = '2026-10-24';

describe('addDays', () => {
  it('crosses month, year and leap-day boundaries in calendar days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-25', 7)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('rejects anything that is not a real YYYY-MM-DD date', () => {
    for (const bad of ['2026-02-30', '2026-1-5', '24.10.2026', '']) {
      expect(() => addDays(bad, 1)).toThrow(DomainError);
    }
  });
});

describe('Tier 1', () => {
  it('reviews a fail tomorrow and a pass in 3 days, without moving the ladder', () => {
    const history = [pass, pass];
    expect(
      scheduleReview({
        tier: 1,
        verdict: 'fail',
        gaps: 2,
        date: DATE,
        tier2History: history,
      }),
    ).toEqual({ nextReview: '2026-10-25', intervalDays: 1, rung: 1 });
    expect(
      scheduleReview({
        tier: 1,
        verdict: 'pass',
        gaps: 0,
        date: DATE,
        tier2History: history,
      }),
    ).toEqual({ nextReview: '2026-10-27', intervalDays: 3, rung: 1 });
  });
});

describe('Tier 2', () => {
  it('climbs 7, 14, 30, 60 days with consecutive passes', () => {
    const history: Tier2Outcome[] = [];
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      intervals.push(
        scheduleReview({
          tier: 2,
          verdict: 'pass',
          gaps: 0,
          date: DATE,
          tier2History: history,
        }).intervalDays,
      );
      history.push(pass);
    }
    expect(intervals).toEqual([7, 14, 30, 60]);
  });

  it('stays on the top rung once it is reached', () => {
    const history = Array.from({ length: 12 }, () => pass);
    expect(
      scheduleReview({
        tier: 2,
        verdict: 'pass',
        gaps: 0,
        date: DATE,
        tier2History: history,
      }),
    ).toMatchObject({ intervalDays: 365, rung: 6 });
  });

  it('reviews a fail tomorrow and drops one rung per gap, at least one', () => {
    const atThirty = [pass, pass, pass];
    expect(ladderRung(atThirty)).toBe(2);

    expect(
      scheduleReview({
        tier: 2,
        verdict: 'fail',
        gaps: 0,
        date: DATE,
        tier2History: atThirty,
      }),
    ).toEqual({ nextReview: '2026-10-25', intervalDays: 1, rung: 1 });
    expect(
      scheduleReview({
        tier: 2,
        verdict: 'fail',
        gaps: 2,
        date: DATE,
        tier2History: atThirty,
      }),
    ).toMatchObject({ intervalDays: 1, rung: 0 });
    expect(
      scheduleReview({
        tier: 2,
        verdict: 'fail',
        gaps: 9,
        date: DATE,
        tier2History: atThirty,
      }),
    ).toMatchObject({ rung: -1 });
  });

  it('climbs again from where the gaps left it', () => {
    const history = [pass, pass, pass, fail(2)];
    expect(ladderRung(history)).toBe(0);
    expect(
      scheduleReview({
        tier: 2,
        verdict: 'pass',
        gaps: 0,
        date: DATE,
        tier2History: history,
      }),
    ).toMatchObject({ intervalDays: 14, rung: 1 });
  });

  it('starts a never-judged note on the first rung', () => {
    expect(
      scheduleReview({
        tier: 2,
        verdict: 'pass',
        gaps: 0,
        date: DATE,
        tier2History: [],
      }),
    ).toEqual({ nextReview: '2026-10-31', intervalDays: 7, rung: 0 });
  });
});

describe('ladder configuration', () => {
  it('accepts a custom ladder', () => {
    const ladder = { failDays: 2, tier1PassDays: 4, tier2PassDays: [5, 10] };
    expect(
      scheduleReview(
        {
          tier: 2,
          verdict: 'pass',
          gaps: 0,
          date: DATE,
          tier2History: [pass, pass, pass],
        },
        ladder,
      ),
    ).toMatchObject({ intervalDays: 10, rung: 1 });
  });

  it('rejects ladders that do not make sense', () => {
    expect(() => validateLadder({ ...DEFAULT_LADDER, failDays: 0 })).toThrow(
      DomainError,
    );
    expect(() =>
      validateLadder({ ...DEFAULT_LADDER, tier2PassDays: [] }),
    ).toThrow(DomainError);
    expect(() =>
      validateLadder({ ...DEFAULT_LADDER, tier2PassDays: [7, 7] }),
    ).toThrow(DomainError);
    expect(() =>
      validateLadder({ ...DEFAULT_LADDER, tier1PassDays: 1.5 }),
    ).toThrow(DomainError);
  });

  it('rejects a negative or fractional gap count', () => {
    expect(() =>
      scheduleReview({
        tier: 2,
        verdict: 'fail',
        gaps: -1,
        date: DATE,
        tier2History: [],
      }),
    ).toThrow(DomainError);
  });
});

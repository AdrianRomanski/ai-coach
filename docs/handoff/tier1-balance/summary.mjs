import { readFileSync } from 'node:fs';

const rows = readFileSync(process.argv[2], 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));
const cats = [...new Set(rows.map((r) => r.cat))];
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-');

console.log(
  'type       expect  runs  errors  model-fail  no-gaps  old-right  single-right  vote-right  assert-right',
);
for (const cat of cats) {
  const all = rows.filter((r) => r.cat === cat);
  const ok = all.filter((r) => !r.error);
  const expect = ok[0]?.expect ?? '?';
  const right = (v) => ok.filter((r) => r[`${v}Verdict`] === expect).length;
  console.log(
    [
      cat.padEnd(10),
      expect.padEnd(6),
      String(all.length).padStart(5),
      String(all.length - ok.length).padStart(7),
      pct(ok.filter((r) => r.modelVerdict === 'fail').length, ok.length).padStart(10),
      pct(ok.filter((r) => r.gaps.length === 0).length, ok.length).padStart(8),
      (ok[0]?.oldVerdict ? pct(right('old'), ok.length) : '-').padStart(9),
      pct(right('single'), ok.length).padStart(13),
      (ok[0]?.voteVerdict ? pct(right('vote'), ok.length) : '-').padStart(11),
      (ok[0]?.assertVerdict ? pct(right('assert'), ok.length) : '-').padStart(13),
    ].join(' '),
  );
}

const ok = rows.filter((r) => !r.error);
const emptyRaw = ok.filter((r) => r.rawGaps?.length === 0).length;
const filtered = ok.filter((r) => r.grounded ? r.grounded.length === 0 && r.gaps.length > 0 : r.rawGaps?.length > 0 && r.gaps.length === 0).length;
console.log(
  `\nno gaps after the model: ${emptyRaw}; rounds where the grounding filter removed every gap: ${filtered}; avg ${Math.round(ok.reduce((s, r) => s + r.ms, 0) / ok.length)} ms per round`,
);

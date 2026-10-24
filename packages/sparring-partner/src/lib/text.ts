const EXTRA_FOLDS: Record<string, string> = {
  ł: 'l',
  Ł: 'l',
  ø: 'o',
  Ø: 'o',
  đ: 'd',
  Đ: 'd',
  ß: 'ss',
};

export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[łŁøØđĐß]/g, (c) => EXTRA_FOLDS[c] ?? c)
    .toLowerCase();
}

export function words(text: string): string[] {
  return fold(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function findBuzzwords(text: string, buzzwords: string[]): string[] {
  const haystack = ` ${words(text).join(' ')} `;
  const found = new Set<string>();
  for (const buzzword of buzzwords) {
    const needle = words(buzzword).join(' ');
    if (needle && haystack.includes(` ${needle} `)) found.add(buzzword);
  }
  return [...found];
}

export function longestSharedRun(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  let best = 0;
  let prev = new Array<number>(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const row = new Array<number>(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) {
        row[j] = prev[j - 1]! + 1;
        if (row[j]! > best) best = row[j]!;
      }
    }
    prev = row;
  }
  return best;
}

export function quotesSource(
  text: string,
  source: string,
  runWords: number,
): boolean {
  return longestSharedRun(text, source) >= runWords;
}

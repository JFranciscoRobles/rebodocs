// Matching two sequences: which items of one are the same as which of the
// other, in order. What versions and tracked changes are worked out with.

/** Past this many cells, two stretches are taken as not matching at all, rather than worked out. */
const MAX_CELLS = 16_000_000;

/** The pairs of indices of a longest run of items common to `a` and `b`, in order. */
export function commonPairs<T>(a: T[], b: T[], same: (x: T, y: T) => boolean = (x, y) => x === y, limit = MAX_CELLS): [number, number][] {
  let start = 0;
  while (start < a.length && start < b.length && same(a[start], b[start])) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && same(a[endA - 1], b[endB - 1])) {
    endA--;
    endB--;
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < start; i++) pairs.push([i, i]);
  const n = endA - start;
  const m = endB - start;
  if (n > 0 && m > 0 && n * m <= limit) {
    // The length of the longest common run from each pair of places on.
    const table = new Uint32Array((n + 1) * (m + 1));
    const at = (i: number, j: number) => i * (m + 1) + j;
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[at(i, j)] = same(a[start + i], b[start + j]) ? table[at(i + 1, j + 1)] + 1 : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (same(a[start + i], b[start + j])) {
        pairs.push([start + i, start + j]);
        i++;
        j++;
      } else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) i++;
      else j++;
    }
  }
  for (let k = 0; k < a.length - endA; k++) pairs.push([endA + k, endB + k]);
  return pairs;
}


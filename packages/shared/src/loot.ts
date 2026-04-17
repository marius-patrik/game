export type WeightedEntry<T> = { value: T; weight: number };

export function pickWeighted<T>(
  table: readonly WeightedEntry<T>[],
  rng: () => number = Math.random,
): T {
  if (table.length === 0) throw new Error("pickWeighted: empty table");
  let total = 0;
  for (const e of table) {
    if (e.weight <= 0) continue;
    total += e.weight;
  }
  if (total <= 0) throw new Error("pickWeighted: non-positive total weight");
  const roll = rng() * total;
  let acc = 0;
  for (const e of table) {
    if (e.weight <= 0) continue;
    acc += e.weight;
    if (roll < acc) return e.value;
  }
  return table[table.length - 1]!.value;
}

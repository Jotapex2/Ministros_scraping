export async function pAll<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<unknown>,
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const i = index++;
      try {
        await fn(items[i], i);
        results.push({ status: "fulfilled", value: undefined });
      } catch (error) {
        results.push({ status: "rejected", reason: error });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => next(),
  );
  await Promise.all(workers);
  return results;
}

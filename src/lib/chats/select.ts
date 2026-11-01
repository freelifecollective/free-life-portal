/** Runs the same read with fewer and fewer columns until one works, so the portal keeps working before a new database update has been run. */
export async function firstOk<T>(tries: (() => PromiseLike<{ data: T | null; error: unknown }>)[]): Promise<T | null> {
  for (const t of tries) {
    const r = await t();
    if (!r.error) return r.data;
  }
  return null;
}

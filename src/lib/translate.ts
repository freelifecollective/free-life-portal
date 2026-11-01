import "server-only";

const cache = new Map<string, { text: string; same: boolean }>();

/** Google Translate's free web endpoint. `same` is true when the text was already in the target language. */
export async function googleTranslate(text: string, to: string): Promise<{ text: string; same: boolean } | null> {
  const key = to + "\n" + text;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const res = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + to + "&dt=t", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "q=" + encodeURIComponent(text),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as [Array<[string]> | null, unknown, string?];
    const out = (json[0] ?? []).map((s) => s?.[0] ?? "").join("");
    const same = json[2] === to || !out.trim();
    const value = { text: same ? text : out, same };
    if (cache.size > 3000) cache.clear();
    cache.set(key, value);
    return value;
  } catch {
    return null;
  }
}

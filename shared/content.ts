import type { WordInput } from "./model";
// Order, typography, whitespace and tags do not make a new edition.
export async function contentHash(words: Pick<WordInput, "word" | "meaning" | "example">[]) {
  const clean = (s: string) => s.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const rows = words.map(w => JSON.stringify([clean(w.word).toLowerCase(), clean(w.meaning), clean(w.example ?? "")])).sort();
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(rows)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

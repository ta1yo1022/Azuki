import { wordExamples, type WordInput } from "./model.ts";
// Order, typography, whitespace and tags do not make a new edition.
export async function contentHash(words: Pick<WordInput, "word" | "meaning" | "example" | "examples">[]) {
  const clean = (s: string) => s.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const rows = words.map(w => {
    const examples = wordExamples(w);
    const row:unknown[] = [clean(w.word).toLowerCase(), clean(w.meaning), clean(examples[0]?.text ?? '')];
    // Keep existing fingerprints stable for legacy single-sentence books.
    if (examples.length > 1 || examples.some(e=>e.translation)) row.push(examples.map(e=>[clean(e.text),clean(e.translation ?? '')]));
    return JSON.stringify(row);
  }).sort();
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(rows)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

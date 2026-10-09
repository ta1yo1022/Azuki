import { LIMITS, parseDeck, ValidationError } from "../../shared/model";

// Import files contain vocabulary only; deck metadata comes from the form.
export function parseImportWords(raw: string) {
  if (new TextEncoder().encode(raw).length > LIMITS.bytes) throw new ValidationError("JSONは512KB以内にしてください。");
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw new ValidationError("JSONの形式を確認してください。ダブルクォートやカンマの抜けがないか確認してください。"); }
  const words = Array.isArray(data) ? data : data && typeof data === "object" ? (data as Record<string, unknown>).words : undefined;
  return parseDeck(JSON.stringify({ title: "単語の確認", words })).words;
}
export const WORDS_EXAMPLE_JSON = JSON.stringify({ words: [
  { word: "hello", meaning: "こんにちは", example: "Hello, how are you?" },
  { word: "travel", meaning: "旅行する", example: "I like to travel by train." },
] }, null, 2);

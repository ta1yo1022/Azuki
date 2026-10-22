import {decodeToon,encodeToon} from '../../shared/toon';
import { LIMITS, parseDeck, ValidationError } from "../../shared/model";

// Import files contain vocabulary only; deck metadata comes from the form.
export function parseImportWords(raw: string) {
  if (new TextEncoder().encode(raw).length > LIMITS.bytes) throw new ValidationError("TOONは512KB以内にしてください。");
  let data: unknown;
  try { data = decodeToon(raw); }
  catch (e) { throw new ValidationError(e instanceof Error?e.message:"TOONの形式を確認してください。"); }
  if(!data||typeof data!=="object")throw new ValidationError("TOONの形式を確認してください。");
  const words = Array.isArray(data) ? data : data && typeof data === "object" ? (data as Record<string, unknown>).words : undefined;
  return parseDeck(JSON.stringify({ title: "単語の確認", words })).words;
}
export const WORDS_EXAMPLE_TOON = encodeToon({ words: [
  { word: "hello", meaning: "こんにちは", example: "Hello, how are you?" },
  { word: "travel", meaning: "旅行する", example: "I like to travel by train." },
] });

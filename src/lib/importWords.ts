import {decodeToon,encodeToon} from '../../shared/toon';
import { LIMITS, parseDeck, ValidationError } from "../../shared/model";
import {parseVocabulary} from '../../shared/vocabulary';
import type {Language} from '../../shared/languages';

// Completed wordbooks must never go through the word-only AI input, which
// intentionally extracts terms and has a smaller (500-word) limit.
export function readCreationToon(raw:string,language:Language='en') {
  const data=decodeToon(raw);
  const values=Array.isArray(data)?data:data&&typeof data==='object'&&'words' in data?(data as {words:unknown}).words:null;
  const hasContent=Array.isArray(values)&&values.some(value=>value&&typeof value==='object'&&['meaning','example','examples','translation','tags'].some(key=>Object.hasOwn(value,key)));
  return hasContent
    ? {kind:'complete' as const,words:parseImportWords(raw)}
    : {kind:'terms' as const,terms:parseVocabulary(raw,language)};
}

// Import files contain vocabulary only; deck metadata comes from the form.
export function parseImportWords(raw: string) {
  if (new TextEncoder().encode(raw).length > LIMITS.bytes) throw new ValidationError("TOONは512KB以内にしてください。");
  let data: unknown;
  try { data = decodeToon(raw); }
  catch (e) { throw new ValidationError(e instanceof Error?e.message:"TOONの形式を確認してください。"); }
  if(!data||typeof data!=="object")throw new ValidationError("TOONの形式を確認してください。");
  const words = Array.isArray(data) ? data : data && typeof data === "object" ? (data as Record<string, unknown>).words : undefined;
  // A flat TOON table can pair the legacy `example` field with `translation`.
  // Convert it to the canonical examples array so the translation is retained.
  const normalized=Array.isArray(words)?words.map(word=>{
    if(word&&typeof word==='object'&&word.examples===undefined&&typeof word.example==='string'&&Object.hasOwn(word,'translation')){
      return {...word,examples:[{text:word.example,translation:word.translation}]};
    }
    return word;
  }):words;
  return parseDeck(JSON.stringify({ title: "単語の確認", words:normalized })).words;
}
export const WORDS_EXAMPLE_TOON = encodeToon({ words: [
  { word: "hello", meaning: "こんにちは", examples: [{text:"Hello, how are you?",translation:"こんにちは、お元気ですか？"}] },
  { word: "travel", meaning: "旅行する", examples: [{text:"I like to travel by train.",translation:"私は電車で旅行するのが好きです。"}] },
] });

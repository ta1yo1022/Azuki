import { expect, it } from "vitest";
import { parseImportWords } from "../src/lib/importWords";
const words = [{ word: "hello", meaning: "こんにちは", example: "Hello, everyone." }];
it('accepts words without deck metadata and accepts a bare array', () => {
  expect(parseImportWords(JSON.stringify({ words }))).toEqual([{ ...words[0], tags: [] }]);
  expect(parseImportWords(JSON.stringify(words))).toEqual(parseImportWords(JSON.stringify({ words })));
});
it('extracts only words from legacy files', () => {
  expect(parseImportWords(JSON.stringify({ title: "旧名称", textbookTags: [{ name: "旧教材" }], words }))).toEqual([{ ...words[0], tags: [] }]);
});
it('retains word validation and limits', () => {
  expect(() => parseImportWords('{')).toThrow('JSONの形式');
  expect(() => parseImportWords('{"words":[]}')).toThrow('1語以上');
  expect(() => parseImportWords(JSON.stringify({ words: [{ word: "hello" }] }))).toThrow('意味');
  expect(() => parseImportWords(JSON.stringify({ words: [...words, ...words] }))).toThrow('重複');
  expect(() => parseImportWords(' '.repeat(512 * 1024 + 1))).toThrow('512KB');
});

it('accepts 5,000 words and rejects a larger book',()=>{
 const input=Array.from({length:5000},(_,i)=>({word:`word-${i}`,meaning:'意味'}));
 expect(parseImportWords(JSON.stringify(input))).toHaveLength(5000);
 expect(()=>parseImportWords(JSON.stringify([...input,{word:'extra',meaning:'追加'}]))).toThrow('5000');
});

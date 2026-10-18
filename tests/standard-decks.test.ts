import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { standardDecks, findStandardDecks } from '../shared/standardDecks';
import { standardWords } from '../src/lib/standardRepository';
import { LIMITS, parseDeck } from '../shared/model';
import { cefrEntryKey, validateCefrEditorial } from '../shared/cefrjEditorial';
const source = JSON.parse(readFileSync('content/cefrj/source-entries.json','utf8'));
afterEach(() => vi.unstubAllGlobals());
const editorial = validateCefrEditorial(source, ['a-levels.json','b1.json','b2.json','b2-tail.json'].flatMap(file => JSON.parse(readFileSync(`content/cefrj/editorial/${file}`, 'utf8'))));
it('preserves all source entries in order, split evenly within each CEFR level', () => {
  expect(standardDecks.filter(d=>d.contentSource === "cefrj").map(d=>d.wordCount)).toEqual([583,583,706,705,1223,1222,1390,1389]);
  for (const level of ['A1','A2','B1','B2']) {
    const books = standardDecks.filter(d=>d.cefrLevel === level);
    const words = books.flatMap(book => {
      const data = JSON.parse(readFileSync(`public/content/cefrj/${book.file}`,'utf8'));
      expect(data).toHaveLength(book.wordCount);
      expect(parseDeck(JSON.stringify({title:book.title,words:data}),{maxWords:LIMITS.forkWords,allowExampleVariants:true}).words).toHaveLength(book.wordCount);
      expect(new Set(data.map((w:any)=>w.id)).size).toBe(book.wordCount);
      data.forEach((w:any,i:number)=>{expect(w.ordinal).toBe(i);expect(w.meaning).toMatch(/[ぁ-んァ-ン一-龥]/);expect(w.example).toMatch(/[A-Za-z]/);expect(Array.isArray(w.otherMeanings)).toBe(true);expect(w.otherMeanings).not.toContain(w.meaning);expect(w.tags).toHaveLength(2);expect(w.tags[1]).toBe(level);});
      return data;
    });
    const levelSource = source.filter((r:any)=>r.level===level);
    expect(words.map(w=>w.word)).toEqual(levelSource.map((r:any)=>r.word));
    words.forEach((word, index) => {
      const entry = editorial.get(cefrEntryKey(levelSource[index]))!;
      expect(word.meaning).toBe(entry.meaning);
      expect(word.example).toBe(entry.example);
      expect(word.otherMeanings).toEqual(entry.otherMeanings);
      expect(word.usageNote).toBe(entry.usageNote);
    });
  }
  expect(findStandardDecks('CEFR-J A2 後編').map(d=>d.title)).toEqual(['CEFR-J A2 後編']);
});
it('pages beyond 500 without omissions, caches the downloaded file, and searches after the first page', async () => {
  const book = standardDecks[7];
  const data = JSON.parse(readFileSync(`public/content/cefrj/${book.file}`,'utf8'));
  const fetch = vi.fn(async()=>Response.json(data));vi.stubGlobal('fetch',fetch);
  let cursor:number|null=0;const all=[];
  while(cursor !== null) {const page=await standardWords(book.id,'',cursor);all.push(...page.words);cursor=page.nextCursor;}
  expect(all).toEqual(data);expect(fetch).toHaveBeenCalledTimes(1);
  const tail=data.at(-1);
  const found=await standardWords(book.id,tail.word,0);
  expect(found.words.some(w=>w.id===tail.id)).toBe(true);
  const withOther=data.find((w:any)=>w.otherMeanings?.length);
  expect(withOther).toBeDefined();
  const additional=await standardWords(book.id,withOther.otherMeanings[0],0);
  expect(additional.words.some(w=>w.id===withOther.id)).toBe(true);
  const controller=new AbortController();controller.abort();
  await expect(standardWords(book.id,'',0,controller.signal)).rejects.toThrow();
});
it('does not relax the user import limit for standard books', () => {
  expect(()=>parseDeck(JSON.stringify({title:'import',words:Array.from({length:501},(_,i)=>({word:`word${i}`,meaning:'単語',tags:[]}))}))).toThrow('500');
});

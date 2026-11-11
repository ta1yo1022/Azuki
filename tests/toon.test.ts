import {it,expect} from 'vitest';
import {encodeToon,decodeToon} from '../shared/toon';
import {parseImportWords} from '../src/lib/importWords';
it('round-trips Japanese meanings, commas, quotes, newlines and multiple translated examples',()=>{
 const input={words:[{word:'curious',meaning:'好奇心の強い、知りたがる',examples:[{text:'She said, "I am curious."',translation:'彼女は「気になります」と言いました。\n彼女は好奇心が強いです。'},{text:'He is curious about space.',translation:'彼は宇宙に興味があります。'}],tags:['形容詞']}]};
 const raw=encodeToon(input);expect(decodeToon(raw)).toEqual(input);expect(parseImportWords(raw)[0].examples).toEqual(input.words[0].examples);
});
it('rejects truncated tables, duplicate keys, oversized declarations and excessive indentation',()=>{
 expect(()=>decodeToon('words[2]{word,meaning}:\n  book,本')).toThrow('TOON');
 expect(()=>decodeToon('words[1]: book\nwords[1]: agree')).toThrow('TOON');
 expect(()=>decodeToon('words[999999999999]:')).toThrow('5,000');
 expect(()=>decodeToon('a:\n'+' '.repeat(66)+'b: text')).toThrow('字下げ');
});
it('accepts a TOON code fence but does not silently import a JSON document',()=>{
 const text='words[1]{word,meaning}:\n  book,本';expect(parseImportWords('```toon\n'+text+'\n```')).toEqual(parseImportWords(text));expect(()=>parseImportWords('{"words":[{"word":"book","meaning":"本"}]}')).toThrow();
});
it('materializes prototype-looking keys without changing object prototypes',()=>{
 const result=decodeToon('__proto__:\n  azukiPolluted: true\nconstructor: harmless') as Record<string,unknown>;
 expect(Object.hasOwn(result,'__proto__')).toBe(true);expect(({} as any).azukiPolluted).toBeUndefined();
});

it('keeps every translated example when the creation entry receives complete TOON',async()=>{
 const {readCreationToon,WORDS_EXAMPLE_TOON}=await import('../src/lib/importWords');
 const {DECK_PROMPT,IMAGE_PROMPT}=await import('../src/components/CreateGuide');
 for(const raw of [WORDS_EXAMPLE_TOON,...[DECK_PROMPT,IMAGE_PROMPT].map(prompt=>prompt.slice(prompt.lastIndexOf('\nwords[')+1))]){
  const result=readCreationToon(raw);expect(result.kind).toBe('complete');
  if(result.kind==='complete'){expect(result.words.every(word=>word.examples?.every(example=>example.translation))).toBe(true);expect(result.words[0].meaning).toBeTruthy();}
 }
 const input={words:[{word:'book',meaning:'本',examples:[{text:'I read a book.',translation:'私は本を読みます。'},{text:'This book is new.',translation:'この本は新しいです。'}],tags:['noun']}]};
 const result=readCreationToon(encodeToon(input));expect(result.kind).toBe('complete');if(result.kind==='complete')expect(result.words[0]).toMatchObject(input.words[0]);
});
it('applies the right size limit to completed TOON and rejects incomplete content instead of dropping it',async()=>{
 const {readCreationToon}=await import('../src/lib/importWords');
 const words=Array.from({length:501},(_,i)=>({word:`word${i}`,meaning:`意味${i}`,examples:[{text:'Example.',translation:'例文です。'}]}));
 const result=readCreationToon(encodeToon({words}));expect(result.kind).toBe('complete');if(result.kind==='complete')expect(result.words).toHaveLength(501);
 expect(readCreationToon('words[2]: book,travel')).toEqual({kind:'terms',terms:['book','travel']});
 expect(()=>readCreationToon(encodeToon({words:[{word:'book',examples:[{text:'A book.',translation:'本です。'}]}]}))).toThrow('意味');
});
it('preserves translations in a flat TOON table using legacy example and translation columns',()=>{
 const raw='words[1]{word,meaning,example,translation}:\n  book,本,I read a book.,私は本を読みます。';
 expect(parseImportWords(raw)[0].examples).toEqual([{text:'I read a book.',translation:'私は本を読みます。'}]);
});

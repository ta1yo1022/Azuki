import {it,expect} from 'vitest';
import {encodeJson,decodeJson} from '../shared/json';
import {parseImportWords,readCreationJson,WORDS_EXAMPLE_JSON} from '../src/lib/importWords';
it('round-trips commas, quotation marks, newlines and multiple translated examples',()=>{
 const input={words:[{word:'curious',meaning:'好奇心の強い',examples:[{text:'She said, "I am curious."',translation:'彼女は「気になります」と言いました。\n好奇心があります。'},{text:'First, I was curious.',translation:'最初は、気になっていました。'}]}]};
 expect(decodeJson(encodeJson(input))).toEqual(input);expect(parseImportWords(encodeJson(input))[0].examples).toEqual(input.words[0].examples);
 expect(readCreationJson(encodeJson(input)).kind).toBe('complete');
});
it('accepts JSON fences and a BOM but rejects incomplete JSON and TOON',()=>{
 expect(decodeJson('\uFEFF```json\n{"words":["book"]}\n```')).toEqual({words:['book']});
 for(const raw of ['{"words":[','{"words":[],}','words[1]: book'])expect(()=>decodeJson(raw)).toThrow('JSON');
 expect(()=>decodeJson(' '.repeat(512*1024+1))).toThrow('512KB');
});
it('keeps prototype-looking data from modifying prototypes',()=>{
 const value=decodeJson('{"__proto__":{"azukiPolluted":true}}') as object;
 expect(Object.hasOwn(value,'__proto__')).toBe(true);expect(({} as any).azukiPolluted).toBeUndefined();
});
it('distinguishes completed imports from word-only generation input',()=>{
 expect(readCreationJson(WORDS_EXAMPLE_JSON).kind).toBe('complete');
 expect(readCreationJson('{"words":["book","travel"]}')).toEqual({kind:'terms',terms:['book','travel']});
 const words=Array.from({length:501},(_,i)=>({word:`word${i}`,meaning:'意味',examples:[{text:'First, read this.',translation:'最初に、読んで。'}]}));
 const result=readCreationJson(encodeJson({words}));expect(result.kind).toBe('complete');if(result.kind==='complete')expect(result.words).toHaveLength(501);
 expect(()=>readCreationJson(encodeJson({words:[{word:'book',examples:[{text:'A book.'}]}]}))).toThrow('意味');
});
it('preserves legacy example translations',()=>{
 expect(parseImportWords('{"words":[{"word":"book","meaning":"本","example":"I read a book.","translation":"本を読みます。"}]}')[0].examples).toEqual([{text:'I read a book.',translation:'本を読みます。'}]);
});

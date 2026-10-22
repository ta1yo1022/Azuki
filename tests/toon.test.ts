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

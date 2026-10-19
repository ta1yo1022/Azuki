import {it,expect} from 'vitest';
import {parseDeck,wordExamples} from '../shared/model';
import {contentHash} from '../shared/content';
const parse=(value:Record<string,unknown>)=>parseDeck(JSON.stringify({title:'練習',words:[{word:'refuse',meaning:'拒否する',...value}]})).words[0];
it('validates examples, translations and duplicate sentences while supporting legacy input',()=>{
 expect(wordExamples(parse({example:'A sentence.'}))).toEqual([{text:'A sentence.'}]);
 expect(parse({examples:[{text:'  A sentence. ',translation:' 文です。 '},{text:'Another sentence.'}]})).toMatchObject({example:'A sentence.',examples:[{text:'A sentence.',translation:'文です。'},{text:'Another sentence.'}]});
 expect(()=>parse({examples:Array.from({length:11},(_,i)=>({text:`Example ${i}`}))})).toThrow('10件');
 expect(()=>parse({examples:[{text:'A sentence.'},{text:' A  sentence. '}]})).toThrow('同じ英文');
 expect(()=>parse({examples:[{text:'',translation:'訳だけ'}]})).toThrow('英文');
 expect(()=>parse({examples:[{text:'x',translation:'x'.repeat(1001)}]})).toThrow('1000文字');
 expect(()=>parse({examples:'invalid'})).toThrow();
 expect(wordExamples(parse({example:'Old.',examples:[]}))).toEqual([]);
});
it('preserves old fingerprints and distinguishes additional sentences or translation-only edits',async()=>{
 const legacy=parse({example:'A sentence.'});
 const single=parse({examples:[{text:'A sentence.'}]});
 expect(await contentHash([legacy])).toBe(await contentHash([single]));
 expect(await contentHash([single])).not.toBe(await contentHash([parse({examples:[{text:'A sentence.',translation:'例文です。'}]})]));
 expect(await contentHash([legacy])).not.toBe(await contentHash([parse({examples:[{text:'A sentence.'},{text:'Another sentence.'}]})]));
});

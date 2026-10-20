import {expect,it} from 'vitest';
import {exampleWordParts} from '../src/lib/exampleWord';
const matches=(sentence:string,word:string)=>exampleWordParts(sentence,word).filter(p=>p.match).map(p=>p.text);
it('matches whole words, repeated words, spelling alternatives and phrases while preserving text',()=>{
 expect(matches('A cat scatters cat food.','cat')).toEqual(['cat','cat']);
 expect(matches('My favorite colour is blue.','color/colour')).toEqual(['colour']);
 expect(matches('I look forward to it.','look forward to')).toEqual(['look forward to']);
 const sentence='“C++” is not C.';expect(exampleWordParts(sentence,'C++').map(p=>p.text).join('')).toBe(sentence);
});
it('recognizes common inflections and prefers the exact headword where present',()=>{
 expect(matches('She refused.','refuse')).toEqual(['refused']);expect(matches('We went home.','go')).toEqual(['went']);
 expect(matches('He studies.','study')).toEqual(['studies']);expect(matches('A bird sings as we walk.','a')).toEqual(['A']);
});

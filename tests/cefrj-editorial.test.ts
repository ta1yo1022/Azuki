import {expect,it} from 'vitest';
import {cefrEntryKey,validateCefrEditorial} from '../shared/cefrjEditorial';
const entry={word:'book',pos:'noun',level:'A1',meaning:'本',example:'I borrowed a book from the library.',exampleTranslation:'私は図書館で本を借りました。',otherMeanings:['帳簿']};
it('requires complete, unique coverage, and rejects altered source POS',()=>{
  expect(validateCefrEditorial([entry],[entry]).get(cefrEntryKey(entry))?.otherMeanings).toEqual(['帳簿']);
  expect(()=>validateCefrEditorial([entry],[])).toThrow('Missing 1');
  expect(()=>validateCefrEditorial([entry],[entry,entry])).toThrow('Duplicate');
  expect(()=>validateCefrEditorial([entry],[{...entry,pos:'verb'}])).toThrow('Unknown');
});
it('rejects empty examples and duplicate meanings instead of silently filling them',()=>{
  expect(()=>validateCefrEditorial([entry],[{...entry,example:''}])).toThrow('Invalid example');
  expect(()=>validateCefrEditorial([entry],[{...entry,otherMeanings:['本']}])).toThrow('Invalid other meanings');
  expect(()=>validateCefrEditorial([entry],[{...entry,otherMeanings:['帳簿','帳簿']}])).toThrow('Duplicate other meanings');
});
it('keeps source identity while requiring a note for a corrected usage part of speech',()=>{
  const source={word:'latter',pos:'adverb',level:'A2'};
  const edited={...source,meaning:'後者の',example:'I prefer the latter option.',exampleTranslation:'私は後者の選択肢の方が好きです。',otherMeanings:[],usagePos:'adjective'};
  expect(()=>validateCefrEditorial([source],[edited])).toThrow('Missing usage note');
  expect(validateCefrEditorial([source],[{...edited,usageNote:'原典では副詞ですが、形容詞の用法を扱います。'}]).get(cefrEntryKey(source))?.usagePos).toBe('adjective');
});

it('rejects missing, non-Japanese, and excessively long example translations',()=>{
 for(const exampleTranslation of [undefined,'','   ','English only','あ'.repeat(1001)]) {
  expect(()=>validateCefrEditorial([entry],[{...entry,exampleTranslation}])).toThrow('Invalid example translation');
 }
 expect(validateCefrEditorial([entry],[{...entry,exampleTranslation:'  私は図書館で本を借りました。  '}]).get(cefrEntryKey(entry))?.exampleTranslation).toBe('私は図書館で本を借りました。');
});

import {it,expect} from 'vitest';
import {manualWords,newManualWord,spreadsheetWords,type ManualWord} from '../src/lib/manualWords';
it('accepts words and meanings without examples and keeps all manually entered examples',()=>{
 const row:ManualWord={...newManualWord(),word:'  curious ',meaning:'好奇心の強い',examples:[]};expect(manualWords([row])[0]).toMatchObject({word:'curious',meaning:'好奇心の強い',tags:[]});
 row.examples=[{id:'a',text:'Stay curious.',translation:'好奇心を持ち続けて。'},{id:'b',text:'She is curious.',translation:'彼女は好奇心が強い。'},{id:'c',text:'',translation:''}];expect(manualWords([row])[0].examples).toHaveLength(2);
});
it('preserves spreadsheet tabs, quotes and line breaks without silently dropping a row',()=>{
 const rows=spreadsheetWords('word\tmeaning\texample\ttranslation\r\ncurious\t好奇心の強い\t"She said, ""Stay curious."""\t"彼女は言いました。\n好奇心を忘れずに。"\r\n',true);
 expect(manualWords(rows)[0]).toMatchObject({word:'curious',meaning:'好奇心の強い',examples:[{text:'She said, "Stay curious."',translation:'彼女は言いました。\n好奇心を忘れずに。'}]});
 expect(spreadsheetWords('word\t言葉\nbook\t本')).toHaveLength(2);
});
it('rejects missing meanings, orphan translations, malformed sheets and exceeded limits',()=>{
 expect(()=>manualWords([newManualWord()])).toThrow('単語');
 expect(()=>spreadsheetWords('book\t\ntravel\t旅行する')).toThrow('意味');
 expect(()=>spreadsheetWords('book\t本\t\t本です。')).toThrow('文');
 expect(()=>spreadsheetWords('book\t"本')).toThrow('形式');
 expect(()=>spreadsheetWords('book\t本\ta\tb\tc')).toThrow('2〜4');
 expect(()=>manualWords(Array.from({length:5001},(_,i)=>({...newManualWord(),word:'word'+i,meaning:'意味'})))).toThrow('5000');
});

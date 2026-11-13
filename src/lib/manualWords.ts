import {LIMITS,parseDeck,type WordInput,type WordExample} from '../../shared/model';
export type ManualExample=WordExample&{id:string};
export type ManualWord={id:string;word:string;meaning:string;examples:ManualExample[]};
export type ManualDraft={rows:ManualWord[];paste:string;header:boolean};
export const newManualWord=():ManualWord=>({id:crypto.randomUUID(),word:'',meaning:'',examples:[{id:crypto.randomUUID(),text:'',translation:''}]});
export const newManualDraft=():ManualDraft=>({rows:[newManualWord()],paste:'',header:false});
export function manualWords(rows:ManualWord[]):WordInput[]{
 const words=rows.map(row=>({word:row.word.trim(),meaning:row.meaning.trim(),tags:[],examples:row.examples.filter(example=>example.text.trim()||example.translation?.trim()).map(example=>({text:example.text.trim(),translation:example.translation?.trim()??''}))}));
 return parseDeck(JSON.stringify({title:'単語の確認',words})).words;
}
/** Spreadsheet clipboard data: tab-separated cells, including quoted multiline cells. */
export function spreadsheetWords(raw:string,header=false):ManualWord[]{
 if(new TextEncoder().encode(raw).length>LIMITS.bytes)throw new Error('登録データは512KB以内にしてください。');
 const text=raw.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 const pushCell=()=>{row.push(cell);cell='';closed=false;};const pushRow=()=>{pushCell();if(row.some(value=>value.trim()))rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='\t'){pushCell();continue;}if(c==='\n'){pushRow();continue;}
  if(closed)throw new Error('表の貼り付け形式を確認してください。');
  if(c==='"'&&!cell){quoted=true;continue;}cell+=c;
 }
 if(quoted)throw new Error('表の貼り付け形式を確認してください。');
 if(cell||row.length||closed)pushRow();
 const body=header?rows.slice(1):rows;
 if(!body.length||body.length>LIMITS.importWords||body.some(cells=>cells.length<2||cells.length>4))throw new Error('単語・意味・例文・訳の順に、2〜4列で貼り付けてください。');
 const drafts=body.map(cells=>({id:crypto.randomUUID(),word:cells[0],meaning:cells[1],examples:[{id:crypto.randomUUID(),text:cells[2]??'',translation:cells[3]??''}]}));
 manualWords(drafts);return drafts;
}

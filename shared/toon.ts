import {decode,encode} from '@toon-format/toon';
export const encodeToon=(value:unknown)=>encode(value);
// Repair only bilingual example rows with one unambiguous language boundary.
// Other tables, quoted rows and ambiguous separators retain strict validation.
function repairExampleCommas(raw:string):string {
 let tableIndent=-1;
 return raw.split(/\r?\n/).map(line=>{
  const indent=line.match(/^ */)![0].length;
  if(line.trim()&&indent<=tableIndent)tableIndent=-1;
  if(/^ *examples\[\d+\]\{text,translation\}:\s*$/.test(line)){tableIndent=indent;return line;}
  if(tableIndent<0||!line.trim())return line;
  const row=line.trim();
  if(row.includes('"')||row.split(',').length<=2)return line;
  const boundaries=[...row.matchAll(/,/g)].map(match=>match.index!).filter(index=>{
   const left=row.slice(0,index),right=row.slice(index+1).trim();
   return /[A-Za-z]/.test(left)&&/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u.test(right);
  });
  if(boundaries.length!==1)return line;
  const index=boundaries[0],text=row.slice(0,index),translation=row.slice(index+1).trim();
  return ' '.repeat(indent)+JSON.stringify(text)+','+JSON.stringify(translation);
 }).join('\n');
}
export function decodeToon(raw:string,maxBytes=512*1024):unknown {
 if(new TextEncoder().encode(raw).length>maxBytes)throw new Error('TOONは512KB以内にしてください。');
 raw=raw.trim().replace(/^```(?:toon)?\s*\n([\s\S]*?)\n```$/i,'$1');
 for(const line of raw.split(/\r?\n/)){
  if((line.match(/^ */)?.[0].length??0)>64)throw new Error('TOONの入れ子が深すぎます。字下げを確認してください。');
  const header=line.match(/^ *(?:- )?(?:"(?:[^"\\]|\\.)*"|[^\[\]:\s]+)?\[(\d+)[,|\t]?\](?:\{[^}]*\})?:/);
  if(header&&Number(header[1])>5000)throw new Error('TOONの配列は5,000件以内にしてください。');
 }
 try{return decode(raw,{strict:true});}
 catch{try{return decode(repairExampleCommas(raw),{strict:true});}catch{/* Preserve strict errors for unrecoverable input. */}throw new Error('TOONの形式を確認してください。配列の件数・字下げ・引用符を確認してください。');}
}

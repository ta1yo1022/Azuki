import {decode,encode} from '@toon-format/toon';
export const encodeToon=(value:unknown)=>encode(value);
export function decodeToon(raw:string,maxBytes=512*1024):unknown {
 if(new TextEncoder().encode(raw).length>maxBytes)throw new Error('TOONは512KB以内にしてください。');
 raw=raw.trim().replace(/^```(?:toon)?\s*\n([\s\S]*?)\n```$/i,'$1');
 for(const line of raw.split(/\r?\n/)){
  if((line.match(/^ */)?.[0].length??0)>64)throw new Error('TOONの入れ子が深すぎます。字下げを確認してください。');
  const header=line.match(/^ *(?:- )?(?:"(?:[^"\\]|\\.)*"|[^\[\]:\s]+)?\[(\d+)[,|\t]?\](?:\{[^}]*\})?:/);
  if(header&&Number(header[1])>5000)throw new Error('TOONの配列は5,000件以内にしてください。');
 }
 try{return decode(raw,{strict:true});}
 catch{throw new Error('TOONの形式を確認してください。配列の件数・字下げ・引用符を確認してください。');}
}

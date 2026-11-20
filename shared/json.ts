export const encodeJson=(value:unknown)=>JSON.stringify(value,null,2);
export function decodeJson(raw:string,maxBytes=512*1024):unknown{
 if(new TextEncoder().encode(raw).length>maxBytes)throw new Error('JSONは512KB以内にしてください。');
 const text=raw.replace(/^\uFEFF/,'').trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i,'$1');
 try{return JSON.parse(text);}catch{throw new Error('JSONの形式を確認してください。引用符・カンマ・括弧の閉じ忘れを確認してください。');}
}

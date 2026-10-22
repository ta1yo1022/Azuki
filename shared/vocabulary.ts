import {decodeToon} from './toon';
export const EXAMPLE_WEEKLY_LIMIT=500;
export const EXAMPLE_BATCH_LIMIT=20;
export type DictionaryWord={term:string;meanings:string[]};
export type VocabularySelection={term:string};
export type VocabularyExample={term:string;meaning:string;text:string;translation:string};
export type VocabularyQuota={pro:boolean;available:boolean;used:number;reserved:number;limit:number;remaining:number;resetsAt:string};
export function normalizeTerm(term:string){return term.normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();}
export function vocabularyWeek(now=Date.now()){
 const jst=new Date(now+9*3600000);
 const day=(jst.getUTCDay()+6)%7;
 const start=Date.UTC(jst.getUTCFullYear(),jst.getUTCMonth(),jst.getUTCDate()-day)-9*3600000;
 return {start:new Date(start).toISOString(),resetsAt:new Date(start+7*86400000).toISOString()};
}
export function vocabularyTerm(value:unknown){
 if(typeof value!=='string')throw new Error('単語は文字列で入力してください。');
 const term=normalizeTerm(value);
 if(!/^[a-z][a-z0-9 ./'-]{0,99}$/.test(term))throw new Error('英単語・英語のフレーズを100文字以内で入力してください。');
 return term;
}
export function parseVocabulary(text:string){
 if(text.length>30000)throw new Error('単語のTOONは30,000文字以内にしてください。');
 let data:unknown;try{data=decodeToon(text);}catch{throw new Error('TOONの形式を確認してください。例：words[3]: agree,curious,improve');}
 const values=Array.isArray(data)?data:data&&typeof data==='object'&&'words' in data?(data as {words:unknown}).words:null;
 if(!Array.isArray(values)||!values.length||values.length>500)throw new Error('TOONの配列に1〜500語を入力してください。');
 return [...new Set(values.map(value=>vocabularyTerm(value&&typeof value==='object'&&!Array.isArray(value)?value.word:value)))];
}

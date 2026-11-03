import {useCallback,useEffect} from 'react';
import type {Language} from '../../shared/languages';
import {resolveSiteLanguage,SITE_LANGUAGE_KEY} from '../../shared/siteLocale';
import {useSiteLanguage} from './siteLanguage';
import {landingText} from '../components/landingTranslations';
import catalog from './translations.json';
const messages:Record<string,readonly string[]>=catalog;
const templates=Object.keys(messages).filter(key=>/\{\d+\}/.test(key)).sort((a,b)=>b.replace(/\{\d+\}/g,'').length-a.replace(/\{\d+\}/g,'').length).map(key=>{
 const slots:number[]=[];let source='',last=0;
 for(const match of key.matchAll(/\{(\d+)\}/g)){source+=key.slice(last,match.index).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(.+?)';slots.push(Number(match[1]));last=match.index!+match[0].length;}
 source+=key.slice(last).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return {key,slots,pattern:new RegExp('^'+source+'$')};
});
export function currentLanguage():Language {
 let saved:unknown='auto';try{saved=localStorage.getItem(SITE_LANGUAGE_KEY);}catch{/* Automatic is available without storage. */}
 return resolveSiteLanguage(saved,typeof navigator==='undefined'?['ja']:navigator.languages?.length?navigator.languages:[navigator.language]);
}
export function translate(language:Language,text:string,...values:unknown[]):string {
 const key=text.replace(/\s+/g,' ').trim();
 let translated=language==='ja'?text:messages[key]?.[{en:0,th:1,zh:2}[language]]??landingText(language,key);
 if(language!=='ja'&&translated===key&&!values.length){
  for(const template of templates){const match=template.pattern.exec(key);if(!match)continue;
   const parameters:unknown[]=[];template.slots.forEach((slot,index)=>{parameters[slot]=match[index+1];});
   // Validation field labels can themselves contain an ordinal or example number.
   if(template.key.startsWith('本日の{0}'))parameters[0]=translate(language,String(parameters[0]));
   if(['{0}を入力してください。','{0}は{1}文字以内にしてください。','{0}は{1}件以内にしてください。','{0}に同じ例文が含まれています。'].includes(template.key))parameters[0]=translate(language,String(parameters[0]));
   return translate(language,template.key,...parameters);
  }
 }
 return translated.replace(/\{(\d+)\}/g,(placeholder,index)=>Number(index)<values.length?String(values[Number(index)]):placeholder);
}
/** For formatting helpers outside React; components use the reactive hook below. */
export function t(text:string,...values:unknown[]){return translate(currentLanguage(),text,...values);}
export function useI18n(){const {language}=useSiteLanguage();return useCallback((text:string,...values:unknown[])=>translate(language,text,...values),[language]);}
export function locale(){return {ja:'ja-JP',en:'en-US',th:'th-TH',zh:'zh-CN'}[currentLanguage()];}
export function languageName(code:unknown){const key=({en:'英語',ja:'日本語',th:'タイ語',zh:'中国語'} as Record<string,string>)[String(code)]??'英語';return key;}
export function InterfaceLanguage(){const {language}=useSiteLanguage();useEffect(()=>{document.documentElement.lang=language;},[language]);return null;}
/** Store source messages, so existing notices follow subsequent language changes. */
export function messageText(text:string,...values:unknown[]){return translate('ja',text,...values);}

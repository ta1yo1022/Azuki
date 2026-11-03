import {translate} from '../lib/i18n';
import type {Language} from '../../shared/languages';
import {useSiteLanguage} from '../lib/siteLanguage';
import {landingTitles,landingText} from './landingTranslations';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageMetadata, metadataTags, type PageMetadata as Metadata } from '../../shared/metadata';
import { publicRepository } from '../lib/repository';
export function applyPageMetadata(meta:Metadata,updateTitle=true,language?:Language){
 if(updateTitle)document.title=meta.title;
 for(const [attribute,key,value] of metadataTags(meta)){
  const selector=`meta[${attribute}="${key}"]`;
  const tag=document.head.querySelector<HTMLMetaElement>(selector)??document.createElement('meta');
  tag.setAttribute(attribute,key);tag.content=key==='og:locale'&&language?{ja:'ja_JP',en:'en_US',th:'th_TH',zh:'zh_CN'}[language]:language&&key.endsWith(':image:alt')?translate(language,value):value;if(!tag.parentNode)document.head.appendChild(tag);
 }
 const canonical=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')??document.createElement('link');
 canonical.rel='canonical';canonical.href=meta.url;if(!canonical.parentNode)document.head.appendChild(canonical);
}
export function PageMetadata(){
 const {pathname}=useLocation();
 const {language}=useSiteLanguage();
 const localize=(meta:Metadata,deck?:Awaited<ReturnType<typeof publicRepository.get>>):Metadata=>{
  const tr=(value:string)=>translate(language,value);
  if(deck){const tags=deck.textbookTags.map(tag=>[tag.name,tag.edition].filter(Boolean).join(' ')).join('・');return {...meta,title:deck.title+(pathname.endsWith('/book')?' — '+tr('単語帳で学習'):pathname.endsWith('/study')?' — '+tr('カードで学習'):'')+' — Azuki',description:[deck.description.trim(),translate(language,'{0}語{1}。Azukiでログインせずに閲覧・学習できます。',deck.wordCount,tags?'・'+tags:'')].filter(Boolean).join(' ').slice(0,240)};}
  return {...meta,title:meta.title.endsWith(' — Azuki')?tr(meta.title.slice(0,-8))+' — Azuki':tr(meta.title),description:tr(meta.description)};
 };
 useEffect(()=>{
  const controller=new AbortController();applyPageMetadata(pathname==='/'?{...pageMetadata(pathname),title:landingTitles[language],description:landingText(language,'覚えたい単語を登録して、カードで練習。')}:localize(pageMetadata(pathname)),!pathname.startsWith("/library/decks/"),language);
  const match=/^\/shared\/([a-zA-Z0-9-]{1,80})(?:\/(?:study|book))?\/?$/.exec(pathname);
  if(match)void publicRepository.get(match[1],controller.signal).then(deck=>{if(!controller.signal.aborted)applyPageMetadata(localize(pageMetadata(pathname,deck),deck),true,language);}).catch(()=>{});
  return()=>controller.abort();
 },[pathname,language]);
 return null;
}

import {useSiteLanguage} from '../lib/siteLanguage';
import {landingTitles,landingText} from './landingTranslations';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageMetadata, metadataTags, type PageMetadata as Metadata } from '../../shared/metadata';
import { publicRepository } from '../lib/repository';
export function applyPageMetadata(meta:Metadata,updateTitle=true){
 if(updateTitle)document.title=meta.title;
 for(const [attribute,key,value] of metadataTags(meta)){
  const selector=`meta[${attribute}="${key}"]`;
  const tag=document.head.querySelector<HTMLMetaElement>(selector)??document.createElement('meta');
  tag.setAttribute(attribute,key);tag.content=value;if(!tag.parentNode)document.head.appendChild(tag);
 }
 const canonical=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')??document.createElement('link');
 canonical.rel='canonical';canonical.href=meta.url;if(!canonical.parentNode)document.head.appendChild(canonical);
}
export function PageMetadata(){
 const {pathname}=useLocation();
 const {language}=useSiteLanguage();
 useEffect(()=>{
  const controller=new AbortController();applyPageMetadata(pathname==='/'?{...pageMetadata(pathname),title:landingTitles[language],description:landingText(language,'覚えたい単語を登録して、カードで練習。')}:pageMetadata(pathname),!pathname.startsWith("/library/decks/"));
  const match=/^\/shared\/([a-zA-Z0-9-]{1,80})(?:\/(?:study|book))?\/?$/.exec(pathname);
  if(match)void publicRepository.get(match[1],controller.signal).then(deck=>{if(!controller.signal.aborted)applyPageMetadata(pageMetadata(pathname,deck));}).catch(()=>{});
  return()=>controller.abort();
 },[pathname,language]);
 return null;
}

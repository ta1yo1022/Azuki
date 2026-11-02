import {useEffect,useState} from 'react';
import {isLanguage} from '../../shared/languages';
import {resolveSiteLanguage,SITE_LANGUAGE_KEY,type SiteLanguagePreference} from '../../shared/siteLocale';
const changed='azuki-site-language-changed';
function readPreference():SiteLanguagePreference{try{const saved=localStorage.getItem(SITE_LANGUAGE_KEY);return isLanguage(saved)?saved:'auto';}catch{return 'auto';}}
export function useSiteLanguage(){
 const [preference,setPreference]=useState(readPreference),[error,setError]=useState(false);
 const [languages,setLanguages]=useState(()=>navigator.languages?.length?[...navigator.languages]:[navigator.language]);
 useEffect(()=>{const sync=(event:Event)=>{const value=(event as CustomEvent).detail;setPreference(event.type===changed&&(isLanguage(value)||value==='auto')?value:readPreference());};const browserChanged=()=>setLanguages(navigator.languages?.length?[...navigator.languages]:[navigator.language]);window.addEventListener(changed,sync);window.addEventListener('storage',sync);window.addEventListener('languagechange',browserChanged);return()=>{window.removeEventListener(changed,sync);window.removeEventListener('storage',sync);window.removeEventListener('languagechange',browserChanged);};},[]);
 function select(value:SiteLanguagePreference){setPreference(value);try{if(value==='auto')localStorage.removeItem(SITE_LANGUAGE_KEY);else localStorage.setItem(SITE_LANGUAGE_KEY,value);setError(false);}catch{setError(true);}window.dispatchEvent(new CustomEvent(changed,{detail:value}));}
 return {preference,language:resolveSiteLanguage(preference,languages),select,error};
}

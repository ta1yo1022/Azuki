import {isLanguage,type Language} from './languages';
export const SITE_LANGUAGE_KEY='azuki.site-language.v1';
export type SiteLanguagePreference=Language|'auto';
export const SITE_LANGUAGE_OPTIONS=[{code:'ja',label:'日本語'},{code:'en',label:'English'},{code:'th',label:'ไทย'},{code:'zh',label:'中文'}] as const;
export function detectSiteLanguage(languages:readonly string[]):Language{
 for(const language of languages){const code=language.toLowerCase().split(/[-_]/)[0];if(isLanguage(code))return code;}
 return 'en';
}
export function resolveSiteLanguage(preference:unknown,languages:readonly string[]):Language{return isLanguage(preference)?preference:detectSiteLanguage(languages);}

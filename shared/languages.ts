export const LANGUAGES=[{code:'en',name:'英語',prompt:'English'},{code:'ja',name:'日本語',prompt:'Japanese'},{code:'th',name:'タイ語',prompt:'Thai'},{code:'zh',name:'中国語',prompt:'Mandarin Chinese'}] as const;
export type Language=typeof LANGUAGES[number]['code'];
export function isLanguage(value:unknown):value is Language{return LANGUAGES.some(item=>item.code===value);}
export const languageName=(code:unknown)=>LANGUAGES.find(item=>item.code===code)?.name??'英語';
export const languagePrompt=(code:Language)=>LANGUAGES.find(item=>item.code===code)!.prompt;
export function validLanguageText(text:string,language:Language){return ({en:/[a-z]/i,ja:/[ぁ-んァ-ヶ一-龯]/,th:/[\u0E00-\u0E7F]/,zh:/\p{Script=Han}/u})[language].test(text);}

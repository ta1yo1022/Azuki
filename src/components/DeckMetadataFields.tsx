import {useI18n} from '../lib/i18n';
import {LANGUAGES,type Language} from '../../shared/languages';
export const DECK_CATEGORIES=['日常生活','旅行','仕事','試験対策','食事・カフェ','その他'];
export type MetadataFields={title:string;description:string;category:string;textbookName:string;edition:string;language?:Language;meaningLanguage?:Language};
export function DeckMetadataFields({value,onChange,prefix}:{value:MetadataFields;onChange:(value:MetadataFields)=>void;prefix:string}){
 const t=useI18n();
 const field=(key:keyof MetadataFields,text:string)=>onChange({...value,[key]:text});
 return <>
  <div className="deck-language-fields"><div className="import-field"><label htmlFor={`${prefix}-language`}>{t("学習する言語")}</label><select id={`${prefix}-language`} value={value.language??'en'} onChange={e=>field('language',e.target.value)}>{LANGUAGES.map(item=><option key={item.code} value={item.code}>{t(item.name)}</option>)}</select></div><div className="import-field"><label htmlFor={`${prefix}-meaning-language`}>{t("意味・訳の言語")}</label><select id={`${prefix}-meaning-language`} value={value.meaningLanguage??'ja'} onChange={e=>field('meaningLanguage',e.target.value)}>{LANGUAGES.map(item=><option key={item.code} value={item.code}>{t(item.name)}</option>)}</select></div></div>
  {value.category!=='textbook'&&<div className="import-field"><label htmlFor={`${prefix}-title-input`}>{t("単語帳の名前")} <small className="field-required">{t("必須")}</small></label><input id={`${prefix}-title-input`} required maxLength={80} value={value.title} onChange={e=>field('title',e.target.value)} placeholder={t("例：旅先で使う単語")}/></div>}
  <div className="import-field"><label htmlFor={`${prefix}-category`}>{t("カテゴリ")} <small>{t("任意")}</small></label><select id={`${prefix}-category`} value={value.category} onChange={e=>field('category',e.target.value)}><option value="">{t("カテゴリを選ぶ")}</option><option value="textbook">{t("教材")}</option>{DECK_CATEGORIES.map(name=><option key={name} value={name}>{t(name)}</option>)}</select></div>
  {value.category==='textbook'&&<div className="import-textbook-fields">
   <div className="import-field"><label htmlFor={`${prefix}-textbook-name`}>{t("教材名")} <small className="field-required">{t("必須")}</small></label><input id={`${prefix}-textbook-name`} required maxLength={80} value={value.textbookName} onChange={e=>field('textbookName',e.target.value)} placeholder={t("例：英単語ターゲット1900")}/></div>
   <div className="import-field"><label htmlFor={`${prefix}-textbook-edition`}>{t("版")} <small>{t("任意")}</small></label><input id={`${prefix}-textbook-edition`} maxLength={40} value={value.edition} onChange={e=>field('edition',e.target.value)} placeholder={t("例：第6版")}/></div>
   <small className="import-textbook-hint">{t("教材名を単語帳のタイトルに使います。")}</small>
  </div>}
  <div className="import-field"><label htmlFor={`${prefix}-description`}>{t("説明")} <small>{t("任意")}</small></label><textarea id={`${prefix}-description`} maxLength={240} rows={3} value={value.description} onChange={e=>field('description',e.target.value)} placeholder={t("覚えたい場面や、学習する範囲など")}/></div>
 </>;
}

export const DECK_CATEGORIES=['日常生活','旅行','仕事','試験対策','食事・カフェ','その他'];
export type MetadataFields={title:string;description:string;category:string;textbookName:string;edition:string};
export function DeckMetadataFields({value,onChange,prefix}:{value:MetadataFields;onChange:(value:MetadataFields)=>void;prefix:string}){
 const field=(key:keyof MetadataFields,text:string)=>onChange({...value,[key]:text});
 return <>
  {value.category!=='textbook'&&<div className="import-field"><label htmlFor={`${prefix}-title-input`}>単語帳の名前 <small className="field-required">必須</small></label><input id={`${prefix}-title-input`} required maxLength={80} value={value.title} onChange={e=>field('title',e.target.value)} placeholder="例：旅先で使う英単語"/></div>}
  <div className="import-field"><label htmlFor={`${prefix}-category`}>カテゴリ <small>任意</small></label><select id={`${prefix}-category`} value={value.category} onChange={e=>field('category',e.target.value)}><option value="">カテゴリを選ぶ</option><option value="textbook">教材</option>{DECK_CATEGORIES.map(name=><option key={name} value={name}>{name}</option>)}</select></div>
  {value.category==='textbook'&&<div className="import-textbook-fields">
   <div className="import-field"><label htmlFor={`${prefix}-textbook-name`}>教材名 <small className="field-required">必須</small></label><input id={`${prefix}-textbook-name`} required maxLength={80} value={value.textbookName} onChange={e=>field('textbookName',e.target.value)} placeholder="例：英単語ターゲット1900"/></div>
   <div className="import-field"><label htmlFor={`${prefix}-textbook-edition`}>版 <small>任意</small></label><input id={`${prefix}-textbook-edition`} maxLength={40} value={value.edition} onChange={e=>field('edition',e.target.value)} placeholder="例：第6版"/></div>
   <small className="import-textbook-hint">教材名を単語帳のタイトルに使います。</small>
  </div>}
  <div className="import-field"><label htmlFor={`${prefix}-description`}>説明 <small>任意</small></label><textarea id={`${prefix}-description`} maxLength={240} rows={3} value={value.description} onChange={e=>field('description',e.target.value)} placeholder="覚えたい場面や、学習する範囲など"/></div>
 </>;
}

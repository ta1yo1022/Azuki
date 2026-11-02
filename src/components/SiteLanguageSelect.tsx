import {Globe} from 'lucide-react';
import {SITE_LANGUAGE_OPTIONS,type SiteLanguagePreference} from '../../shared/siteLocale';
import {useSiteLanguage} from '../lib/siteLanguage';
import {landingText} from './landingTranslations';
export function SiteLanguageSelect(){
 const {language,preference,select,error}=useSiteLanguage();const t=(text:string)=>landingText(language,text);
 return <div className="site-language-control"><label className="site-language-label"><Globe size={17} aria-hidden="true"/><span className="visually-hidden">{t('言語')}</span><select aria-label={t('トップページの表示言語')} value={preference} onChange={e=>select(e.target.value as SiteLanguagePreference)}><option value="auto">{t('自動（ブラウザに合わせる）')}</option>{SITE_LANGUAGE_OPTIONS.map(item=><option key={item.code} value={item.code}>{item.label}</option>)}</select></label>{error&&<p role="alert">{t('言語設定を保存できませんでした。この画面にのみ適用しています。')}</p>}</div>;
}

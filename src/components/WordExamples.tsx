import {languageName} from '../lib/i18n';
import {useI18n} from '../lib/i18n';
import {type Language} from '../../shared/languages';
import { WordAudioButton } from './WordAudioButton';
import {wordExamples,type Word} from '../../shared/model';
export function WordExamples({language='en',meaningLanguage='ja',word,deckId,isPublic=false,translations=true,blurTranslations=false,onToggleTranslation,blurEnglish=false,onToggleEnglish }:{language?:Language;meaningLanguage?:Language;word:Word;deckId?:string;isPublic?:boolean;translations?:boolean;blurTranslations?:boolean;onToggleTranslation?:()=>void;blurEnglish?:boolean;onToggleEnglish?:()=>void}) {
 const t=useI18n();
  const examples=wordExamples(word);
  if(!examples.length)return <p>{t("例文はまだ登録されていません。")}</p>;
  return <ol className="word-examples">{examples.map((example,index)=><li key={index}>
    {examples.length>1&&<span className="word-example-number">{t("例文")} {index+1}</span>}
    <div className="word-example-answer"><p lang={language} className={blurEnglish?'book-english-content is-blurred':undefined} aria-hidden={blurEnglish||undefined}>{example.text}</p>{onToggleEnglish&&<button type="button" data-book-answer className="book-meaning-reveal" aria-expanded={!blurEnglish} aria-label={t("{0}の例文{1}の{2}を{3}", word.word, index+1, t(languageName(language)), blurEnglish?t("表示"):t("隠す"))} onClick={event=>{event.stopPropagation();onToggleEnglish();}}><span className="sr-only">{t(languageName(language))}{t("を")}{blurEnglish?t("表示"):t("隠す")}</span></button>}</div>
    {deckId&&<WordAudioButton deckId={deckId} wordId={word.id} word={example.text} exampleIndex={index} isPublic={isPublic}/>}
    {translations&&example.translation&&<div className="word-example-answer"><p className={`word-example-translation${blurTranslations?' is-blurred':''}`} lang={meaningLanguage} aria-hidden={blurTranslations||undefined}>{example.translation}</p>{onToggleTranslation&&<button type="button" data-book-answer className="book-meaning-reveal" aria-expanded={!blurTranslations} aria-label={t("{0}の例文{1}の{2}訳を{3}", word.word, index+1, t(languageName(meaningLanguage)), blurTranslations?t("表示"):t("隠す"))} onClick={event=>{event.stopPropagation();onToggleTranslation();}}><span className="sr-only">{t(languageName(meaningLanguage))}{t("訳を")}{blurTranslations?t("表示"):t("隠す")}</span></button>}</div>}
  </li>)}</ol>;
}

import {wordExamples,type Word} from '../../shared/model';
export function WordExamples({word,translations=true,blurTranslations=false,onToggleTranslation,blurEnglish=false,onToggleEnglish}:{word:Word;translations?:boolean;blurTranslations?:boolean;onToggleTranslation?:()=>void;blurEnglish?:boolean;onToggleEnglish?:()=>void}) {
  const examples=wordExamples(word);
  if(!examples.length)return <p>例文はまだ登録されていません。</p>;
  return <ol className="word-examples">{examples.map((example,index)=><li key={index}>
    {examples.length>1&&<span className="word-example-number">例文 {index+1}</span>}
    <div className="word-example-answer"><p lang="en" className={blurEnglish?'book-english-content is-blurred':undefined} aria-hidden={blurEnglish||undefined}>{example.text}</p>{onToggleEnglish&&<button type="button" data-book-answer className="book-meaning-reveal" aria-expanded={!blurEnglish} aria-label={`${word.word}の例文${index+1}の英語を${blurEnglish?'表示':'隠す'}`} onClick={event=>{event.stopPropagation();onToggleEnglish();}}><span className="sr-only">英語を{blurEnglish?'表示':'隠す'}</span></button>}</div>
    {translations&&example.translation&&<div className="word-example-answer"><p className={`word-example-translation${blurTranslations?' is-blurred':''}`} lang="ja" aria-hidden={blurTranslations||undefined}>{example.translation}</p>{onToggleTranslation&&<button type="button" data-book-answer className="book-meaning-reveal" aria-expanded={!blurTranslations} aria-label={`${word.word}の例文${index+1}の日本語訳を${blurTranslations?'表示':'隠す'}`} onClick={event=>{event.stopPropagation();onToggleTranslation();}}><span className="sr-only">日本語訳を{blurTranslations?'表示':'隠す'}</span></button>}</div>}
  </li>)}</ol>;
}

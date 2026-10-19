import {wordExamples,type Word} from '../../shared/model';
export function WordExamples({word,translations=true}:{word:Word;translations?:boolean}) {
  const examples=wordExamples(word);
  if(!examples.length)return <p>例文はまだ登録されていません。</p>;
  return <ol className="word-examples">{examples.map((example,index)=><li key={index}>
    {examples.length>1&&<span className="word-example-number">例文 {index+1}</span>}
    <p lang="en">{example.text}</p>
    {translations&&example.translation&&<p className="word-example-translation" lang="ja">{example.translation}</p>}
  </li>)}</ol>;
}

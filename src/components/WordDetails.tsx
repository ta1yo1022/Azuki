import { WordExamples } from './WordExamples';
import type { Word } from '../../shared/model';

/** The public detail view can show extra senses without adding them to cards. */
export function WordDetails({ word,deckId,isPublic=true }: { word: Word;deckId?:string;isPublic?:boolean }) {
  const edited = word.otherMeanings !== undefined;
  return <div className="word-detail">
    {edited && <section className="word-sense-primary" aria-label="代表的な意味">
      <span className="eyebrow">代表的な意味</span>
      <p lang="ja">{word.meaning}</p>
    </section>}
    <section aria-label={edited ? '代表的な意味の例文' : '例文'}>
      <span className="eyebrow">{edited ? 'この意味の例文' : '例文'}</span>
      <WordExamples word={word} deckId={deckId} isPublic={isPublic}/>
    </section>
    {!!word.otherMeanings?.length && <section className="word-other-senses" aria-label="その他の意味">
      <span className="eyebrow">その他の意味</span>
      <ul>{word.otherMeanings.map(meaning => <li key={meaning} lang="ja">{meaning}</li>)}</ul>
    </section>}
    {word.usageNote && <p className="word-usage-note">{word.usageNote}</p>}
  </div>;
}

import { deckThemeStyle } from '../../shared/deckThemes';
import type { CSSProperties } from 'react';
import type {Deck} from '../../shared/model';

export function BookCover({deck}:{deck:Deck}) {
  const level=deck.cefrLevel || (deck.isOfficial && deck.officialLevel ? {beginner:'初級',intermediate:'中級',advanced:'上級'}[deck.officialLevel] : '');
  return <div className={`book-cover${deck.theme?" themed-book-cover":""}`} style={deckThemeStyle(deck.theme) as CSSProperties}>
    <div className="book-cover-brand">azuki<small>ENGLISH WORDBOOK</small></div>
    <div className="book-cover-main">
      <p className="book-cover-edition">{deck.isOfficial?'Azuki運営 発行':deck.visibility==='public'?'公開単語帳':'わたしの単語帳'}</p>
      <h2>{deck.title}</h2>
      {deck.description && <p className="book-cover-description">{deck.description}</p>}
      <div className="book-cover-tags">{deck.textbookTags.map((tag,index)=><span key={index}>{[tag.name,tag.edition,tag.chapter].filter(Boolean).join(' / ')}</span>)}</div>
    </div>
    <div className="book-cover-bottom"><span><strong>{deck.wordCount.toLocaleString('ja-JP')}</strong> 語</span>{level && <span className="book-cover-level">{deck.cefrLevel?'CEFR-J ':''}{level}</span>}</div>
  </div>;
}

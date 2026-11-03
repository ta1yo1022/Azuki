import {useI18n,locale} from '../lib/i18n';
import { deckThemeStyle } from '../../shared/deckThemes';
import type { CSSProperties } from 'react';
import type {Deck} from '../../shared/model';

export function BookCover({deck}:{deck:Deck}) {
 const t=useI18n();
  const level=deck.cefrLevel || (deck.isOfficial && deck.officialLevel ? {beginner:t("初級"),intermediate:t("中級"),advanced:t("上級")}[deck.officialLevel] : '');
  return <div className={`book-cover${deck.theme?" themed-book-cover":""}`} style={deckThemeStyle(deck.theme) as CSSProperties}>
    <div className="book-cover-brand">azuki<small>ENGLISH WORDBOOK</small></div>
    <div className="book-cover-main">
      <p className="book-cover-edition">{deck.isOfficial?t("Azuki運営 発行"):deck.visibility==='public'?t("公開単語帳"):t("わたしの単語帳")}</p>
      <h2>{deck.title}</h2>
      {deck.description && <p className="book-cover-description">{deck.description}</p>}
      <div className="book-cover-tags">{deck.textbookTags.map((tag,index)=><span key={index}>{[tag.name,tag.edition,tag.chapter].filter(Boolean).join(' / ')}</span>)}</div>
    </div>
    <div className="book-cover-bottom"><span><strong>{deck.wordCount.toLocaleString(locale())}</strong> {t("語")}</span>{level && <span className="book-cover-level">{deck.cefrLevel?'CEFR-J ':''}{level}</span>}</div>
  </div>;
}

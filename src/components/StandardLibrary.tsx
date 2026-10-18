import { findStandardDecks } from '../../shared/standardDecks';
import { PublicDeckCard } from './PublicDeckCard';

export function StandardLibrary({query = ''}:{query?:string}) {
  const decks = findStandardDecks(query);
  const groups = [
    {key:'cefrj', title:'CEFR-J', description:'A1からB2まで、レベルに合わせて選べます。', decks:decks.filter(deck => deck.contentSource === 'cefrj')},
    {key:'themes', title:'テーマ別の単語帳', description:'日常生活、旅行、食事、気持ち、仕事。身近なテーマから選べます。', decks:decks.filter(deck => deck.contentSource !== 'cefrj')},
  ];
  if (!decks.length) return null;
  return <section className="standard-library" aria-label="運営発行の標準単語帳">
    <div className="standard-library-heading"><span className="eyebrow">標準単語帳</span><p>保存せずに学習できます。個人の保存上限には含まれません。</p></div>
    {groups.filter(group => group.decks.length > 0).map(group => <section key={group.key} className="standard-library-group" aria-label={group.title}>
      <div className="standard-library-heading"><div><h2>{group.title}</h2><p>{group.description}</p></div></div>
      <div className="deck-grid public-deck-grid">{group.decks.map((deck, index) => <PublicDeckCard key={deck.id} deck={deck} index={index} heading="h3" />)}</div>
      {group.key === 'cefrj' && <p className="standard-library-note">前編・後編は原典の掲載順を二分したものです。同じレベル内での難易度の差ではありません。</p>}
    </section>)}
  </section>;
}

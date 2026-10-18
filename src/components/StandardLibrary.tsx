import { Link } from 'react-router-dom';
import { findStandardDecks } from '../../shared/standardDecks';
import { OfficialLevelBadge } from './DeckCredit';
export function StandardLibrary({query = ''}:{query?:string}) {
  const decks = findStandardDecks(query);
  if (!decks.length) return null;
  return <section className="standard-library" aria-label="運営発行の標準単語帳">
    <div className="standard-library-heading"><div><span className="eyebrow">標準単語帳</span><h2>テーマやレベルから選ぶ。</h2></div><p>保存せずに学習できます。個人の保存上限には含まれません。</p></div>
    <div className="standard-deck-grid">{decks.map(deck => <Link key={deck.id} className="standard-deck" to={`/shared/${deck.id}`}><OfficialLevelBadge deck={deck}/><span><strong>{deck.title}</strong><small>{deck.wordCount.toLocaleString()}{deck.contentSource === "cefrj" ? "項目 · 品詞別" : "語 · 例文付き"}</small></span><span aria-hidden="true">→</span></Link>)}</div>
    <p className="standard-library-note">CEFR-Jの前編・後編は原典の掲載順を二分したものです。同じレベル内での難易度の差ではありません。</p>
  </section>;
}

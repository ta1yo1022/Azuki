import { Link } from "react-router-dom";
import type { Deck } from "../../shared/model";
export function DeckLineage({ deck }: { deck: Deck }) {
  if (!deck.sourceDeck) return null;
  return <div className="deck-lineage">
    <strong>{deck.unchangedCopy ? "保存したコピー" : "派生版"}</strong>
    <span>コピー元：{deck.sourceDeck.available
      ? <Link to={`/shared/${encodeURIComponent(deck.sourceDeck.id)}`}>{deck.sourceDeck.title}</Link>
      : <>{deck.sourceDeck.title}（現在は公開されていません）</>}</span>
  </div>;
}

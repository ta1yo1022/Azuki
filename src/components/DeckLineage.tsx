import {useI18n} from '../lib/i18n';
import { Link } from "react-router-dom";
import type { Deck } from "../../shared/model";
export function DeckLineage({ deck }: { deck: Deck }) {
 const t=useI18n();
  if (!deck.sourceDeck) return null;
  return <div className="deck-lineage">
    <strong>{deck.unchangedCopy ? t("保存したコピー") : t("派生版")}</strong>
    <span>{t("コピー元：")}{deck.sourceDeck.available
      ? <Link to={`/shared/${encodeURIComponent(deck.sourceDeck.id)}`}>{deck.sourceDeck.title}</Link>
      : <>{deck.sourceDeck.title}{t("（現在は公開されていません）")}</>}</span>
  </div>;
}

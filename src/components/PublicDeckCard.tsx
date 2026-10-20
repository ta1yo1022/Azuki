import { deckThemeStyle } from '../../shared/deckThemes';
import { Link } from "react-router-dom";
import { BookOpenText, Globe, Tag } from "lucide-react";
import type { Deck } from "../../shared/model";
import { OfficialBadge, OfficialLevelBadge } from "./DeckCredit";

export function PublicDeckCard({deck, index, heading = "h2"}: {deck: Deck; index: number; heading?: "h2" | "h3"}) {
  const Heading = heading;
  return (<Link
            style={deckThemeStyle(deck.theme) as React.CSSProperties}
            className={`deck-card palette-${index % 3}${deck.theme?" themed-deck":""}${deck.isOfficial ? " official-deck-card" : ""}`}
            to={`/shared/${encodeURIComponent(deck.id)}`}
          >
            <div className="deck-cover">
              <span className="cover-top">
                {deck.isOfficial ? <OfficialBadge /> : <><BookOpenText size={20} /><span>公開単語帳</span></>}
                <span className="cover-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>
              <div className="cover-title">
                <Heading>{deck.title}</Heading>
                <p>{deck.description || "公開された単語帳"}</p>
              </div>
              <span className="cover-bottom">
                <span>
                  {deck.wordCount}
                  <small> words</small>
                </span>
                <span className="cover-monogram">Aa</span>
              </span>
            </div>
            <div className="deck-meta">
              <span className="deck-tags">
                <Tag size={13} />
                {deck.textbookTags.map((t) => t.name).join("・") ||
                  "教材タグなし"}
              </span>
              <div>
                {deck.isOfficial ? <OfficialLevelBadge deck={deck} /> : <span>
                  <Globe size={13} />
                  公開
                </span>}
                <span>単語帳を読む →</span>
              </div>
            </div>
          </Link>);
}

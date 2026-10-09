import { BadgeCheck } from "lucide-react";
import type { Deck, OfficialLevel } from "../../shared/model";

export const LEVELS: Record<OfficialLevel, { label: string; steps: number; description: string }> = {
  beginner: { label: "初級", steps: 1, description: "身近な場面で使う基本の語彙から学びたい人向け。" },
  intermediate: { label: "中級", steps: 2, description: "基本の語彙から、表現の幅や意味の使い分けを広げたい人向け。" },
  advanced: { label: "上級", steps: 3, description: "専門的な場面や抽象的な内容に使う語彙まで学びたい人向け。" },
};

export function OfficialBadge() {
  return <span className="official-badge"><BadgeCheck size={15} aria-hidden="true" />Azuki運営 発行</span>;
}

export function OfficialLevelBadge({ deck }: { deck: Deck }) {
  if (!deck.isOfficial || !deck.officialLevel) return null;
  const level = LEVELS[deck.officialLevel];
  if (!level) return null;
  return (
    <span className={`official-level level-${deck.officialLevel}`} aria-label={`学習レベルの目安：${level.label}`}>
      <span className="level-bars" aria-hidden="true">
        {[1, 2, 3].map(n => <i key={n} className={n <= level.steps ? "filled" : ""} />)}
      </span>
      {level.label}
    </span>
  );
}

export function OfficialPublisher({ deck }: { deck: Deck }) {
  if (!deck.isOfficial) return null;
  const level = deck.officialLevel && LEVELS[deck.officialLevel];
  return (
    <section className="official-publisher" aria-label="発行元と学習レベル">
      <div className="publisher-identity">
        <img src="/favicon.svg" alt="" />
        <div><OfficialBadge /><p>Azukiが編集した単語帳です。</p></div>
      </div>
      {level && <div className="publisher-level">
        <div className="publisher-level-heading"><span>学習レベルの目安</span><OfficialLevelBadge deck={deck} /></div>
        <p>{level.description}</p>
        <details className="level-guide">
          <summary>レベルについて</summary>
          <p>単語帳全体の語彙の広さ・専門性をもとにした、Azuki独自の目安です。</p>
          <dl>{Object.entries(LEVELS).map(([key, item]) => <div key={key}><dt>{item.label}</dt><dd>{item.description}</dd></div>)}</dl>
        </details>
      </div>}
    </section>
  );
}

export function DeckCredit({ deck }: { deck: Deck }) {
  if (deck.contentSource !== "ejdict") return null;
  return (
    <p className="deck-credit">
      出典：<a href="https://github.com/kujirahand/EJDict" target="_blank" rel="noreferrer">EJDict</a>
      {" "}（<a href="https://creativecommons.org/publicdomain/zero/1.0/deed.ja" target="_blank" rel="noreferrer">CC0</a>）。
      テーマに合わせて語義を編集・補足しています。
    </p>
  );
}

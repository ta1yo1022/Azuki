import {useI18n} from '../lib/i18n';
import { BadgeCheck } from "lucide-react";
import type { Deck, OfficialLevel } from "../../shared/model";

export const LEVELS: Record<OfficialLevel, { label: string; steps: number; description: string }> = {
  beginner: { label: "初級", steps: 1, description: "身近な場面で使う基本の語彙から学びたい人向け。" },
  intermediate: { label: "中級", steps: 2, description: "基本の語彙から、表現の幅や意味の使い分けを広げたい人向け。" },
  advanced: { label: "上級", steps: 3, description: "専門的な場面や抽象的な内容に使う語彙まで学びたい人向け。" },
};

export function OfficialBadge() {
 const t=useI18n();
  return <span className="official-badge"><BadgeCheck size={15} aria-hidden="true" />{t("Azuki運営 発行")}</span>;
}

export function OfficialLevelBadge({ deck }: { deck: Deck }) {
 const t=useI18n();
  if (deck.isOfficial && deck.cefrLevel) return <span className="official-level" aria-label={t("CEFR-Jレベル：{0}", deck.cefrLevel)}>{deck.cefrLevel}</span>;
  if (!deck.isOfficial || !deck.officialLevel) return null;
  const level = LEVELS[deck.officialLevel];
  if (!level) return null;
  return (
    <span className={`official-level level-${deck.officialLevel}`} aria-label={t("学習レベルの目安：{0}", t(level.label))}>
      <span className="level-bars" aria-hidden="true">
        {[1, 2, 3].map(n => <i key={n} className={n <= level.steps ? "filled" : ""} />)}
      </span>
      {t(level.label)}
    </span>
  );
}

export function OfficialPublisher({ deck }: { deck: Deck }) {
 const t=useI18n();
  if (!deck.isOfficial) return null;
  const level = deck.officialLevel && LEVELS[deck.officialLevel];
  return (
    <section className="official-publisher" aria-label={t("発行元と学習レベル")}>
      <div className="publisher-identity">
        <img src="/favicon.svg" alt="" />
        <div><OfficialBadge /><p>{t("Azukiが編集した単語帳です。")}</p></div>
      </div>
      {deck.cefrLevel && <div className="publisher-level"><div className="publisher-level-heading"><span>{t("CEFR-Jの語彙レベル")}</span><OfficialLevelBadge deck={deck} /></div><p>{t("原典の品詞別レベルを使用しています。前編・後編は掲載順による分割です。")}</p><p>{t("CEFR-JによるAzukiの監修・認定を示すものではありません。")}</p></div>}
      {level && <div className="publisher-level">
        <div className="publisher-level-heading"><span>{t("学習レベルの目安")}</span><OfficialLevelBadge deck={deck} /></div>
        <p>{t(level.description)}</p>
        <details className="level-guide">
          <summary>{t("レベルについて")}</summary>
          <p>{t("単語帳全体の語彙の広さ・専門性をもとにした、Azuki独自の目安です。")}</p>
          <dl>{Object.entries(LEVELS).map(([key, item]) => <div key={key}><dt>{t(item.label)}</dt><dd>{t(item.description)}</dd></div>)}</dl>
        </details>
      </div>}
    </section>
  );
}

export function DeckCredit({ deck }: { deck: Deck }) {
 const t=useI18n();
  if (deck.contentSource === "cefrj") return <div className="deck-credit cefrj-credit">
    <p>{t("出典：『CEFR-J Wordlist Version 1.6』東京外国語大学投野由紀夫研究室（")}<a href="https://www.cefr-j.org/download.html#cefrj_wordlist" target="_blank" rel="noreferrer">{t("CEFR-J公式サイト")}</a>{t("より2026年10月ダウンロード）。語彙表の著作権は原著作者に帰属します。")}</p>
    <p>{t("Azukiがレベル別に二分し、")}<a href="https://github.com/kujirahand/EJDict" target="_blank" rel="noreferrer">EJDict</a>（<a href="https://creativecommons.org/publicdomain/zero/1.0/deed.ja" target="_blank" rel="noreferrer">CC0</a>{t("）を参考に、AIを用いて日本語の意味と例文を編集しています。代表的な意味の選定・その他の意味・例文とその日本語訳はAzukiが追加したもので、CEFR-Jの公式訳や公式例文ではありません。日本語訳はAIによる下訳を含みます。")}</p>
    <p>{t("項目数は品詞別です。同じ綴りが複数の品詞・レベルに含まれることがあります。")}</p>
  </div>;
  if (deck.contentSource !== "ejdict") return null;
  return (
    <p className="deck-credit"> {t("出典：")}<a href="https://github.com/kujirahand/EJDict" target="_blank" rel="noreferrer">EJDict</a>
      {" "}（<a href="https://creativecommons.org/publicdomain/zero/1.0/deed.ja" target="_blank" rel="noreferrer">CC0</a>{t("）。 テーマに合わせて語義を編集・補足しています。例文の日本語訳はAIによる下訳を含みます。")} </p>
  );
}

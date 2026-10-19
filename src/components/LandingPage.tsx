import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BookOpenText, Check,
  ChevronLeft, ChevronRight, FileJson, Globe, Layers,
  RotateCw,
} from "lucide-react";
import "./landing.css";

type Props = {
  canSignIn: boolean;
  signingIn: boolean;
  error: string;
  onLogin: () => void;
  onDemo: () => void;
};
const previewWords = [
  { word: "curious", pronunciation: "/ˈkjʊriəs/", type: "adjective", meaning: "好奇心の強い", example: "Stay curious about the world.", translation: "世界への好奇心を忘れずに。" },
  { word: "discover", pronunciation: "/dɪˈskʌvər/", type: "verb", meaning: "発見する", example: "Discover something new every day.", translation: "毎日、新しい何かを見つけよう。" },
  { word: "bloom", pronunciation: "/bluːm/", type: "verb", meaning: "花が咲く", example: "Give yourself time to bloom.", translation: "自分が花開くための時間をあげよう。" },
];
const sampleBooks = [
  { id: "sample-0", number: "01", title: "Everyday\nEnglish", label: "日常会話で使う表現", words: 16, color: "rose" },
  { id: "sample-1", number: "02", title: "気持ちを\n伝える英語", label: "感情や気持ちを表す単語", words: 12, color: "olive" },
  { id: "sample-2", number: "03", title: "Reading\nNotes", label: "読書で出会う単語", words: 8, color: "sand" },
];
function LandingBrand() {
  return <span className="brand"><img src="/favicon.svg" alt="" /><span>azuki</span></span>;
}
function PreviewCard() {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const word = previewWords[index];
  function move(direction: number) {
    setRevealed(false);
    setIndex((current) => (current + direction + previewWords.length) % previewWords.length);
  }
  return <div className="landing-card-scene">
    <div className="landing-card-orbit" aria-hidden="true" />
    <div className="landing-card-annotation" aria-hidden="true">
      タップして答えを確認
      <svg width="74" height="48" viewBox="0 0 74 48" fill="none"><path d="M4 5C20 1 56 6 53 35M43 27L53 39L64 29" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
    <div className="landing-card-stack">
      <div className="landing-card-sheet sheet-back" aria-hidden="true" />
      <div className="landing-card-sheet sheet-middle" aria-hidden="true" />
      <button
        className={`landing-preview-card ${revealed ? "is-revealed" : ""}`}
        onClick={() => setRevealed((value) => !value)}
        aria-label={revealed ? `${word.word}：${word.meaning}。タップして日本語に戻る` : `${word.meaning}の英語を確認する`}
        aria-pressed={revealed}
      >
        <span className="landing-card-inner" key={index}>
          <span className="landing-card-side landing-card-front" aria-hidden={revealed}>
            <span className="landing-card-top"><span>日本語</span><BookOpenText size={21} strokeWidth={1.5} /></span>
            <span className="landing-card-prompt">{word.meaning}</span>


            <span className="landing-card-bottom"><span>タップして英語を見る</span><RotateCw size={17} /></span>
          </span>
          <span className="landing-card-side landing-card-back" aria-hidden={!revealed}>
            <span className="landing-card-top"><span>英語・例文</span><BookOpenText size={21} strokeWidth={1.5} /></span>
            <span className="landing-card-answer">{word.word}</span>
            <span className="landing-card-example">{word.example}</span>

            <span className="landing-card-bottom"><span>タップして日本語に戻る</span><RotateCw size={17} /></span>
          </span>
        </span>
      </button>
    </div>
    <div className="landing-preview-controls">
      <button aria-label="前のサンプルカード" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
      <span aria-live="polite"><strong>{String(index + 1).padStart(2, "0")}</strong><span> / 03</span></span>
      <button aria-label="次のサンプルカード" onClick={() => move(1)}><ChevronRight size={18} /></button>
    </div>
  </div>;
}
export function LandingPage({ canSignIn, signingIn, error, onLogin, onDemo }: Props) {
  const { hash } = useLocation();
  useEffect(() => { document.title = "Azuki | 自分の単語帳で英語を覚える"; }, []);
  useEffect(() => {
    if (!hash) return;
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [hash]);
  return <div className="landing">
    <a className="skip-link" href="#landing-main">本文に移動</a>
    <header className="landing-header landing-container">
      <Link to="/" aria-label="Azukiのホームへ" className="landing-brand-link"><LandingBrand /></Link>
      <nav aria-label="トップページのナビゲーション">
        <a className="landing-nav-about" href="#about">Azukiについて</a>
        <a className="landing-nav-how" href="#how-to">使いかた</a>
        <Link className="landing-nav-explore" to="/explore">公開単語帳を探す <ArrowUpRight size={16} /></Link>
      </nav>
    </header>
    <main id="landing-main">
      <section className="landing-hero landing-container" id="start" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <h1 id="landing-title">自分の単語帳で、<br /><span>英語を覚える。</span></h1>
          <p className="landing-lead">覚えたい単語を登録して、カードで練習。<br />公開単語帳も、自分用に保存できます。</p>
          <div className="landing-start-actions">
            <button className="landing-google-button" disabled={!canSignIn || signingIn} onClick={onLogin}>
              <img src="/google-mark.png" width={20} height={20} alt="" />
              {signingIn ? "接続しています…" : "Googleでログイン"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button className="landing-google-button landing-demo-button" onClick={onDemo}><BookOpenText size={20} aria-hidden="true" />サンプルの単語帳で試す <ArrowRight size={17} aria-hidden="true" /></button>
            {!canSignIn && <span className="landing-login-note">Googleログインは準備中です。</span>}
            {error && <p role="alert" className="error-box landing-login-error">{error}</p>}
          </div>
        </div>
        <div className="landing-product-stage">
          <div className="landing-stage-caption"><span>YOUR WORDS, YOUR WAY.</span><span>まずは、一枚めくってみる。</span></div>
          <div className="landing-mini-book" aria-hidden="true">
            <span className="landing-mini-label">MY WORDBOOK / 01</span>
            <h2>旅先で出会う、<br />新しいことば。</h2>
            <span className="landing-mini-tag">旅行・ホテル</span>
            <div><strong>reservation</strong><span>予約</span></div>
            <div><strong>destination</strong><span>目的地</span></div>
            <div><strong>discover</strong><span>発見する</span></div>
            <small>覚えたい単語を、自分の一冊に。</small>
          </div>
          <PreviewCard />
          <div className="landing-stage-note"><Layers size={18} /><span>読む。めくる。覚える。</span><span>スマホでも、パソコンでも。</span></div>
        </div>
      </section>
      <section className="landing-about" id="about" aria-labelledby="about-title">
        <div className="landing-container">
          <div className="landing-section-heading">
            <div><span className="landing-eyebrow">MAKE IT YOURS</span><h2 id="about-title">覚えたいことばを、<br />覚えやすいかたちに。</h2></div>
            <p>パソコンでもスマートフォンでも。<br />Googleアカウントで単語帳を同期できます。</p>
          </div>
          <div className="landing-features" id="how-to">
            <article><div className="landing-feature-top"><span>01</span><FileJson size={28} strokeWidth={1.4} /></div><h3>JSONからまとめて登録</h3><p>AIで作った単語リストも、手元のJSONも。内容を確認して、名前を付ければ自分の一冊に。</p><Link className="landing-inline-link" to="/guide/create">単語帳の作り方を見る <ArrowUpRight size={15} /></Link></article>
            <article><div className="landing-feature-top"><span>02</span><Layers size={28} strokeWidth={1.4} /></div><h3>カードをめくって練習</h3><p>日本語を見て、英語で答える練習から。英語から日本語への切り替えもできます。</p><span className="landing-feature-caption">順番どおりでも、シャッフルでも。</span></article>
            <article><div className="landing-feature-top"><span>03</span><Globe size={28} strokeWidth={1.4} /></div><h3>単語帳を探して保存</h3><p>単語帳名や教材タグで検索。気に入った単語帳を保存すると、自分用の非公開コピーになります。</p><Link className="landing-inline-link" to="/explore">公開単語帳を探す <ArrowUpRight size={15} /></Link></article>
          </div>
        </div>
      </section>
      <section className="landing-reading landing-container" aria-labelledby="reading-title">
        <div className="landing-reading-copy"><span className="landing-eyebrow">A LITTLE MORE FAMILIAR</span><h2 id="reading-title">本をひらくように。<br />ことばに触れる。</h2><p>英単語、意味、例文をひとつの見開きに。<br />ページをめくりながら読み進める、<br />単語帳モードもあります。</p><Link className="landing-inline-link" to="/shared/azuki-cefrj-a1-1-v1/book">単語帳モードを試す <ArrowUpRight size={17} /></Link></div>
        <div className="landing-open-book" aria-label="単語帳モードの表示イメージ">
          <div className="landing-paper"><span>MY ENGLISH NOTES</span><h3>ことばを、ひとつずつ。</h3>{previewWords.map((word, i) => <div className="landing-paper-row" key={word.word}><small>0{i + 1}</small><strong>{word.word}</strong><span>{word.meaning}</span></div>)}<small className="landing-page-number">01</small></div>
          <div className="landing-paper landing-paper-right"><span>WORDS IN CONTEXT</span><h3>例文で、使い方まで。</h3>{previewWords.map((word) => <div className="landing-paper-row" key={word.word}><p>{word.example}</p></div>)}<small className="landing-page-number">02</small></div>
        </div>
      </section>
      <section className="landing-samples landing-container" aria-labelledby="samples-title">
        <div className="landing-section-heading">
          <div><span className="landing-eyebrow">TAKE A LOOK INSIDE</span><h2 id="samples-title">はじめの一冊を、<br />ひらいてみよう。</h2></div>
          <p>ログインせずにカード学習を試せます。</p>
        </div>
        <div className="landing-books">
          {sampleBooks.map((book) => <Link className={`landing-book ${book.color}`} to={`/demo/decks/${book.id}`} key={book.id}>
            <div className="landing-book-cover">
              <div className="landing-book-top"><BookOpenText size={23} strokeWidth={1.4} /><span>サンプル</span><span>{book.number}</span></div>
              <h3>{book.title}</h3>
              <div className="landing-book-bottom"><span>{book.words}<small> words</small></span><span className="landing-book-monogram" aria-hidden="true">Aa</span></div>
              <span className="landing-book-spine" aria-hidden="true" />
            </div>
            <div className="landing-book-label"><span>{book.label}</span><span className="landing-book-arrow"><ArrowUpRight size={19} /></span></div>
          </Link>)}
        </div>
        <p className="landing-sample-note">サンプルの変更は、このブラウザに保存されます。</p>
      </section>
      <section className="landing-invitation landing-container" aria-labelledby="invitation-title">
        <div className="landing-invitation-mark" aria-hidden="true"><img src="/favicon.svg" alt="" /></div>
        <span className="landing-eyebrow">公開ライブラリ</span>
        <h2 id="invitation-title">自分の学びが、<br />誰かの一冊にもなる。</h2>
        <p>テストに向けて作った単語帳を、クラスの友達にも。<br />公開してリンクを送れば、同じ単語帳で学べます。</p>
        <Link className="landing-final-button" to="/explore">公開単語帳を探す <ArrowUpRight size={18} /></Link>
        <span className="landing-invitation-note"><Check size={14} />ログインなしで読めます。</span>
      </section>
    </main>
    <footer className="landing-footer landing-container">
      <div><LandingBrand /></div>
      <nav aria-label="フッターナビゲーション"><Link to="/explore">公開単語帳</Link><Link to="/demo">お試しモード</Link><Link to="/privacy">プライバシーポリシー</Link><Link to="/terms">利用規約</Link><a href="https://github.com/ta1yo1022/Azuki" target="_blank" rel="noreferrer">GitHub</a><a href="https://github.com/ta1yo1022/Azuki/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">PR・改善提案を歓迎</a><span>© {new Date().getFullYear()} Azuki</span></nav>
    </footer>
  </div>;
}

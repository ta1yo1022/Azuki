import { ReportButton } from "./ReportButton";
import { SearchInput } from "./SearchInput";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, googleSignIn } from "../lib/firebase";
import { useQueryValue } from "../lib/navigation";
import {
  BookmarkPlus,
  ArrowLeft,
  BookOpenText,
  ChevronDown,
  Copy,
  Globe,
  Library,
  Layers,
  Search,
  Tag,
  X,
} from "lucide-react";
import type { Deck, Word } from "../../shared/model";
import { publicRepository, sharedDeckUrl } from "../lib/repository";
import { DeckLineage } from "./DeckLineage";
import { DeckVariants } from "./DeckVariants";
import { StudyPage } from "./StudyPage";
import { DeckCredit, OfficialBadge, OfficialLevelBadge, OfficialPublisher } from "./DeckCredit";

const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "読み込めませんでした。もう一度お試しください。";

export function PublicLibrary({ study = false }: { study?: boolean }) {
  const { deckId: id } = useParams();
  return id ? (
    <PublicDeck key={id} id={id} studying={study} />
  ) : (
    <PublicLayout>
      <Discover />
    </PublicLayout>
  );
}

function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-shell">
      <a className="skip-link" href="#public-main">
        本文に移動
      </a>
      <header className="public-header">
        <Link className="brand" to="/" aria-label="Azukiのホームへ">
          <img src="/favicon.svg" alt="" />
          <span>
            azuki<span className="brand-period">.</span>
          </span>
        </Link>
        <nav aria-label="公開ライブラリのナビゲーション">
          <Link to="/explore" className="text-button">
            <Search size={17} />
            単語帳を探す
          </Link>
          <Link to="/library" className="button secondary">
            <Library size={17} />
            マイライブラリ
          </Link>
        </nav>
      </header>
      <main id="public-main" className="public-main">
        {children}
      </main>
      <footer className="public-footer"><Link to="/privacy">プライバシーポリシー</Link>{" · "}<Link to="/terms">利用規約</Link>{" · "}
        Azuki · 英単語帳アプリ
      </footer>
    </div>
  );
}

function Discover() {
  const [query, setQuery] = useQueryValue("q");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setRetry((n) => n + 1);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setDecks([]);
    setNext(null);
    setError("");
    setLoading(true);
    const q = query.trim();
    const timer = setTimeout(
      () => {
        publicRepository
          .list(q, null, controller.signal)
          .then((page) => {
            if (current !== generation.current) return;
            setDecks(page.decks);
            setNext(page.nextCursor);
          })
          .catch((e) => {
            if (current === generation.current && !controller.signal.aborted)
              setError(message(e));
          })
          .finally(() => {
            if (current === generation.current) setLoading(false);
          });
      },
      q ? 350 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
      generation.current++;
    };
  }, [query, retry]);
  useEffect(() => {
    document.title = "公開単語帳を探す — Azuki";
  }, []);
  async function more() {
    if (!next || loading) return;
    const current = generation.current;
    setLoading(true);
    setError("");
    try {
      const page = await publicRepository.list(query.trim(), next);
      if (current !== generation.current) return;
      setDecks((prev) => [...prev, ...page.decks]);
      setNext(page.nextCursor);
    } catch (e) {
      if (current === generation.current) setError(message(e));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  return (
    <>
      <div className="public-intro">
        <span className="eyebrow">公開ライブラリ</span>
        <h1>
          みんなの単語帳<span className="heading-dot">.</span>
        </h1>
        <p>
          ログインせずに読めます。保存するにはGoogleログインが必要です。
        </p>
      </div>
      <div className="search-field public-search">
        <Search size={21} />
        <SearchInput
          aria-label="公開単語帳を検索"
          placeholder="単語帳名・説明・教材タグで検索"
          maxLength={100}
          value={query}
          onValueChange={setQuery}
        />
        {query && (
          <button
            className="clear-search"
            aria-label="公開単語帳の検索をクリア"
            onClick={() => setQuery("")}
          >
            <X size={17} />
          </button>
        )}
      </div>
      <div className="public-results-label">
        <span>
          {query.trim()
            ? `「${query.trim()}」の検索結果`
            : "公開されている単語帳"}
        </span>
        <span>新しく作成した順</span>
      </div>
      {error && (
        <div role="alert" className="error-box">
          {error}{" "}
          <button
            className="text-button"
            onClick={() =>
              decks.length ? void more() : setRetry((n) => n + 1)
            }
          >
            再読み込み
          </button>
        </div>
      )}
      <div className="deck-grid public-deck-grid">
        {decks.map((deck, index) => (
          <div className="public-family-card" key={deck.id}><Link
            className={`deck-card palette-${index % 3}${deck.isOfficial ? " official-deck-card" : ""}`}
            key={deck.id}
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
                <h2>{deck.title}</h2>
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
          </Link>
          {!!deck.variantCount && <Link className="family-variants-link" to={`/shared/${encodeURIComponent(deck.id)}?variants=1`}>派生版を見る（{deck.variantCount}冊）</Link>}
          </div>
        ))}
      </div>
      {loading && (
        <p role="status" className="loading-note">
          単語帳を探しています…
        </p>
      )}
      {!loading && !error && !decks.length && (
        <div className="empty-state public-empty">
          <BookOpenText size={42} strokeWidth={1.3} />
          <h2>
            {query.trim()
              ? "単語帳が見つかりません"
              : "公開された単語帳はまだありません"}
          </h2>
          <p>
            {query.trim()
              ? "別の単語帳名や教材名で検索してみてください。"
              : "自分の単語帳の「共有」から公開すると、ここにも表示されます。"}
          </p>
          {query.trim() ? (
            <button className="button secondary" onClick={() => setQuery("")}>
              検索条件をクリア
            </button>
          ) : (
            <Link className="button secondary" to="/">
              自分の単語帳をつくる
            </Link>
          )}
        </div>
      )}
      {next && (
        <div className="load-more">
          <button
            className="button secondary"
            onClick={() => void more()}
            disabled={loading}
          >
            続きを表示
          </button>
        </div>
      )}
    </>
  );
}

function PublicDeck({ id, studying }: { id: string; studying: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const detailPath = `/shared/${encodeURIComponent(id)}`;
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [authReady, setAuthReady] = useState(!auth);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saveVersion = useRef(0);
  const saveBusy = useRef(false);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (value) => {
      setUser(value);
      setAuthReady(true);
    }, () => {
      setSaveError("ログイン状態を確認できませんでした。再読み込みしてください。");
    });
  }, []);
  useEffect(() => {
    saveBusy.current = false;
    setSaving(false);
    setSaveError("");
    return () => { saveVersion.current++; };
  }, [location.pathname]);
  async function save() {
    if (saveBusy.current || !authReady) return;
    saveBusy.current = true;
    const current = saveVersion.current;
    setSaving(true);
    setSaveError("");
    try {
      if (!auth?.currentUser) await googleSignIn();
      if (current !== saveVersion.current) return;
      const saved = await publicRepository.save(id);
      if (current === saveVersion.current) navigate(`/library/decks/${encodeURIComponent(saved.id)}`);
    } catch (e) {
      if (current !== saveVersion.current) return;
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setSaveError(code?.startsWith("auth/")
          ? "Googleログインに接続できませんでした。ポップアップを許可して、もう一度お試しください。"
          : message(e));
      }
    } finally {
      if (current === saveVersion.current) {
        saveBusy.current = false;
        setSaving(false);
      }
    }
  }
  const [deck, setDeck] = useState<Deck | null>(null);
  const [query, setQuery] = useQueryValue("q");
  const [words, setWords] = useState<Word[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setRetry((n) => n + 1);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setWords([]);
    setNext(null);
    setError("");
    setLoading(true);
    const timer = setTimeout(
      async () => {
        try {
          const [value, page] = await Promise.all([
            publicRepository.get(id, controller.signal),
            studying ? Promise.resolve({ words: [], nextCursor: null }) : publicRepository.words(id, query, 0, controller.signal),
          ]);
          if (current !== generation.current) return;
          setDeck(value);
          setWords(page.words);
          setNext(page.nextCursor);
          document.title = `${value.title} — Azuki`;
        } catch (e) {
          if (current === generation.current && !controller.signal.aborted) {
            setDeck(null);
            setError(message(e));
          }
        } finally {
          if (current === generation.current) setLoading(false);
        }
      },
      query ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
      generation.current++;
    };
  }, [id, query, retry, studying]);
  async function more() {
    if (next === null || loading) return;
    const current = generation.current;
    setLoading(true);
    setError("");
    try {
      const page = await publicRepository.words(id, query, next);
      if (current !== generation.current) return;
      setWords((prev) => [...prev, ...page.words]);
      setNext(page.nextCursor);
    } catch (e) {
      if (current !== generation.current) return;
      // Never retain already-rendered words after a visibility error on the next page.
      setDeck(null);
      setWords([]);
      setNext(null);
      setError(message(e));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  async function copy() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(sharedDeckUrl(id));
      setCopied(true);
    } catch {
      setCopyError("アドレスバーのURLをコピーして共有してください。");
    }
  }
  if (studying && deck) {
    return (
      <StudyPage
        key={deck.id}
        deck={deck}
        reader={publicRepository}
        onClose={() => navigate(detailPath + location.search)}
      />
    );
  }
  return (
    <PublicLayout>
      <Link className="back-button" to="/explore">
        <ArrowLeft size={16} />
        公開単語帳を探す
      </Link>
      {error && (
        <div className="public-empty empty-state">
          <BookOpenText size={36} />
          <h1>単語帳を読み込めません</h1>
          <p role="alert">{error}</p>
          <button
            className="button secondary"
            onClick={() => setRetry((n) => n + 1)}
          >
            もう一度読み込む
          </button>
        </div>
      )}
      {deck && (
        <>
          <div className="detail-heading public-detail-heading">
            <div>
              <span className="eyebrow">公開単語帳</span>
              <h1>{deck.title}</h1>
              <p>{deck.description}</p>
              <div className="detail-tags">
                {deck.isOfficial && <OfficialBadge />}
                <span className="tag public-badge">
                  <Globe size={13} />
                  公開
                </span>
                <span>{deck.wordCount} 語</span>
                {deck.textbookTags.map((tag, i) => (
                  <Link
                    key={i}
                    className="tag"
                    to={`/explore?q=${encodeURIComponent(tag.name)}`}
                  >
                    <Tag size={12} />
                    {[tag.name, tag.edition, tag.chapter]
                      .filter(Boolean)
                      .join(" / ")}
                  </Link>
                ))}
              </div>
            </div>
            <div className="owner-deck-actions">
              <button
                className="button primary"
                onClick={() => navigate(`${detailPath}/study${location.search}`)}
              >
                <Layers size={17} />
                カードで学習
              </button>
              <button className="button secondary" onClick={() => void save()} disabled={saving || !authReady || !auth}>
                <BookmarkPlus size={17} />
                {saving ? "保存しています…" : user ? "自分の単語帳に保存" : "Googleでログインして保存"}
              </button>
              <button className="button secondary" onClick={() => void copy()}>
                <Copy size={17} />
                {copied ? "コピーしました" : "リンクをコピー"}
              </button>
            </div>
          </div>
          <ReportButton key={deck.id} id={deck.id} title={deck.title} />
          <OfficialPublisher deck={deck} />
          <DeckCredit deck={deck} />
          <DeckLineage deck={deck} />
          <DeckVariants deck={deck} />
          <p className="public-save-note">保存すると、自分専用の非公開コピーになります。元の単語帳の変更は反映されません。保存したままのコピーは再公開できません。</p>
          {saveError && <p role="alert" className="error-box">{saveError}</p>}
          {copyError && (
            <p role="status" className="muted">
              {copyError}
            </p>
          )}
          <div className="detail-toolbar">
            <div className="search-field">
              <Search size={18} />
              <SearchInput
                aria-label="公開単語帳の単語・意味を検索"
                placeholder="英単語・意味で検索"
                maxLength={100}
                value={query}
                onValueChange={setQuery}
              />
              {query && (
                <button
                  className="clear-search"
                  aria-label="単語の検索をクリア"
                  onClick={() => setQuery("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <span className="result-count">{words.length} 語を表示</span>
          </div>
          <div className="word-list">
            <div className="word-list-head">
              <span>WORD / MEANING</span>
              <span>タップして例文を表示</span>
            </div>
            {words.map((word) => (
              <details className="word-item" key={word.id}>
                <summary>
                  <span className="word-ordinal">
                    {String(word.ordinal + 1).padStart(2, "0")}
                  </span>
                  <span className="word-pair">
                    <strong>{word.word}</strong>
                    <span>{word.meaning}</span>
                  </span>
                  <span className="word-tags">
                    {word.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </span>
                  <ChevronDown className="word-expand" size={17} />
                </summary>
                <div className="word-detail">
                  <span className="eyebrow">例文</span>
                  <p>{word.example || "例文はまだ登録されていません。"}</p>
                </div>
              </details>
            ))}
          </div>
          {!loading && !words.length && (
            <div className="empty-state">
              <Search size={28} />
              <h2>単語が見つかりません</h2>
              <p>別の英単語や意味で検索してみてください。</p>
            </div>
          )}
          {next !== null && (
            <div className="load-more">
              <button
                className="button secondary"
                onClick={() => void more()}
                disabled={loading}
              >
                続きを表示
              </button>
            </div>
          )}
        </>
      )}
      {loading && (
        <p role="status" className="loading-note">
          単語帳を読み込んでいます…
        </p>
      )}
    </PublicLayout>
  );
}

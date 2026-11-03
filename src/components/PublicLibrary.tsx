import {languageName} from '../lib/i18n';
import {SiteLanguageSelect} from './SiteLanguageSelect';
import {useI18n,t} from '../lib/i18n';
import {LANGUAGES} from '../../shared/languages';
import { ProBookGate } from './PlansPage';
import { WordAudioButton } from "./WordAudioButton";
import { ActionMenu } from "./ActionMenu";
import { FavoriteButton } from "./Favorites";
import { BookStudyPage } from "./BookStudyPage";
import { PublicDeckCard } from "./PublicDeckCard";
import { ForkDialog } from "./ForkDialog";
import { WordDetails } from "./WordDetails";
import { findStandardDecks } from "../../shared/standardDecks";
import { StandardLibrary } from "./StandardLibrary";
import { ReportButton } from "./ReportButton";
import { SearchInput } from "./SearchInput";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, googleSignIn } from "../lib/firebase";
import { useQueryValue } from "../lib/navigation";
import {
  ArrowLeft,
  BookOpenText,
  ChevronDown,
  Globe,
  Library,
  Search,
  Tag,
  X,
} from "lucide-react";
import type { Deck, Word } from "../../shared/model";
import { publicRepository, sharedDeckUrl } from "../lib/repository";
import { DeckLineage } from "./DeckLineage";
import { DeckVariants } from "./DeckVariants";
import { StudyPage } from "./StudyPage";
import { DeckCredit, OfficialBadge, OfficialPublisher } from "./DeckCredit";

const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : t("読み込めませんでした。もう一度お試しください。");

export function PublicLibrary({ study = false, book = false }: { study?: boolean; book?: boolean }) {
 const t=useI18n();
  const { deckId: id } = useParams();
  return id ? (
    <PublicDeck key={id} id={id} studying={study || book} bookMode={book} />
  ) : (
    <PublicLayout>
      <Discover />
    </PublicLayout>
  );
}

function PublicLayout({ children }: { children: ReactNode }) {
 const t=useI18n();
  return (
    <div className="public-shell">
      <a className="skip-link" href="#public-main"> {t("本文に移動")} </a>
      <header className="public-header">
        <Link className="brand" to="/" aria-label={t("Azukiのホームへ")}>
          <img src="/favicon.svg" alt="" />
          <span>
            azuki
          </span>
        </Link>
        <nav aria-label={t("公開ライブラリのナビゲーション")}><SiteLanguageSelect/>
          <Link to="/explore" className="text-button">
            <Search size={17} /> {t("単語帳を探す")} </Link>
          <Link to="/library" className="button secondary">
            <Library size={17} /> {t("マイライブラリ")} </Link>
        </nav>
      </header>
      <main id="public-main" className="public-main">
        {children}
      </main>

    </div>
  );
}

function Discover() {
 const t=useI18n();
  const [language,setLanguage]=useQueryValue("language");
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
          .list(q, null, controller.signal,language||undefined)
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
  }, [query, retry,language]);
  useEffect(() => {
    document.title = t("公開単語帳を探す — Azuki");
  }, []);
  async function more() {
    if (!next || loading) return;
    const current = generation.current;
    setLoading(true);
    setError("");
    try {
      const page = await publicRepository.list(query.trim(), next,undefined,language||undefined);
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
        
        <h1> {t("みんなの単語帳")} </h1>
        <p> {t("ログインせずに読めます。保存するにはGoogleログインが必要です。")} </p>
      </div>
      <div className="search-field public-search">
        <Search size={21} />
        <SearchInput
          aria-label={t("公開単語帳を検索")}
          placeholder={t("単語帳名・説明・教材タグで検索")}
          maxLength={100}
          value={query}
          onValueChange={setQuery}
        />
        {query && (
          <button
            className="clear-search"
            aria-label={t("公開単語帳の検索をクリア")}
            onClick={() => setQuery("")}
          >
            <X size={17} />
          </button>
        )}
      </div>
      <label className="language-filter">{t("学習する言語")}<select aria-label={t("公開単語帳の言語")} value={language} onChange={e=>setLanguage(e.target.value)}><option value="">{t("すべての言語")}</option>{LANGUAGES.map(item=><option key={item.code} value={item.code}>{t(item.name)}</option>)}</select></label>
      {(!language||language==='en')&&<StandardLibrary query={query} />}
      <div className="public-results-label">
        <span>
          {query.trim()
            ? t("「{0}」の検索結果", query.trim())
            : t("公開されている単語帳")}
        </span>
        <span>{t("新しく作成した順")}</span>
      </div>
      {error && (
        <div role="alert" className="error-box">
          {t(error)}{" "}
          <button
            className="text-button"
            onClick={() =>
              decks.length ? void more() : setRetry((n) => n + 1)
            }
          > {t("再読み込み")} </button>
        </div>
      )}
      <div className="deck-grid public-deck-grid">
        {decks.map((deck, index) => (
          <div className="public-family-card" key={deck.id}><PublicDeckCard deck={deck} index={index} />
          {!!deck.variantCount && <Link className="family-variants-link" to={`/shared/${encodeURIComponent(deck.id)}?variants=1`}>{t("派生版を見る（")}{deck.variantCount}{t("冊）")}</Link>}
          </div>
        ))}
      </div>
      {loading && (
        <p role="status" className="loading-note"> {t("単語帳を探しています…")} </p>
      )}
      {!loading && !error && !decks.length && !findStandardDecks(query).length && (
        <div className="empty-state public-empty">
          <BookOpenText size={42} strokeWidth={1.3} />
          <h2>
            {query.trim()
              ? t("単語帳が見つかりません")
              : t("公開された単語帳はまだありません")}
          </h2>
          <p>
            {query.trim()
              ? t("別の単語帳名や教材名で検索してみてください。")
              : t("自分の単語帳の「共有」から公開すると、ここにも表示されます。")}
          </p>
          {query.trim() ? (
            <button className="button secondary" onClick={() => setQuery("")}> {t("検索条件をクリア")} </button>
          ) : (
            <Link className="button secondary" to="/"> {t("自分の単語帳をつくる")} </Link>
          )}
        </div>
      )}
      {next && (
        <div className="load-more">
          <button
            className="button secondary"
            onClick={() => void more()}
            disabled={loading}
          > {t("続きを表示")} </button>
        </div>
      )}
    </>
  );
}

function PublicDeck({ id, studying, bookMode }: { id: string; studying: boolean; bookMode: boolean }) {
 const t=useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const detailPath = `/shared/${encodeURIComponent(id)}`;
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [authReady, setAuthReady] = useState(!auth);
  const [saving, setSaving] = useState(false);
  const [forkOpen,setForkOpen]=useState(false);
  const [saveError, setSaveError] = useState("");
  const saveVersion = useRef(0);
  const saveBusy = useRef(false);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (value) => {
      setUser(value);
      setAuthReady(true);
    }, () => {
      setSaveError(t("ログイン状態を確認できませんでした。再読み込みしてください。"));
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
          ? t("Googleログインに接続できませんでした。ポップアップを許可して、もう一度お試しください。")
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
      setCopyError(t("アドレスバーのURLをコピーして共有してください。"));
    }
  }
  if (bookMode && deck) return <ProBookGate onClose={() => navigate(detailPath + location.search)}><BookStudyPage key={deck.id} deck={deck} reader={publicRepository} onClose={() => navigate(detailPath + location.search)} /></ProBookGate>;
  if (studying && deck) {
    return (
      <StudyPage
        key={`${deck.id}-${new URLSearchParams(location.search).get("mode")}`}
        mode={new URLSearchParams(location.search).get("mode") === "examples" ? "examples" : "words"}
        deck={deck}
        reader={publicRepository}
        onClose={() => navigate(detailPath + location.search)}
      />
    );
  }
  return (
    <PublicLayout>
      <Link className="back-button" to="/explore">
        <ArrowLeft size={16} /> {t("公開単語帳を探す")} </Link>
      {error && (
        <div className="public-empty empty-state">
          <BookOpenText size={36} />
          <h1>{t("単語帳を読み込めません")}</h1>
          <p role="alert">{t(error)}</p>
          <button
            className="button secondary"
            onClick={() => setRetry((n) => n + 1)}
          > {t("もう一度読み込む")} </button>
        </div>
      )}
      {deck && (
        <>
          <div className="detail-heading public-detail-heading">
            <div>
              
              <h1>{deck.title}</h1><span className="deck-language-badge">{t(languageName(deck.language??'en'))} → {t(languageName(deck.meaningLanguage??'ja'))}</span>
              <p>{deck.description}</p>
              <div className="detail-tags">
                {deck.isOfficial && <OfficialBadge />}
                <span className="tag public-badge">
                  <Globe size={13} /> {t("公開")} </span>
                <span>{deck.wordCount} {t("語")}</span>
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
            <div className="owner-deck-actions public-deck-actions">
              <ActionMenu label={t("学習する")} primary items={[
                {label:t("カードで学習"),description:t("単語を1つずつ覚える"),onSelect:()=>navigate(`${detailPath}/study?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(location.search)),mode:"words"})}`)},
                {label:t("例文カードで学習"),description:t("例文と訳で練習する"),onSelect:()=>navigate(`${detailPath}/study?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(location.search)),mode:"examples"})}`)},
                {label:t("単語帳で学習"),description:t("本をめくるように、まとめて読む"),onSelect:()=>navigate(`${detailPath}/book${location.search}`)},
              ]}/>
              <FavoriteButton key={id} id={id} userId={user?.uid} />
              <ActionMenu label={t("その他")} items={[
                {label:t("コピーして編集"),description:t("自分用の非公開コピーを保存"),disabled:saving||!authReady||!auth,onSelect:()=>void save()},
                {label:t("TOONを編集してフォーク"),description:t("単語や例文をTOONでカスタマイズ"),onSelect:()=>setForkOpen(true)},
                {label:t("リンクをコピー"),description:t("この単語帳を共有する"),onSelect:()=>void copy()},
              ]}/>
              {(saving||copied)&&<span className="deck-action-status" role="status">{saving?t("コピーを保存しています…"):t("リンクをコピーしました")}</span>}
            </div>
          </div>
          {forkOpen && <ForkDialog key={`fork-${deck.id}`} deck={deck} onClose={()=>setForkOpen(false)} onSave={async input=>{
            if(!auth?.currentUser)await googleSignIn();
            const saved=await publicRepository.fork(deck.id,input);
            navigate(`/library/decks/${encodeURIComponent(saved.id)}`);
          }}/>}
          <ReportButton key={`report-${deck.id}`} id={deck.id} title={deck.title} />
          <OfficialPublisher deck={deck} />
          <DeckCredit deck={deck} />
          <DeckLineage deck={deck} />
          <DeckVariants deck={deck} />
          <p className="public-save-note">{t("お気に入りは元の単語帳へのショートカットです。コピーせずに使え、元の更新も反映されます。")}</p>
          <p className="public-save-note">{deck.standard ? t("標準単語帳はそのまま学習できます。「コピーして編集」では非公開コピーを保存し、個人の保存上限に含まれます。") : t("保存すると、自分専用の非公開コピーになります。元の単語帳の変更は反映されません。保存したままのコピーは再公開できません。")}</p>
          {deck.contentSource==='cefrj' && <p className="public-save-note">{t("コピーには代表的な意味と例文が含まれます。その他の意味・用法注記は元の単語帳で確認できます。")}</p>}
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
                aria-label={t("公開単語帳の単語・意味を検索")}
                placeholder={t("単語・意味で検索")}
                maxLength={100}
                value={query}
                onValueChange={setQuery}
              />
              {query && (
                <button
                  className="clear-search"
                  aria-label={t("単語の検索をクリア")}
                  onClick={() => setQuery("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <span className="result-count">{words.length} {t("語を表示")}</span>
          </div>
          <div className="word-list">
            <div className="word-list-head">
              <span>WORD / MEANING</span>
              <span>{deck.standard ? t("タップして意味・例文を表示") : t("タップして例文を表示")}</span>
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
                  <WordAudioButton deckId={deck.id} wordId={word.id} word={word.word} isPublic />
                  <span className="word-tags">
                    {word.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </span>
                  <ChevronDown className="word-expand" size={17} />
                </summary>
                <WordDetails language={deck.language} meaningLanguage={deck.meaningLanguage} word={word} deckId={deck.id} />
              </details>
            ))}
          </div>
          {!loading && !words.length && (
            <div className="empty-state">
              <Search size={28} />
              <h2>{t("単語が見つかりません")}</h2>
              <p>{t("別の英単語や意味で検索してみてください。")}</p>
            </div>
          )}
          {next !== null && (
            <div className="load-more">
              <button
                className="button secondary"
                onClick={() => void more()}
                disabled={loading}
              > {t("続きを表示")} </button>
            </div>
          )}
        </>
      )}
      {loading && (
        <p role="status" className="loading-note"> {t("単語帳を読み込んでいます…")} </p>
      )}
    </PublicLayout>
  );
}

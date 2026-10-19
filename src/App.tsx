import { BarChart3 } from "lucide-react";
import { StudyStatsPage, StudyStatsSummary } from "./components/StudyStatsPage";
import { Favorites } from "./components/Favorites";
import { BookStudyPage } from "./components/BookStudyPage";
import { ForkDialog } from "./components/ForkDialog";
import { Tutorial } from "./components/Tutorial";
import { SearchInput } from "./components/SearchInput";
import { Brand } from "./components/Brand";
import { LoadingScreen } from "./components/LoadingScreen";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryValue } from "./lib/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  ArrowLeft,
  BookOpen,
  BookOpenText,
  ChevronDown,
  FileJson,
  FolderOpen,
  Globe,
  Layers,
  Share2,
  Library,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { auth, googleSignIn } from "./lib/firebase";
import { cloudRepository, demoRepository, publicRepository } from "./lib/repository";
import { ImportDialog } from "./components/ImportDialog";
import { ShareDialog } from "./components/ShareDialog";
import { SettingsPage } from "./components/SettingsPage";
import { StudyPage } from "./components/StudyPage";
import { LandingPage } from "./components/LandingPage";
import { DeckLineage } from "./components/DeckLineage";
import { WordEditor } from "./components/WordEditor";
import { DeckCredit } from "./components/DeckCredit";
import { LIMITS, type Deck, type DeckInput, type Word } from "../shared/model";
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(
    new Date(value),
  );
const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "処理できませんでした。もう一度お試しください。";
function ProfileAvatar({
  name,
  photoURL,
  initial,
  small = false,
}: {
  name: string;
  photoURL: string | null | undefined;
  initial: string;
  small?: boolean;
}) {
  const [failedURL, setFailedURL] = useState<string | null>(null);
  return (
    <span
      className={small ? "small-avatar" : "avatar"}
      role="img"
      aria-label={`${name}のアイコン`}
    >
      {photoURL && failedURL !== photoURL ? (
        <img
          src={photoURL}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedURL(photoURL)}
        />
      ) : (
        initial
      )}
    </span>
  );
}
export default function App({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { deckId } = useParams();
  const base = demo ? "/demo" : "/library";
  const statsMode = location.pathname === `${base}/stats`;
  const detailPath = `${base}/decks/${encodeURIComponent(deckId ?? "")}`;
  const importing = location.pathname.endsWith("/import");
  const sharing = location.pathname.endsWith("/share");
  const bookMode = location.pathname.endsWith("/book");
  const studying = location.pathname.endsWith("/study") || bookMode;
  const [, setParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const ownerKey = demo ? "demo" : user?.uid ?? "signed-out";
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [search, setSearch] = useQueryValue("q");
  const [filter, setFilter] = useQueryValue("tag");
  const [sort, setSort] = useQueryValue("sort", "newest");
  const selected = decks.find((deck) => deck.id === deckId) ?? null;
  const [wordSearch, setWordSearch] = useQueryValue("q");
  const [words, setWords] = useState<Word[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [wordError, setWordError] = useState("");
  const [toast, setToast] = useState("");
  const [forkOpen,setForkOpen]=useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reload, setReload] = useState(0);
  const confirm = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const repository = demo ? demoRepository : cloudRepository;
  useEffect(() => { setConfirmDelete(false); setForkOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(
      auth,
      (value) => {
        setUser(value);
        setAuthReady(true);
        setDecks([]);
        setError("");
      },
      () => {
        setError(
          "ログイン状態を確認できませんでした。再読み込みしてください。",
        );
        setAuthReady(true);
      },
    );
  }, []);
  useEffect(() => {
    if (!authReady) return;
    if (!demo && !user) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    repository
      .list()
      .then((list) => {
        if (active) setDecks(list);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) { setLoadedOwner(ownerKey); setLoading(false); }
      });
    return () => {
      active = false;
    };
  }, [authReady, demo, user, repository, reload, ownerKey]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (demo || user) document.title = `${selected ? selected.title : "わたしの単語帳"} — Azuki`;
  }, [selected, demo, user]);
  useEffect(() => {
    const current = ++generation.current;
    setWords([]);
    setNext(null);
    setWordError("");
    if (!selected || studying) return;
    setWordsLoading(true);
    const timer = setTimeout(
      () => {
        repository
          .words(selected.id, wordSearch, 0)
          .then((page) => {
            if (generation.current === current) {
              setWords(page.words);
              setNext(page.nextCursor);
            }
          })
          .catch((e) => {
            if (generation.current === current) setWordError(errorMessage(e));
          })
          .finally(() => {
            if (generation.current === current) setWordsLoading(false);
          });
      },
      wordSearch ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [selected?.id, wordSearch, repository, reload, studying, ownerKey]);
  useEffect(() => {
    if (confirmDelete) confirm.current?.showModal();
  }, [confirmDelete]);
  const textbookNames = useMemo(
    () => [...new Set(decks.flatMap((d) => d.textbookTags.map((t) => t.name)))],
    [decks],
  );
  const totalWords = decks.reduce((n, d) => n + d.wordCount, 0);
  const filtered = useMemo(
    () =>
      decks
        .filter(
          (d) =>
            (!filter || d.textbookTags.some((t) => t.name === filter)) &&
            `${d.title} ${d.description} ${d.textbookTags.map((t) => `${t.name} ${t.edition ?? ""} ${t.chapter ?? ""}`).join(" ")}`
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.title.localeCompare(b.title, "ja")
            : b.createdAt.localeCompare(a.createdAt),
        ),
    [decks, filter, search, sort],
  );
  const displayName = demo
    ? "お試しユーザー"
    : user?.displayName || "マイアカウント";
  const photoURL = demo
    ? null
    : user?.providerData.find((profile) => profile.providerId === "google.com")
        ?.photoURL || user?.photoURL;
  const avatarInitial = demo ? "A" : Array.from(displayName)[0];
  function startDemo() {
    navigate("/demo");
  }
  async function login() {
    setSigningIn(true);
    setError("");
    try {
      await googleSignIn();
      if (demo || location.pathname === "/") navigate("/library");
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user")
        setError(
          code === "auth/unauthorized-domain"
            ? "このサイトでのGoogleログインは準備中です。お試しモードをご利用ください。"
            : code === "auth/popup-blocked"
              ? "ポップアップがブロックされました。許可してもう一度お試しください。"
              : "Googleログインに接続できませんでした。時間をおいてお試しください。",
        );
    } finally {
      setSigningIn(false);
    }
  }
  async function logout() {
    if (user && auth) {
      try {
        await signOut(auth);
      } catch {
        setError("ログアウトできませんでした。もう一度お試しください。");
        return;
      }
    }
    setDecks([]);
    setError("");
    navigate("/", { replace: true });
  }
  async function importDeck(input: DeckInput) {
    const deck = await repository.create(input);
    setDecks((prev) => [deck, ...prev]);
    setToast(`「${deck.title}」に${deck.wordCount}語を登録しました`);
  }
  async function moreWords() {
    if (!selected || next === null || wordsLoading) return;
    const current = generation.current;
    setWordsLoading(true);
    setWordError("");
    try {
      const page = await repository.words(selected.id, wordSearch, next);
      if (current === generation.current) {
        setWords((prev) => [...prev, ...page.words]);
        setNext(page.nextCursor);
      }
    } catch (e) {
      if (current === generation.current) setWordError(errorMessage(e));
    } finally {
      if (current === generation.current) setWordsLoading(false);
    }
  }
  async function changeVisibility(visibility: Deck["visibility"]) {
    if (!selected) return;
    const updated = await repository.visibility(selected.id, visibility);
    setDecks((prev) =>
      prev.map((deck) => (deck.id === updated.id ? updated : deck)),
    );
    setToast(
      visibility === "public"
        ? "単語帳を公開しました"
        : "単語帳を非公開に戻しました",
    );
  }
  async function removeDeck() {
    if (!selected || deleting) return;
    setDeleting(true);
    try {
      await repository.remove(selected.id);
      setDecks((prev) => prev.filter((d) => d.id !== selected.id));
      navigate(base, { replace: true });
      setConfirmDelete(false);
      setToast("単語帳を削除しました");
    } catch (e) {
      setError(errorMessage(e));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }
  if (!authReady) return <LoadingScreen />;
  if (!demo && user && location.pathname === "/") return <Navigate to="/library" replace />;
  if (!demo && !user) return (
    <LandingPage canSignIn={!!auth} signingIn={signingIn} error={error}
      onLogin={() => void login()} onDemo={startDemo} />
  );
  if (deckId && !selected && (loading || loadedOwner !== ownerKey)) return <LoadingScreen message="単語帳を読み込んでいます…" />;
  if (deckId && !selected) return (
    <div className="full-loading">
      <Brand />
      <>
        <h1>{error ? "単語帳を読み込めません" : "単語帳が見つかりません"}</h1>
        <p role={error ? "alert" : undefined}>{error || "削除されたか、このアカウントには保存されていません。"}</p>
        {error && <button className="button secondary" onClick={() => setReload((n) => n + 1)}>もう一度読み込む</button>}
        <Link className="text-button" to={base}>単語帳の一覧に戻る</Link>
      </>
    </div>
  );
  if (location.pathname === `${base}/settings`) return <SettingsPage demo={demo} onClose={() => navigate(base)} onTutorial={() => navigate(`${base}?tutorial=1`)} />;

  if (bookMode && selected) return <BookStudyPage key={selected.id} demo={demo} deck={selected} reader={repository} onClose={() => navigate(detailPath + location.search)} />;
  if (studying && selected) {
    return (
      <StudyPage
        key={`${selected.id}-${new URLSearchParams(location.search).get("mode")}`}
        demo={demo}
        mode={new URLSearchParams(location.search).get("mode") === "examples" ? "examples" : "words"}
        deck={selected}
        reader={repository}
        onClose={() => navigate(detailPath + location.search)}
      />
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        本文に移動
      </a>
      <aside className="sidebar">
        <button
          className="brand-home"
          aria-label="単語帳の一覧に戻る"
          onClick={() => navigate(base)}
        >
          <Brand />
        </button>
        <div className="sidebar-section-label">ライブラリ</div>
        <nav aria-label="メインナビゲーション">
          <button
            aria-label="わたしの単語帳"
            className={!filter && !statsMode ? "nav-item active" : "nav-item"}
            onClick={() => navigate(base)}
          >
            <Library size={19} />
            <span>わたしの単語帳</span>
            <span className="nav-count">{decks.length}</span>
          </button>
          <button
            aria-label="JSONから追加"
            className="nav-item"
            onClick={() => navigate(`${base}/import`)}
          >
            <FileJson size={19} />
            <span>JSONから追加</span>
          </button>
          <Link className={statsMode ? "nav-item active" : "nav-item"} aria-current={statsMode ? "page" : undefined} to={`${base}/stats`}><BarChart3 size={19}/><span>学習統計</span></Link>
          <Link data-tour="explore" className="nav-item" to="/explore">
            <Globe size={19} />
            <span>公開単語帳を探す</span>
          </Link>
          <Link className="profile-settings-link sidebar-mobile-settings" to={`${base}/settings`} aria-label="設定を開く"><ProfileAvatar name={displayName} photoURL={photoURL} initial={avatarInitial} small /></Link>
        </nav>
        <div className="sidebar-tags">
          <div className="sidebar-section-label">教材タグ</div>
          {textbookNames.length ? (
            textbookNames.map((name) => (
              <button
                key={name}
                className={`nav-item textbook-nav ${filter === name ? "active" : ""}`}
                onClick={() => navigate(`${base}?tag=${encodeURIComponent(name)}`)}
              >
                <Tag size={15} />
                <span>{name}</span>
                <small>
                  {
                    decks.filter((d) =>
                      d.textbookTags.some((t) => t.name === name),
                    ).length
                  }
                </small>
              </button>
            ))
          ) : (
            <p className="sidebar-empty">教材タグはまだありません</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="storage-note">
            <span>
              <ShieldCheck size={16} />
              保存できる単語数
            </span>
            <p>{totalWords.toLocaleString()} / {LIMITS.userWords.toLocaleString()} 語</p>
            <div className="usage-track">
              <span
                style={{ width: `${Math.min(100, Math.max((totalWords / LIMITS.userWords) * 100, 1))}%` }}
              />
            </div>
          </div>
          <div className="profile">
            <Link to={`${base}/settings`} data-tour="profile" className="profile-settings-link" aria-label="設定を開く">
            <ProfileAvatar
              name={displayName}
              photoURL={photoURL}
              initial={avatarInitial}
            />
            </Link>
            <div>
              <strong>{displayName}</strong>
              <span>{demo ? "この端末に保存" : "Googleアカウント"}</span>
            </div>
            <button
              className="icon-button"
              aria-label={demo ? "お試しモードを終了" : "ログアウト"}
              onClick={() => void logout()}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        {demo && (
          <div className="demo-banner">
            <span>
              <span className="demo-dot" />
              サンプル入りのお試しモードです。変更はこの端末にのみ保存されます。
            </span>
            {auth && (
              <button onClick={() => void login()} disabled={signingIn}>
                Googleでログイン
              </button>
            )}
          </div>
        )}
        <main id="main" className="main-content">
          {error && (
            <div role="alert" className="error-box error-with-action">
              <span>{error}</span>
              <button
                className="text-button"
                onClick={() => setReload((n) => n + 1)}
              >
                再読み込み
              </button>
            </div>
          )}
          {statsMode ? <StudyStatsPage embedded demo={demo} userId={user?.uid} /> : !selected ? (
            <>
              <StudyStatsSummary demo={demo} userId={user?.uid} />
              <div className="page-heading">
                <div>

                  <h1>
                    わたしの単語帳
                  </h1>
                  <p>
                    <strong>{decks.length}</strong> 冊の単語帳{" "}
                    <span className="separator">/</span>{" "}
                    <strong>{totalWords.toLocaleString()}</strong> 語
                  </p>
                </div>
                <button
                  className="button primary"
                  data-tour="add"
                  onClick={() => navigate(`${base}/import`)}
                >
                  <Plus size={18} />
                  単語帳を追加
                </button>
              </div>
              <Link
                data-tour="explore" className="text-button mobile-only discover-mobile"
                to="/explore"
              >
                <Globe size={17} />
                公開単語帳を探す
              </Link>
              {!demo && user && <Favorites key={user.uid} owner={user.uid} />}
              <div className="library-toolbar" data-tour="search">
                <div className="search-field">
                  <Search size={18} />
                  <SearchInput
                    aria-label="単語帳を検索"
                    placeholder="単語帳・教材タグを検索"
                    maxLength={100}
                    value={search}
                    onValueChange={setSearch}
                  />
                  {search && (
                    <button
                      className="clear-search"
                      aria-label="検索をクリア"
                      onClick={() => setSearch("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <label className="sort-select">
                  <span className="visually-hidden">並び順</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="newest">追加した順</option>
                    <option value="name">名前順</option>
                  </select>
                  <ChevronDown size={15} />
                </label>
              </div>
              <div className="filter-row">
                <button
                  className={!filter ? "filter-chip selected" : "filter-chip"}
                  onClick={() => setFilter("")}
                >
                  すべて<span>{decks.length}</span>
                </button>
                {textbookNames.map((name) => (
                  <button
                    key={name}
                    className={
                      filter === name ? "filter-chip selected" : "filter-chip"
                    }
                    onClick={() => setFilter(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {loading ? (
                <div className="empty-state">
                  <BookOpen size={32} />
                  <h2>単語帳を読み込んでいます…</h2>
                </div>
              ) : filtered.length ? (
                <div className="deck-grid">
                  {filtered.map((deck, index) => (
                    <Link
                      className={`deck-card palette-${index % 3}`}
                      key={deck.id}
                      to={`${base}/decks/${encodeURIComponent(deck.id)}`}
                    >
                      <div className="deck-cover">
                        <span className="cover-top">
                          <BookOpenText size={20} strokeWidth={1.5} />
                          <span>
                            {deck.id.startsWith("sample-")
                              ? "サンプル"
                              : "自分の単語帳"}
                          </span>
                          <span className="cover-index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </span>
                        <div className="cover-title">
                          <h2>{deck.title}</h2>
                          <p>
                            {deck.description || "説明はありません"}
                          </p>
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
                          {deck.textbookTags.length ? (
                            <>
                              <Tag size={13} />
                              {deck.textbookTags[0].name}
                              {deck.textbookTags[0].chapter && (
                                <span> · {deck.textbookTags[0].chapter}</span>
                              )}
                              {deck.textbookTags.length > 1 && (
                                <span> +{deck.textbookTags.length - 1}</span>
                              )}
                            </>
                          ) : (
                            <span>教材タグなし</span>
                          )}
                        </span>
                        <div>
                          <span>
                            {deck.visibility === "public" ? (
                              <Globe size={12} />
                            ) : (
                              <LockKeyhole size={12} />
                            )}
                            {deck.visibility === "public" ? "公開" : "非公開"}
                          </span>
                          <span>{formatDate(deck.createdAt)} 追加</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <button
                    className="add-deck-card"
                    onClick={() => navigate(`${base}/import`)}
                  >
                    <span className="add-circle">
                      <Plus size={25} strokeWidth={1.4} />
                    </span>
                    <strong>新しい単語帳をつくる</strong>
                    <span>JSONからまとめて登録</span>
                    <span className="add-card-caption">
                      <FileJson size={15} />
                      ファイル選択・貼り付け
                    </span>
                  </button>
                </div>
              ) : (
                <div className="empty-state">
                  <FolderOpen size={38} strokeWidth={1.2} />
                  <h2>
                    {decks.length
                      ? "単語帳が見つかりません"
                      : "最初の単語帳をつくりましょう"}
                  </h2>
                  <p>
                    {decks.length
                      ? "別の名前や教材タグで検索してみてください。"
                      : "英単語と意味をまとめたJSONから追加できます。"}
                  </p>
                  <button
                    className="button secondary"
                    onClick={() =>
                      decks.length
                        ? setParams({})
                        : navigate(`${base}/import`)
                    }
                  >
                    {decks.length ? "検索条件をクリア" : "単語帳を追加"}
                  </button>
                </div>
              )}
              <footer className="library-footer">
                <span>
                  <LockKeyhole size={14} />
                  追加した単語帳は非公開。「共有」から公開できます。
                </span>
                <span>{demo ? "サンプルの変更は、このブラウザに保存されます。" : "単語帳はGoogleアカウントに保存されます。"}</span>
              </footer>
            </>
          ) : (
            <>
              <button className="back-button" onClick={() => navigate(base)}>
                <ArrowLeft size={16} />
                単語帳に戻る
              </button>
              <div className="detail-heading">
                <div>
                  
                  <h1>{selected.title}</h1>
                  <p>{selected.description}</p>
                  <DeckCredit deck={selected} />
                  <DeckLineage deck={selected} />
                  <div className="detail-tags">
                    <span
                      className={
                        selected.visibility === "public"
                          ? "tag public-badge"
                          : "private-badge"
                      }
                    >
                      {selected.visibility === "public" ? (
                        <Globe size={12} />
                      ) : (
                        <LockKeyhole size={12} />
                      )}
                      {selected.visibility === "public" ? "公開" : "非公開"}
                    </span>
                    <span>{selected.wordCount} 語</span>
                    {selected.textbookTags.map((t, i) => (
                      <span className="tag" key={i}>
                        <Tag size={12} />
                        {[t.name, t.edition, t.chapter]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="owner-deck-actions">
                  <button className="button secondary" onClick={() => navigate(`${detailPath}/book${location.search}`)}>単語帳で学習</button>
              <button className="button secondary" onClick={() => navigate(`${detailPath}/study?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(location.search)), mode:"examples"})}`)}>例文カードで学習</button>
                  {!demo && <button className="button secondary" onClick={()=>setForkOpen(true)}>JSONを編集してフォーク</button>}
                  <button
                    className="button primary"
                    onClick={() => navigate(`${detailPath}/study?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(location.search)), mode:"words"})}`)}
                  >
                    <Layers size={17} />
                    カードで学習
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => navigate(`${detailPath}/share${location.search}`)}
                  >
                    <Share2 size={17} />
                    共有
                  </button>
                  <button
                    className="icon-button delete-button"
                    aria-label="単語帳を削除"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={19} />
                  </button>
                </div>
              </div>
              <div className="detail-toolbar">
                <div className="search-field">
                  <Search size={18} />
                  <SearchInput
                    aria-label="単語・意味を検索"
                    placeholder="英単語・意味で検索"
                    maxLength={100}
                    value={wordSearch}
                    onValueChange={setWordSearch}
                  />
                  {wordSearch && (
                    <button
                      className="clear-search"
                      aria-label="単語の検索をクリア"
                      onClick={() => setWordSearch("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <span className="result-count">{words.length} 語を表示</span>
              </div>
              <div className="word-list">
                <div className="word-list-head">
                  <span>WORD / MEANING</span>
                  <span>タップして例文を表示・編集</span>
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
                      <WordEditor deck={selected} word={word} repository={repository} onSaved={(deck,savedWord) => { setDecks(prev => prev.map(d => d.id === deck.id ? deck : d)); setWords(prev=>prev.map(w=>w.id===savedWord.id?savedWord:w)); }} />
                    </div>
                  </details>
                ))}
              </div>
              {wordsLoading && (
                <p className="loading-note" role="status">
                  単語を読み込んでいます…
                </p>
              )}
              {wordError && (
                <div className="error-box" role="alert">
                  {wordError}
                  <button
                    className="text-button"
                    onClick={() => setReload((n) => n + 1)}
                  >
                    再読み込み
                  </button>
                </div>
              )}
              {!wordsLoading && !wordError && words.length === 0 && (
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
                    disabled={wordsLoading}
                    onClick={() => void moreWords()}
                  >
                    続きを表示
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {location.pathname === base && !loading && loadedOwner === ownerKey && (user || (demo && new URLSearchParams(location.search).get("tutorial") === "1")) && <Tutorial
        key={`${ownerKey}-${new URLSearchParams(location.search).get("tutorial") === "1"}`}
        owner={ownerKey}
        replay={new URLSearchParams(location.search).get("tutorial") === "1"}
        onFinish={() => setParams(current => { const next = new URLSearchParams(current); next.delete("tutorial"); return next; }, { replace: true })}
      />}
      {forkOpen && selected && !demo && <ForkDialog key={selected.id} deck={selected} reader={repository} onClose={()=>setForkOpen(false)} onSave={async input=>{
        const fork=await publicRepository.fork(selected.id,input);
        setDecks(previous=>[fork,...previous]);
        navigate(`/library/decks/${encodeURIComponent(fork.id)}`);
      }}/>}
      {sharing && selected && (
        <ShareDialog
          deck={selected}
          demo={demo}
          onClose={() => navigate(detailPath + location.search)}
          onVisibility={changeVisibility}
        />
      )}
      {importing && (
        <ImportDialog
          onClose={() => navigate(base)}
          onImport={importDeck}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <ShieldCheck size={18} />
          {toast}
        </div>
      )}
      {confirmDelete && (
        <dialog
          ref={confirm}
          className="confirm-dialog"
          aria-labelledby="delete-title"
          onCancel={(e) => {
            e.preventDefault();
            if (!deleting) setConfirmDelete(false);
          }}
        >
          <h2 id="delete-title">この単語帳を削除しますか？</h2>
          <p>
            「{selected?.title}
            」と登録された単語が削除されます。この操作は取り消せません。
          </p>
          <div className="confirm-actions">
            <button
              className="button secondary"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
            >
              キャンセル
            </button>
            <button
              className="button danger"
              disabled={deleting}
              onClick={() => void removeDeck()}
            >
              {deleting ? "削除しています…" : "削除する"}
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}

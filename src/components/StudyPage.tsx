import { WordDetails } from './WordDetails';
import { exampleWordParts } from '../lib/exampleWord';
import { WordAudioButton } from "./WordAudioButton";
import { useStudyArrows } from '../lib/useStudyArrows';
import { useStudyTracking } from "../lib/studyTracking";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { wordExamples, type Deck, type Word, type WordPage } from "../../shared/model";

import { readStudyPreferences, saveStudyPreferences } from "../lib/studyPreferences";

type StudyCard = Word & { sentence?: { text: string; translation: string } };

type WordReader = {
  words: (id: string, query: string, cursor: number) => Promise<WordPage>;
};

export function StudyPage({
  deck,
  reader,
  onClose,
  mode = "words",
  demo = false,
}: {
  mode?: "words" | "examples";
  demo?: boolean;
  deck: Deck;
  reader: WordReader;
  onClose: () => void;
}) {
  const examplesMode = mode === "examples";
  const [preferences] = useState(() => { const saved = readStudyPreferences(); return {...saved, direction: examplesMode ? saved.exampleDirection ?? "en-ja" as const : saved.direction}; });
  const [order, setOrder] = useState(preferences.order);
  const [direction, setDirection] = useState(preferences.direction);
  const [started, setStarted] = useState(preferences.skipSetup);
  const [settingsOpen, setSettingsOpen] = useState(!preferences.skipSetup);
  const [draft, setDraft] = useState(preferences);
  const [storageNote, setStorageNote] = useState("");
  const setupHeading = useRef<HTMLHeadingElement>(null);
  function applySettings() {
    setStorageNote(saveStudyPreferences(examplesMode ? {...readStudyPreferences(), order:draft.order, skipSetup:draft.skipSetup, exampleDirection:draft.direction} : draft) ? "" : "このブラウザに設定を保存できませんでした。今回の学習には適用しています。");
    setOrder(draft.order);
    setDirection(draft.direction);
    setRevealed(false);
    setStarted(true);
    setSettingsOpen(false);
  }
  const card = useRef<HTMLDivElement>(null);
  const [detailWord,setDetailWord]=useState<Word|null>(null);
  const detailDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(detailWord){detailDialog.current?.showModal();}else{detailDialog.current?.close();}},[detailWord]);
  const requestVersion = useRef(0);
  const busy = useRef(false);
  const [words, setWords] = useState<StudyCard[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useStudyTracking(deck,mode,started&&!settingsOpen&&!completed&&!loading&&!error&&words.length>0,demo);

  const loadPage = useCallback(
    async (cursor: number, advance = false) => {
      const version = ++requestVersion.current;
      busy.current = true;
      setLoading(true);
      setError("");
      setRevealed(false);
      setCompleted(false);
      if (cursor === 0) {
        setWords([]);
        setIndex(0);
        setNextCursor(null);
      }
      try {
        let page = await reader.words(deck.id, "", cursor);
        if (version !== requestVersion.current) return;
        if (order === "shuffle" || examplesMode) {
          // Load the whole book for global shuffling or to collect translated sentences.
          const all: StudyCard[] = [];
          const seen = new Set<string>();
          let pageCursor = cursor;
          while (true) {
            if (!page.words.length || page.words.some(w => seen.has(w.id)) ||
                (page.nextCursor !== null && page.nextCursor <= pageCursor)) {
              throw new Error("単語を読み込めませんでした。単語帳を開き直してください。");
            }
            for (const item of page.words) {
              seen.add(item.id);
              if (examplesMode) {
                wordExamples(item).forEach((sentence, i) => {
                  if (sentence.translation?.trim()) all.push({
                    ...item, id: `${item.id}:example:${i}`,
                    sentence: {text: sentence.text, translation: sentence.translation},
                  });
                });
              } else all.push(item);
            }
            if (page.nextCursor === null) break;
            pageCursor = page.nextCursor;
            page = await reader.words(deck.id, "", pageCursor);
            if (version !== requestVersion.current) return;
          }
          for (let i = order === "shuffle" ? all.length - 1 : 0; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [all[i], all[j]] = [all[j], all[i]];
          }
          page = { words: all, nextCursor: null };
        }
        if (version !== requestVersion.current) return;
        if (
          (!page.words.length && !examplesMode) ||
          (page.nextCursor !== null && page.nextCursor <= cursor)
        ) {
          throw new Error(
            "単語を読み込めませんでした。単語帳を開き直してください。",
          );
        }
        setWords((previous) =>
          cursor === 0 ? page.words : [...previous, ...page.words],
        );
        setNextCursor(page.nextCursor);
        if (advance) setIndex((previous) => previous + 1);
      } catch (cause) {
        if (version !== requestVersion.current) return;
        // Discard cached cards too, including when a public deck becomes private.
        setWords([]);
        setNextCursor(null);
        setIndex(0);
        setError(
          cause instanceof Error
            ? cause.message
            : "単語を読み込めませんでした。",
        );
      } finally {
        if (version === requestVersion.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [deck.id, reader, order, examplesMode],
  );

  useEffect(() => {
    if (!started) return;
    void loadPage(0);
    return () => {
      requestVersion.current++;
    };
  }, [loadPage, started]);

  const word = words[index];
  const total =
    nextCursor === null ? words.length : Math.max(deck.wordCount, words.length);
  const isLast = index === words.length - 1 && nextCursor === null;
  useEffect(() => {
    if (settingsOpen) setupHeading.current?.focus({ preventScroll: true });
    else if (!loading) card.current?.focus({ preventScroll: true });
  }, [word?.id, loading, settingsOpen]);

  function previous() {
    if (busy.current || index === 0) return;
    setIndex((value) => Math.max(0, value - 1));
    setRevealed(false);
  }
  function next() {
    if (busy.current || !word || completed || error) return;
    setRevealed(false);
    if (index + 1 < words.length) {
      setIndex((value) => Math.min(value + 1, words.length - 1));
    } else if (nextCursor !== null) {
      void loadPage(nextCursor, true);
    } else {
      setCompleted(true);
    }
  }

  useStudyArrows(started && !detailWord && !settingsOpen && !completed && !loading && !error, previous, next);

  return (
    <div
      className={`study-page${!settingsOpen && !loading && !error && !completed && word ? " study-session" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if(detailWord){setDetailWord(null);return;}
          if (settingsOpen && started) setSettingsOpen(false);
          else onClose();
          return;
        }

      }}
    >
      <a className="skip-link" href="#study-main">
        カードに移動
      </a>
      <header className="study-header">
        <button className="text-button study-back" onClick={onClose}>
          <ArrowLeft size={18} />
          単語一覧に戻る
        </button>
        <div>
          
          <h1 id="study-title">{deck.title}</h1>
        </div>
      </header>
      <main
        id="study-main"
        className="study-content"
        aria-labelledby="study-title"
      >
        {storageNote && <p role="status" className="study-storage-note">{storageNote}</p>}
        {settingsOpen ? (
          <section className="study-setup" aria-labelledby="study-setup-title">
            <h2 id="study-setup-title" ref={setupHeading} tabIndex={-1}>学習をはじめる前に</h2>
            <p>{examplesMode ? "英文と日本語訳を1枚ずつめくって練習します。日本語訳のある例文が対象です。" : "出題順とカードの向きを選んでください。"}</p>
            <div className="study-settings" role="group" aria-label="カードの設定">
              <label>出題順
                <select aria-label="出題順" value={draft.order} onChange={e => setDraft({...draft, order:e.target.value as typeof order})}>
                  <option value="ordered">順番どおり</option><option value="shuffle">シャッフル</option>
                </select>
              </label>
              <label>カードの向き
                <select aria-label="カードの向き" value={draft.direction} onChange={e => setDraft({...draft, direction:e.target.value as typeof direction})}>
                  <option value="ja-en">日本語 → 英語</option><option value="en-ja">英語 → 日本語</option>
                </select>
              </label>
            </div>
            <label className="study-skip-setup"><input type="checkbox" checked={draft.skipSetup} onChange={e => setDraft({...draft, skipSetup:e.target.checked})} />次回からこの画面を表示しない</label>
            <p className="study-setup-note">設定はこのブラウザに保存されます。ライブラリのプロフィールアイコンから変更できます。チェックを外すと、開始前の画面が再び表示されます。</p>
            <div className="study-setup-actions">
              <button className="button primary" onClick={applySettings}>学習をはじめる<ArrowRight size={17} /></button>
            </div>
          </section>
        ) : loading ? (
          <div className="study-message" role="status">
            <p>{order === "shuffle" ? "カードをシャッフルしています…" : "カードを準備しています…"}</p>
          </div>
        ) : error ? (
          <div className="study-message">
            <p role="alert">{error}</p>
            <button
              className="button secondary"
              onClick={() => void loadPage(0)}
            >
              最初から読み直す
            </button>
          </div>
        ) : completed ? (
          <div className="study-complete">
            <span className="study-complete-mark">
              <Check size={30} />
            </span>
            
            <h3>最後までめくりました。</h3>
            <p>{words.length}{examplesMode ? "例文" : "語"}の学習、おつかれさまでした。</p>
            <div className="study-complete-actions">
              <button
                className="button primary"
                autoFocus
                onClick={() => void loadPage(0)}
              >
                <RotateCcw size={17} />
                もう一度はじめる
              </button>
              <button className="button secondary" onClick={onClose}>
                一覧に戻る
              </button>
            </div>
          </div>
        ) : !word ? (
          <div className="study-message"><h2>日本語訳付きの例文がありません</h2><p>マイライブラリの「例文を追加・編集」から、例文と日本語訳を登録してください。</p><button className="button secondary" onClick={onClose}>単語一覧に戻る</button></div>
        ) : (
          word && (
            <>
              <div className="study-progress-label">
                <span className="study-mode-audio">{examplesMode ? "例文で学習" : "カードで学習"}{!demo&&<WordAudioButton deckId={deck.id} wordId={word.id} word={examplesMode?word.sentence!.text:word.word} exampleIndex={examplesMode?Number(word.id.split(':example:')[1]):undefined} isPublic={deck.visibility==='public'} />}</span>
                <span role="status">
                  <strong>{index + 1}</strong> / {total} {examplesMode ? "例文" : "語"}
                </span>
              </div>
              <progress
                className="study-progress"
                value={index + 1}
                max={total}
                aria-label="カードの位置"
              />
              <div
                ref={card}
                role="button"
                tabIndex={0}
                onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();setRevealed(value=>!value);}}}
                className={`study-card ${revealed ? "is-revealed" : ""}`}
                aria-pressed={revealed}
                aria-describedby="study-keyboard-hint"
                onClick={() => setRevealed((value) => !value)}
              >
                <span className="study-card-rotor" key={word.id}>
                  {[false,true].map(faceRevealed => (
                <span
                  className={`study-card-face ${faceRevealed ? "study-card-back" : "study-card-front"}`}
                  aria-hidden={revealed !== faceRevealed}
                  inert={revealed !== faceRevealed}
                  key={String(faceRevealed)}
                >
                  <span className="eyebrow">
                    {(direction === "ja-en") !== faceRevealed ? "日本語" : "ENGLISH"}
                  </span>
                  <span className="study-card-scroll">
                    <span className="study-card-body">
                      {examplesMode && word.sentence ? (
                        <span className="study-sentence" lang={(direction === "ja-en") !== faceRevealed ? "ja" : "en"}>{(direction === "ja-en") !== faceRevealed ? word.sentence.translation : exampleWordParts(word.sentence.text,word.word).map((part,i)=>part.match?<button type="button" key={i} className="study-target-word" aria-label={`${word.word}の詳細を開く`} onClick={event=>{event.stopPropagation();setDetailWord({...word,id:word.id.split(':example:')[0]});}}>{part.text}</button>:part.text)}</span>
                      ) : faceRevealed ? (
                        <>
                          {direction === "ja-en" ? (
                            <span className="study-word" lang="en">{word.word}</span>
                          ) : <>
                            <span className="study-answer-word" lang="en">{word.word}</span>
                            <span className="study-meaning" lang="ja">{word.meaning}</span>
                          </>}
                          {wordExamples(word).map((example,i)=><span className="study-example" key={i}>
                            <span className="eyebrow">例文{wordExamples(word).length>1?` ${i+1}`:''}</span>
                            <span lang="en">{example.text}</span>
                          </span>)}
                        </>
                      ) : (
                        <span className={direction === "ja-en" ? "study-meaning study-question-ja" : "study-word"} lang={direction === "ja-en" ? "ja" : "en"}>
                          {direction === "ja-en" ? word.meaning : word.word}
                        </span>
                      )}
                      {!examplesMode && ((faceRevealed && direction === "en-ja") || (!faceRevealed && deck.standard)) && word.tags.length > 0 && (
                        <span className="study-tags">
                          {word.tags.map((tag) => (
                            <span className="tag" key={tag}>
                              {tag}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="study-flip-hint">
                    <RotateCw size={16} />
                    {faceRevealed
                      ? (direction === "ja-en" ? "タップして日本語に戻す" : "タップして英語に戻す")
                      : (direction === "ja-en" ? "タップして英語を見る" : "タップして日本語を見る")}
                  </span>
                </span>
                  ))}
                </span>
              </div>
              <div className="study-navigation">
                <button
                  className="button secondary"
                  disabled={index === 0}
                  onClick={previous}
                >
                  <ArrowLeft size={18} />
                  {examplesMode ? "前の例文" : "前の単語"}
                </button>
                <button className="button primary" onClick={next}>
                  {isLast ? "学習を終える" : examplesMode ? "次の例文" : "次の単語"}
                  <ArrowRight size={18} />
                </button>
              </div>
              <p id="study-keyboard-hint" className="study-keyboard-hint">
                ← → で移動 · カード上で Enter / Space でめくる
              </p>
            </>
          )
        )}
      </main>
      {detailWord&&<dialog ref={detailDialog} className="study-word-dialog" aria-labelledby="study-word-detail-title" onCancel={event=>{event.preventDefault();setDetailWord(null);}} onClose={()=>{setDetailWord(null);card.current?.focus({preventScroll:true});}}><div className="dialog-inner"><div className="dialog-header"><h2 id="study-word-detail-title">{detailWord.word}</h2><button type="button" className="text-button" onClick={()=>{detailDialog.current?.close();setDetailWord(null);}}>閉じる</button></div><p className="study-detail-meaning" lang="ja">{detailWord.meaning}</p>{!demo&&<WordAudioButton deckId={deck.id} wordId={detailWord.id} word={detailWord.word} isPublic={deck.visibility==='public'}/>}<WordDetails word={detailWord} deckId={demo?undefined:deck.id} isPublic={deck.visibility==='public'}/></div></dialog>}
    </div>
  );
}

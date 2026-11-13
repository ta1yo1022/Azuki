import {useLearningProgress} from '../lib/learningProgress';
import {RecallButtons,LearningSaveStatus} from './RecallButtons';
import {baseWordId,shuffleLearning,type LearningPosition,type RecallRecord,type ReviewPending,advanceReview,isReviewDue} from '../../shared/learning';
import {languageName} from '../lib/i18n';
import {useI18n,messageText} from '../lib/i18n';

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
 const t=useI18n();
  const examplesMode = mode === "examples";
  const progress=useLearningProgress(deck.id,demo);
  const [weakOnly,setWeakOnly]=useState(false);
  const [reviewOnly,setReviewOnly]=useState(false);
  const [reviewState,setReviewState]=useState<{pending:ReviewPending[];activeId:string}>({pending:[],activeId:''});
  const [seed,setSeed]=useState(()=>Math.floor(Math.random()*4294967296));
  const [progressBoot,setProgressBoot]=useState(false);
  const restoredScope=useRef('');
  const resume=useRef<LearningPosition|undefined>(undefined);
  const [resumed,setResumed]=useState(false);
  const [preferences] = useState(() => { const saved = readStudyPreferences(); return {...saved, direction: examplesMode ? saved.exampleDirection ?? "en-ja" as const : saved.direction}; });
  const [order, setOrder] = useState(preferences.order);
  const [direction, setDirection] = useState(preferences.direction);
  useEffect(()=>{
    if(!progress.ready){setProgressBoot(false);return;}
    if(restoredScope.current===progress.scope)return;
    restoredScope.current=progress.scope;
    const saved=progress.position(mode);
    if(saved&&saved.order===preferences.order){resume.current=saved;setWeakOnly(saved.weakOnly);setReviewOnly(saved.reviewOnly??false);setSeed(saved.seed);}
    else {resume.current=undefined;setWeakOnly(false);setReviewOnly(false);setSeed(Math.floor(Math.random()*4294967296));}
    setResumed(false);
    setProgressBoot(true);
  },[progress.ready,progress.scope,mode]);
  const [started, setStarted] = useState(preferences.skipSetup);
  const [settingsOpen, setSettingsOpen] = useState(!preferences.skipSetup);
  const [draft, setDraft] = useState(preferences);
  const [storageNote, setStorageNote] = useState("");
  const setupHeading = useRef<HTMLHeadingElement>(null);
  function applySettings() {
    setStorageNote(saveStudyPreferences(examplesMode ? {...readStudyPreferences(), order:draft.order, skipSetup:draft.skipSetup, exampleDirection:draft.direction} : draft) ? "" : t("このブラウザに設定を保存できませんでした。今回の学習には適用しています。"));
    if(draft.order!==order){resume.current=undefined;setResumed(false);}
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
  const loadedScope=useRef('');
  const busy = useRef(false);
  const [words, setWords] = useState<StudyCard[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRating,setLastRating]=useState<{scope:string;mode:string;wordId:string;word:string;state:'known'|'weak';previous:RecallRecord|undefined;index:number;reviewState:typeof reviewState}|null>(null);
  const recentRating=lastRating?.scope===progress.scope&&lastRating.mode===mode?lastRating:null;
  useStudyTracking(deck,mode,started&&!settingsOpen&&!completed&&!loading&&!error&&words.length>0,demo);

  const loadPage = useCallback(
    async (cursor: number, advanceIndex?:number) => {
      const version = ++requestVersion.current;
      loadedScope.current='';
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
        if (order === "shuffle" || examplesMode || weakOnly || reviewOnly || !!resume.current&&(resume.current.ordinal>=50||!!resume.current.reviewSession)) {
          // Load the whole book for global shuffling or to collect translated sentences.
          const all: StudyCard[] = [];
          const seen = new Set<string>();
          let pageCursor = cursor;
          while (true) {
            if (!page.words.length || page.words.some(w => seen.has(w.id)) ||
                (page.nextCursor !== null && page.nextCursor <= pageCursor)) {
              throw new Error(messageText("単語を読み込めませんでした。単語帳を開き直してください。"));
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
          const selected=reviewOnly?all.filter(item=>isReviewDue(progress.records.get(baseWordId(item.id)),Date.now())):weakOnly?all.filter(item=>progress.ratings.get(baseWordId(item.id))==='weak'):all;
          page = { words: order==='shuffle'?shuffleLearning(selected,seed):selected, nextCursor: null };
        }
        if (version !== requestVersion.current) return;
        if (
          (!page.words.length && !examplesMode && !weakOnly && !reviewOnly) ||
          (page.nextCursor !== null && page.nextCursor <= cursor)
        ) {
          throw new Error(
            messageText("単語を読み込めませんでした。単語帳を開き直してください。"),
          );
        }
        loadedScope.current=progress.scope;
        setWords((previous) =>
          cursor === 0 ? page.words : [...previous, ...page.words],
        );
        if(cursor===0){
          const saved=resume.current;
          const target=saved?page.words.findIndex(item=>item.id===saved.wordId):-1;
          const session=saved?.reviewSession;
          if(session){
            const cursorIndex=session.cursorId?page.words.findIndex(item=>item.id===session.cursorId):page.words.findIndex(item=>item.ordinal===session.cursorOrdinal);
            setIndex(cursorIndex>=0?cursorIndex:page.words.length);
            setReviewState({pending:session.pending.filter(p=>page.words.some(w=>w.id===p.wordId)&&progress.ratings.get(baseWordId(p.wordId))==='weak'),activeId:page.words.some(w=>w.id===session.activeId)?session.activeId:''});
          }else{setIndex(target>=0?target:0);setReviewState({pending:[],activeId:''});}
          setCompleted(!!saved?.completed&&target>=0);setResumed(target>=0);resume.current=undefined;
        }
        setNextCursor(page.nextCursor);
        if (advanceIndex!==undefined) setIndex(advanceIndex);
      } catch (cause) {
        if (version !== requestVersion.current) return;
        // Discard cached cards too, including when a public deck becomes private.
        setWords([]);
        setNextCursor(null);
        setIndex(0);
        setError(
          cause instanceof Error
            ? cause.message
            : messageText("単語を読み込めませんでした。"),
        );
      } finally {
        if (version === requestVersion.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [deck.id, reader, order, examplesMode, weakOnly,reviewOnly, seed,progress.scope],
  );

  useEffect(() => {
    if (!started||!progressBoot||!progress.ready) return;
    void loadPage(0);
    return () => {
      requestVersion.current++;
    };
  }, [loadPage, started,progressBoot,progress.ready]);

  const word = reviewState.activeId?words.find(w=>w.id===reviewState.activeId):words[Math.min(index,words.length-1)];
  const total =
    nextCursor === null ? words.length : Math.max(deck.wordCount, words.length);
  const isLast = !reviewState.activeId&&index >= words.length - 1 && nextCursor === null;
  useEffect(()=>{
    if(!progressBoot||!progress.ready||loadedScope.current!==progress.scope||!word||loading||settingsOpen||!started||error)return;
    progress.savePosition({mode,wordId:word.id,ordinal:word.ordinal,page:0,order,seed,weakOnly,reviewOnly,completed,...(reviewState.pending.length||reviewState.activeId?{reviewSession:{...reviewState,cursorId:words[index]?.id??'',cursorOrdinal:words[index]?.ordinal??nextCursor??deck.wordCount}}:{})});
  },[progressBoot,progress.ready,word?.id,loading,settingsOpen,started,error,completed,mode,order,seed,weakOnly,reviewOnly,reviewState,index,progress.savePosition]);
  function restart(){setLastRating(null);resume.current=undefined;setResumed(false);if(order==='shuffle')setSeed(Math.floor(Math.random()*4294967296));else void loadPage(0);}
  function changeFilter(value:boolean){setLastRating(null);resume.current=undefined;setResumed(false);setReviewOnly(false);setWeakOnly(value);}
  useEffect(() => {
    if (settingsOpen) setupHeading.current?.focus({ preventScroll: true });
    else if (!loading&&!completed) card.current?.focus({ preventScroll: true });
  }, [word?.id, loading, settingsOpen,completed]);

  function previous() {
    if (busy.current || index === 0&&!reviewState.activeId) return;
    setResumed(false);setReviewState(old=>({...old,activeId:''}));
    setIndex(value=>Math.max(0,value-1));setRevealed(false);
  }
  function advance(state?:'known'|'weak') {
    if(busy.current||!word||completed||error)return;
    const pending=advanceReview(reviewState.pending,word.id,state);
    const nextIndex=reviewState.activeId?index:index+1;
    const primaryAvailable=nextIndex<words.length||nextCursor!==null;
    const due=primaryAvailable?pending.find(item=>item.remaining===0):undefined;
    setResumed(false);setRevealed(false);
    setReviewState({pending:due?pending.filter(item=>item!==due):pending,activeId:due?.wordId??''});
    if(due){setIndex(nextIndex);return;}
    if(nextIndex<words.length)setIndex(nextIndex);
    else if(nextCursor!==null)void loadPage(nextCursor,nextIndex);
    else {setIndex(nextIndex);setCompleted(true);}
  }
  function next(){advance();}
  function continueReview(){
    const [due,...pending]=reviewState.pending;if(!due)return;
    setLastRating(null);setReviewState({pending,activeId:due.wordId});setCompleted(false);setRevealed(false);
  }
  function evaluate(state:'known'|'weak'){
    if(busy.current||!word||!revealed||completed)return;
    setLastRating({scope:progress.scope,mode,wordId:word.id,word:word.word,state,previous:progress.records.get(baseWordId(word.id)),index,reviewState});
    progress.rate(word.id,state);advance(state);
  }
  function undoRating(){
    if(!recentRating||loading||error)return;
    progress.restoreRating(recentRating.wordId,recentRating.previous);
    setIndex(recentRating.index);setReviewState(recentRating.reviewState);setCompleted(false);setRevealed(true);setLastRating(null);
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
      <a className="skip-link" href="#study-main"> {t("カードに移動")} </a>
      <header className="study-header">
        <button className="text-button study-back" onClick={onClose}>
          <ArrowLeft size={18} /> {t("単語一覧に戻る")} </button>
        <div>
          
          <h1 id="study-title">{deck.title}</h1>
        </div>
      </header>
      <main
        id="study-main"
        className="study-content"
        aria-labelledby="study-title"
      >
        <div className="study-review-tools"><label><input type="checkbox" checked={weakOnly} disabled={!progress.ready||loading&&!settingsOpen} onChange={event=>changeFilter(event.target.checked)}/>{t('苦手な単語だけ')}</label>{started&&!settingsOpen&&<button className="text-button" onClick={restart}>{t('最初から学習')}</button>}</div>
        <div className="study-review-due"><label><input type="checkbox" checked={reviewOnly} disabled={!progress.ready||loading&&!settingsOpen} onChange={event=>{resume.current=undefined;setLastRating(null);setResumed(false);setWeakOnly(false);setReviewOnly(event.target.checked);}}/>{t('復習の時期が来た単語だけ')} ({[...progress.records.values()].filter(r=>isReviewDue(r,Date.now())).length})</label><small>{t('復習待ち：{0}語',new Set([...reviewState.pending.map(p=>baseWordId(p.wordId)),...(reviewState.activeId?[baseWordId(reviewState.activeId)]:[])]).size)}</small></div>
        <LearningSaveStatus progress={progress}/>
        {started&&!settingsOpen&&<div className="recall-feedback-slot">
          {recentRating&&<div className={`recall-feedback recall-feedback-${recentRating.state}`}>
            <span role="status" aria-atomic="true">{recentRating.state==='known'?<Check size={18} aria-hidden="true"/>:<RotateCcw size={18} aria-hidden="true"/>}{t(recentRating.state==='known'?'「{0}」を覚えたとして記録しました':'「{0}」を苦手として記録しました',recentRating.word)}</span>
            <button type="button" className="text-button" disabled={loading||!!error} onClick={undoRating}>{t('取り消す')}</button>
          </div>}
        </div>}
        {resumed&&<p className="learning-resumed" role="status">{t('前回の続きから再開しました')}</p>}
        {storageNote && <p role="status" className="study-storage-note">{storageNote}</p>}
        {settingsOpen ? (
          <section className="study-setup" aria-labelledby="study-setup-title">
            <h2 id="study-setup-title" ref={setupHeading} tabIndex={-1}>{t("学習をはじめる前に")}</h2>
            <p>{examplesMode ? t("例文と訳を1枚ずつめくって練習します。訳のある例文が対象です。") : t("出題順とカードの向きを選んでください。")}</p>
            <div className="study-settings" role="group" aria-label={t("カードの設定")}>
              <label>{t("出題順")} <select aria-label={t("出題順")} value={draft.order} onChange={e => setDraft({...draft, order:e.target.value as typeof order})}>
                  <option value="ordered">{t("順番どおり")}</option><option value="shuffle">{t("シャッフル")}</option>
                </select>
              </label>
              <label>{t("カードの向き")} <select aria-label={t("カードの向き")} value={draft.direction} onChange={e => setDraft({...draft, direction:e.target.value as typeof direction})}>
                  <option value="ja-en">{t(languageName(deck.meaningLanguage??'ja'))} → {t(languageName(deck.language??'en'))}</option><option value="en-ja">{t(languageName(deck.language??'en'))} → {t(languageName(deck.meaningLanguage??'ja'))}</option>
                </select>
              </label>
            </div>
            <label className="study-skip-setup"><input type="checkbox" checked={draft.skipSetup} onChange={e => setDraft({...draft, skipSetup:e.target.checked})} />{t("次回からこの画面を表示しない")}</label>
            <p className="study-setup-note">{t("設定はこのブラウザに保存されます。ライブラリのプロフィールアイコンから変更できます。チェックを外すと、開始前の画面が再び表示されます。")}</p>
            <div className="study-setup-actions">
              <button className="button primary" onClick={applySettings}>{t("学習をはじめる")}<ArrowRight size={17} /></button>
            </div>
          </section>
        ) : loading || !progressBoot || !progress.ready ? (
          <div className="study-message" role="status">
            <p>{order === "shuffle" ? t("カードをシャッフルしています…") : t("カードを準備しています…")}</p>
          </div>
        ) : error ? (
          <div className="study-message">
            <p role="alert">{t(error)}</p>
            <button
              className="button secondary"
              onClick={restart}
            > {t("最初から読み直す")} </button>
          </div>
        ) : completed ? (
          <div className="study-complete">
            <span className="study-complete-mark">
              <Check size={30} />
            </span>
            
            <h3>{t(reviewState.pending.length?"ひと通り学習しました。":"最後までめくりました。")}</h3>
            <p>{words.length}{examplesMode ? t("例文") : t("語")}{t("の学習、おつかれさまでした。")}</p>
            {reviewState.pending.length>0&&<><p>{t('苦手な単語が{0}語、復習を待っています。',reviewState.pending.length)}</p><button className="button primary" onClick={continueReview}>{t('復習を続ける')}</button><button className="text-button" onClick={onClose}>{t('今日はここまで')}</button></>}
            <div className="study-complete-actions">
              <button
                className="button primary"
                autoFocus
                onClick={restart}
              >
                <RotateCcw size={17} /> {t("もう一度はじめる")} </button>
              <button className="button secondary" onClick={onClose}> {t("一覧に戻る")} </button>
            </div>
          </div>
        ) : !words.length&&reviewOnly ? <section className="study-message"><h2>{t('今の復習はありません')}</h2><p>{t('復習時期が来た単語がここに集まります。')}</p><button className="button secondary" onClick={()=>{resume.current=undefined;setReviewOnly(false);}}>{t('すべての単語で学習')}</button></section> : !words.length&&weakOnly ? <section className="study-message"><h2>{t('苦手な単語はありません')}</h2><p>{t('「まだ苦手」にした単語がここに集まります。')}</p><button className="button secondary" onClick={()=>changeFilter(false)}>{t('すべての単語で学習')}</button></section> : !word ? (
          <div className="study-message"><h2>{t("訳付きの例文がありません")}</h2><p>{t("マイライブラリの「例文を追加・編集」から、例文と訳を登録してください。")}</p><button className="button secondary" onClick={onClose}>{t("単語一覧に戻る")}</button></div>
        ) : (
          word && (
            <>
              <div className="study-progress-label">
                <span className="study-mode-audio">{examplesMode ? t("例文で学習") : t("カードで学習")}{reviewState.activeId&&<span className="review-active-label">{t('復習')}</span>}{!demo&&<WordAudioButton deckId={deck.id} wordId={word.id} word={examplesMode?word.sentence!.text:word.word} exampleIndex={examplesMode?Number(word.id.split(':example:')[1]):undefined} isPublic={deck.visibility==='public'} />}</span>
                <span role="status">
                  <strong>{Math.min(index + 1,total)}</strong> / {total} {examplesMode ? t("例文") : t("語")}
                </span>
              </div>
              <progress
                className="study-progress"
                value={Math.min(index + 1,total)}
                max={total}
                aria-label={t("カードの位置")}
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
                    {(direction === "ja-en") !== faceRevealed ? t(languageName(deck.meaningLanguage??'ja')) : t(languageName(deck.language??'en'))}
                  </span>
                  <span className="study-card-scroll">
                    <span className="study-card-body">
                      {examplesMode && word.sentence ? (
                        <span className="study-sentence" lang={(direction === "ja-en") !== faceRevealed ? (deck.meaningLanguage??'ja') : (deck.language??'en')}>{(direction === "ja-en") !== faceRevealed ? word.sentence.translation : exampleWordParts(word.sentence.text,word.word).map((part,i)=>part.match?<button type="button" key={i} className="study-target-word" aria-label={t("{0}の詳細を開く", word.word)} onClick={event=>{event.stopPropagation();setDetailWord({...word,id:word.id.split(':example:')[0]});}}>{part.text}</button>:part.text)}</span>
                      ) : faceRevealed ? (
                        <>
                          {direction === "ja-en" ? (
                            <span className="study-word" lang={deck.language??'en'}>{word.word}</span>
                          ) : <>
                            <span className="study-answer-word" lang={deck.language??'en'}>{word.word}</span>
                            <span className="study-meaning" lang={deck.meaningLanguage??'ja'}>{word.meaning}</span>
                          </>}
                          {wordExamples(word).map((example,i)=><span className="study-example" key={i}>
                            <span className="eyebrow">{t("例文")}{wordExamples(word).length>1?` ${i+1}`:''}</span>
                            <span lang={deck.language??'en'}>{example.text}</span>
                          </span>)}
                        </>
                      ) : (
                        <span className={direction === "ja-en" ? "study-meaning study-question-ja" : "study-word"} lang={direction === "ja-en" ? (deck.meaningLanguage??'ja') : (deck.language??'en')}>
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
                      ? (direction === "ja-en" ? t("タップして{0}に戻す", t(languageName(deck.meaningLanguage??'ja'))) : t("タップして{0}に戻す", t(languageName(deck.language??'en'))))
                      : (direction === "ja-en" ? t("タップして{0}を見る", t(languageName(deck.language??'en'))) : t("タップして{0}を見る", t(languageName(deck.meaningLanguage??'ja'))))}
                  </span>
                </span>
                  ))}
                </span>
              </div>
              <RecallButtons wordId={word.id} progress={progress} answerVisible={revealed} onReveal={()=>setRevealed(true)} onEvaluate={evaluate} onClear={()=>setReviewState(old=>({...old,pending:old.pending.filter(p=>baseWordId(p.wordId)!==baseWordId(word.id))}))}/>
              <div className="study-navigation">
                <button
                  className="button secondary"
                  disabled={index === 0&&!reviewState.activeId}
                  onClick={previous}
                >
                  <ArrowLeft size={18} />
                  {examplesMode ? t("前の例文") : t("前の単語")}
                </button>
                <button className="button primary" onClick={next}>
                  {isLast ? t("学習を終える") : examplesMode ? t("次の例文") : t("次の単語")}
                  <ArrowRight size={18} />
                </button>
              </div>
              <p id="study-keyboard-hint" className="study-keyboard-hint"> {t("← → で移動 · カード上で Enter / Space でめくる")} </p>
            </>
          )
        )}
      </main>
      {detailWord&&<dialog ref={detailDialog} className="study-word-dialog" aria-labelledby="study-word-detail-title" onClick={event=>{if(event.target!==event.currentTarget)return;const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom){event.currentTarget.close();setDetailWord(null);}}} onCancel={event=>{event.preventDefault();setDetailWord(null);}} onClose={()=>{setDetailWord(null);card.current?.focus({preventScroll:true});}}><div className="dialog-inner"><div className="dialog-header"><h2 id="study-word-detail-title">{detailWord.word}</h2><button type="button" className="text-button" onClick={()=>{detailDialog.current?.close();setDetailWord(null);}}>{t("閉じる")}</button></div>{detailWord.otherMeanings===undefined&&<p className="study-detail-meaning" lang={deck.meaningLanguage??'ja'}>{detailWord.meaning}</p>}{!demo&&<WordAudioButton deckId={deck.id} wordId={detailWord.id} word={detailWord.word} isPublic={deck.visibility==='public'}/>}<WordDetails language={deck.language} meaningLanguage={deck.meaningLanguage} word={detailWord} deckId={demo?undefined:deck.id} isPublic={deck.visibility==='public'}/></div></dialog>}
    </div>
  );
}

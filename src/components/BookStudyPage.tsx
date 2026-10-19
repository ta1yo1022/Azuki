import { useStudyTracking } from "../lib/studyTracking";
import { WordExamples } from './WordExamples';
import { useLayoutEffect, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpenText } from 'lucide-react';
import type { Deck, Word, WordPage } from '../../shared/model';

import {BookCover} from './BookCover';
import {BookPageCurl, bookLeafSnapshot} from '../lib/bookPageCurl';

const PAGE_SIZE = 4;
export function BookStudyPage({deck, reader, onClose, demo=false}: {
  deck: Deck;
  demo?: boolean;
  reader: {words: (id: string, query: string, cursor: number, signal?: AbortSignal) => Promise<WordPage>};
  onClose: () => void;
}) {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px)');
    const update = () => setWide(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const visiblePages = wide ? 2 : 1;
  const [params, setParams] = useSearchParams();
  const total = Math.max(1, Math.ceil(deck.wordCount / PAGE_SIZE));
  const requested = Number(params.get('bookPage') ?? 0);
  const page = Number.isSafeInteger(requested) ? Math.min(total, Math.max(0, requested)) : 0;
  const isCover=page===0;
  const nextPage=isCover?1:page+visiblePages;
  const previousPage=Math.max(0,page-visiblePages);
  const coverSource=useRef<HTMLDivElement>(null);
  function coverSnapshot() {
    const leaf=document.createElement('section');leaf.className='book-leaf book-cover-leaf';
    const content=coverSource.current?.firstElementChild?.cloneNode(true);
    if(content)leaf.appendChild(content);
    return leaf;
  }
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useStudyTracking(deck,"book",!isCover&&!loading&&!error&&words.length>0,demo);
  const [hideMeanings, setHideMeanings] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [controlsVisible, setControlsVisible] = useState(true);
  const pageCache = useRef(new Map<number, Word[]>());
  const curl = useRef<BookPageCurl | null>(null);
  const flipLocked = useRef(false);
  const prefetch = useRef<AbortController | null>(null);
  const hideRef = useRef(hideMeanings);
  hideRef.current=hideMeanings;
  useEffect(() => {
    pageCache.current.clear();
    return () => {prefetch.current?.abort();curl.current?.destroy();};
  }, [deck.id]);
  useLayoutEffect(() => {
    curl.current?.destroy();curl.current=null;flipLocked.current=false;
  }, [page, wide]);
  useEffect(() => {
    const cancel=()=>{curl.current?.destroy();curl.current=null;flipLocked.current=false;};
    window.addEventListener('resize',cancel);
    return ()=>{cancel();window.removeEventListener('resize',cancel);};
  }, []);
  function cacheWords(first:number, values:Word[]) {
    for(let offset=0;offset<values.length;offset+=PAGE_SIZE) {
      const number=first+offset/PAGE_SIZE;
      if(values.slice(offset,offset+PAGE_SIZE).length===PAGE_SIZE || number===total)
        pageCache.current.set(number,values.slice(offset,offset+PAGE_SIZE));
    }
  }
  function preparePrevious() {
    const first=Math.max(1,page-visiblePages);
    if(page<=1 || pageCache.current.has(first) || prefetch.current)return;
    const controller=new AbortController();prefetch.current=controller;
    void reader.words(deck.id,'',(first-1)*PAGE_SIZE,controller.signal).then(result=>{
      if(!controller.signal.aborted)cacheWords(first,result.words);
    }).catch(()=>{/* The visible page keeps its normal error/retry handling. */})
      .finally(()=>{if(prefetch.current===controller)prefetch.current=null;});
  }
  useEffect(() => {
    if(loading || error)return;
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)preparePrevious();
    const next=nextPage;
    if(next>total || pageCache.current.has(next))return;
    const controller=new AbortController();
    void reader.words(deck.id,'',(next-1)*PAGE_SIZE,controller.signal).then(result=>{
      if(!controller.signal.aborted)cacheWords(next,result.words);
    }).catch(()=>{});
    return ()=>controller.abort();
  },[deck.id,reader,page,visiblePages,total,loading,error]);
  function dragPage(dx:number,dy=0,startY=0) {
    if(loading || error || flipLocked.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const direction=dx<0?1:-1;
    const next=direction===1?nextPage:previousPage;
    if(next===page || next>total)return;
    if(!curl.current) {
      const spread=spreadRef.current;
      if(!spread || !spread.clientWidth || !pageCache.current.has(Math.max(1,next)))return;
      const current=Array.from(spread.querySelectorAll<HTMLElement>(':scope > .book-leaf'));
      const first=isCover?1-visiblePages*2:page-visiblePages;
      const sources=Array.from({length:visiblePages*3},(_,index)=>{
        const number=first+index;
        if(number===0)return coverSnapshot();
        if(number===-1 && wide) {
          const leaf=document.createElement('section');leaf.className='book-leaf book-cover-endpaper';
          const label=document.createElement('span');label.appendChild(document.createTextNode('一枚ずつ、'));label.appendChild(document.createElement('br'));label.appendChild(document.createTextNode('自分のペースで。'));leaf.appendChild(label);
          return leaf;
        }
        if(number<0)return bookLeafSnapshot([],0,false);
        return (!isCover && current[number-page]) || bookLeafSnapshot(pageCache.current.get(number)||[],number<=total?number:0,hideRef.current);
      });
      curl.current=new BookPageCurl(spread,sources,wide,direction,startY-spread.getBoundingClientRect().top,turned=>{
        // Keep the finished paper visible until React commits the new page.
        if(turned)turn(next,false);
        else {curl.current=null;flipLocked.current=false;}
      });
    }
    curl.current.move(dx,dy);
  }
  function finishPage(dx:number,commit:boolean) {
    if(flipLocked.current)return;
    const next=dx<0?nextPage:previousPage;
    const allowed=!loading && !error && next!==page && next<=total;
    if(curl.current) {
      flipLocked.current=true;curl.current.finish(commit && allowed && curl.current.direction===(dx<0?1:-1));
    } else if(commit && allowed)turn(next,false);
  }
  const gesture = useRef<{id:number; x:number; y:number; time:number} | null>(null);
  const suppressTap = useRef(false);
  const interactive = (target: EventTarget) => target instanceof Element && !!target.closest('button, a, input, label, select, textarea');
  function pointerDown(event: PointerEvent<HTMLElement>) {
    suppressTap.current = false;
    if (event.pointerType === 'touch' || flipLocked.current) return;
    if (event.isPrimary === false || (interactive(event.target) && !(event.target instanceof Element && event.target.closest('[data-book-answer]')))) { gesture.current = null; return; }

    preparePrevious();
    gesture.current = {id:event.pointerId,x:event.clientX,y:event.clientY,time:Date.now()};
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX-start.x, dy = event.clientY-start.y;
    if (Math.hypot(dx,dy)>10) suppressTap.current = true;
    if (Math.abs(dx)>10 && Math.abs(dx)>Math.abs(dy)*1.5) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragPage(dx,dy,start.y);
    }
  }
  function pointerUp(event: PointerEvent<HTMLElement>) {
    const start = gesture.current; gesture.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX-start.x, dy = event.clientY-start.y;
    if (Math.hypot(dx,dy)>10) suppressTap.current = true;
    if (Math.hypot(dx,dy)>10) finishPage(dx, Math.abs(dx)>=40 && Math.abs(dx)>Math.abs(dy)*1.5);
  }
  const spreadRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = spreadRef.current;
    if (!element) return;
    let touch: {id:number; x:number; y:number; axis:'x'|'y'|null} | null = null;
    const start = (event: TouchEvent) => {
      suppressTap.current = false;
      if (flipLocked.current || event.touches.length !== 1 || (interactive(event.target!) && !(event.target instanceof Element && event.target.closest('[data-book-answer]')))) {touch=null;return;}
      preparePrevious();
      const point=event.touches[0]; touch={id:point.identifier,x:point.clientX,y:point.clientY,axis:null};
    };
    const move = (event: TouchEvent) => {
      if (!touch) return;
      if (event.touches.length!==1) {touch=null;finishPage(0,false);return;}
      const point=event.touches[0];
      if(point.identifier!==touch.id) return;
      const dx=point.clientX-touch.x,dy=point.clientY-touch.y;
      if(Math.hypot(dx,dy)>10) suppressTap.current=true;
      if(!touch.axis && Math.max(Math.abs(dx),Math.abs(dy))>10) touch.axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
      // Keep vertical reading/scrolling native; claim only a horizontal page gesture.
      if(touch.axis==='x') {if(event.cancelable) event.preventDefault();dragPage(dx,dy,touch.y);}
    };
    const end = (event: TouchEvent) => {
      const initial=touch;touch=null;
      if(!initial || loading) return;
      const point=Array.from(event.changedTouches).find(p=>p.identifier===initial.id);
      if(!point) return;
      const dx=point.clientX-initial.x,dy=point.clientY-initial.y;
      if(Math.hypot(dx,dy)>10) suppressTap.current=true;
      if(initial.axis==='y' || Math.hypot(dx,dy)<=10) return;
      if(event.cancelable) event.preventDefault();
      finishPage(dx,Math.abs(dx)>=40 && Math.abs(dx)>=Math.abs(dy)*1.2);
    };
    const cancel=()=>{touch=null;suppressTap.current=true;finishPage(0,false);};
    element.addEventListener('touchstart',start,{passive:true});
    element.addEventListener('touchmove',move,{passive:false});
    element.addEventListener('touchend',end,{passive:false});
    element.addEventListener('touchcancel',cancel);
    return ()=>{element.removeEventListener('touchstart',start);element.removeEventListener('touchmove',move);element.removeEventListener('touchend',end);element.removeEventListener('touchcancel',cancel);};
  }, [loading,error,page,total,visiblePages,setParams]);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    document.title = `${deck.title} — 単語帳で学習 — Azuki`;
    const controller = new AbortController();
    setError(''); setRevealed(new Set());
    const bodyPage=Math.max(1,page);
    const cached=Array.from({length:Math.min(visiblePages,total-bodyPage+1)},(_,i)=>pageCache.current.get(bodyPage+i));
    if(cached.every(Boolean) && retry===0) {setWords(cached.flat() as Word[]);setLoading(false);return ()=>controller.abort();}
    setLoading(true);setWords([]);
    reader.words(deck.id, '', (Math.max(1,page) - 1) * PAGE_SIZE, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (!result.words.length) throw new Error('このページの単語が見つかりません。単語帳を開き直してください。');
      cacheWords(Math.max(1,page),result.words);
      setWords(result.words.slice(0, PAGE_SIZE * visiblePages));
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '単語を読み込めませんでした。'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [deck.id, deck.title, reader, page, retry, visiblePages]);
  function turn(next: number, focusHeading = true) {
    setParams(previous => {const updated = new URLSearchParams(previous); updated.set('bookPage', String(next)); return updated;});
    if (focusHeading) heading.current?.focus();
    window.scrollTo({top: 0, behavior: 'instant'});
  }
  function animateTurn(next:number) {
    if(flipLocked.current)return;
    const dx=next>page?-40:40;
    dragPage(dx,0,(spreadRef.current?.getBoundingClientRect().bottom||0)-2);
    finishPage(dx,true);
  }
  const cachedPages=Array.from({length:Math.min(visiblePages,total-page+1)},(_,i)=>pageCache.current.get(page+i));
  const visibleWords=cachedPages.every(Boolean)?cachedPages.flat() as Word[]:words;
  return <main className={`book-study${wide ? " book-study-wide" : ""}`} onKeyDown={event=>{
    if (interactive(event.target)) return;
    if (event.key === 'Escape') setControlsVisible(true);
    if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element && event.target.classList.contains('book-leaf-content')) {event.preventDefault();setControlsVisible(value=>!value);}
    if (event.key === 'ArrowRight' && !loading && nextPage<=total) {event.preventDefault();animateTurn(nextPage);}
    if (event.key === 'ArrowLeft' && !loading && page>0) {event.preventDefault();animateTurn(previousPage);}
  }}>
    <header className={`book-study-header${controlsVisible ? "" : " is-hidden"}`} inert={!controlsVisible} aria-hidden={!controlsVisible}>
      <button className="back-button" onClick={onClose}><ArrowLeft size={18} />単語一覧に戻る</button>
      <div className="book-study-title"><div><span className="eyebrow"><BookOpenText size={18} /> 単語帳で学習</span><h1 ref={heading} tabIndex={-1}>{deck.title}</h1></div>
        <div className="book-study-tools"><button className="text-button book-controls-toggle" aria-controls="book-pagination" aria-expanded={controlsVisible} onClick={()=>{setControlsVisible(value=>!value);if(controlsVisible)document.querySelector<HTMLElement>(".book-leaf-content")?.focus();}}>{controlsVisible ? '操作を隠す' : '操作を表示'}</button><label className="book-study-toggle"><input type="checkbox" checked={hideMeanings} onChange={e=>{setHideMeanings(e.target.checked);setRevealed(new Set());}} />意味を隠す</label></div>
      </div>
      <p className="book-study-caption">{hideMeanings ? '意味の欄を押すと、1語ずつ答えを確認できます。' : '英単語・意味・例文を、まとめて読めます。タップで操作を隠し、左右のスワイプでページをめくれます。'}</p>
    </header>
    <section ref={spreadRef} className={`book-spread${isCover?" is-cover":""}`} aria-label={isCover?"単語帳の表紙":`${page}ページ目の単語`} aria-busy={loading}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={()=>{gesture.current=null;suppressTap.current=true;finishPage(0,false);}}
      onClick={event=>{if (suppressTap.current) {suppressTap.current=false;return;} if (!interactive(event.target) && !window.getSelection()?.toString()) setControlsVisible(value=>!value);}}>

      {isCover ? <>{wide && <section className="book-leaf book-cover-endpaper" aria-hidden="true"><span>一枚ずつ、<br/>自分のペースで。</span></section>}<section className="book-leaf book-cover-leaf"><BookCover deck={deck}/></section></> : loading ? <p role="status" className="book-study-message">単語を読み込んでいます…</p> : error ? <div className="book-study-message" role="alert"><p>{error}</p><button className="button secondary" onClick={()=>setRetry(n=>n+1)}>もう一度読み込む</button></div> :
        Array.from({length:Math.min(visiblePages,total-page+1)}, (_, leaf) => <section className="book-leaf" key={`${page}-${leaf}`} aria-label={`${page+leaf}ページ`}>
        <div className="book-leaf-content" tabIndex={0} aria-label={`${page+leaf}ページの本文`}><ol className="book-entries" start={(page+leaf-1)*PAGE_SIZE+1}>{visibleWords.slice(leaf*PAGE_SIZE,(leaf+1)*PAGE_SIZE).map(word => {
          const visible = !hideMeanings || revealed.has(word.id);
          return <li className="book-entry" key={word.id}>
            <div className="book-entry-word"><small>{String(word.ordinal+1).padStart(3,'0')}</small><h2 lang="en">{word.word}</h2>{!!word.tags.length && <p>{word.tags.join(' · ')}</p>}</div>
            <div className="book-entry-meaning">
              <div className={`book-meaning-content${visible ? '' : ' is-blurred'}`} aria-hidden={!visible}><p className="book-primary-meaning">{word.meaning}</p>{!!word.otherMeanings?.length && <div className="book-other-meanings"><small>その他の意味</small><ul>{word.otherMeanings.map(meaning=><li key={meaning}>{meaning}</li>)}</ul></div>}{word.usageNote && <p className="book-usage-note">{word.usageNote}</p>}</div>
              {hideMeanings && <button type="button" data-book-answer className="book-meaning-reveal" aria-expanded={visible} aria-label={`${word.word}の意味を${visible ? '隠す' : '表示'}`} onClick={event=>{event.stopPropagation();if(suppressTap.current){suppressTap.current=false;return;}setRevealed(previous=>{const next=new Set(previous);if(next.has(word.id))next.delete(word.id);else next.add(word.id);return next;});}}><span className="sr-only">{visible ? '意味を隠す' : '意味を表示'}</span></button>}
            </div>
            <div className="book-entry-example"><span className="book-mobile-label">例文</span><WordExamples word={word} translations={!hideMeanings||revealed.has(word.id)}/></div>
          </li>;
        })}</ol></div><div className="book-page-number">{page+leaf}</div></section>)}
    </section>
    {isCover && error && <div role="alert" className="book-cover-error"><p>{error}</p><button className="button secondary" onClick={()=>setRetry(n=>n+1)}>もう一度読み込む</button></div>}
    <div hidden ref={coverSource} aria-hidden="true"><BookCover deck={deck}/></div>
    <nav id="book-pagination" className={`book-pagination${controlsVisible ? "" : " is-hidden"}`} inert={!controlsVisible} aria-hidden={!controlsVisible} aria-label="単語帳のページ移動"><button className="button secondary" disabled={isCover || loading} onClick={()=>animateTurn(previousPage)}><ArrowLeft size={18} />{previousPage===0?"表紙に戻る":"前のページ"}</button><span aria-live="polite">{isCover?"表紙":<>{page}{wide && page<total ? `–${page+1}` : ""} / {total} ページ</>}</span><button className="button primary" disabled={nextPage>total || loading} onClick={()=>animateTurn(nextPage)}>{isCover?"本を開く":"次のページ"}<ArrowRight size={18} /></button></nav>
  </main>;
}

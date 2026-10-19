// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {BookStudyPage} from '../src/components/BookStudyPage';
import {BookPageCurl} from '../src/lib/bookPageCurl';
import type {Deck,Word} from '../shared/model';
let container:HTMLDivElement,root:Root;
beforeEach(()=>{vi.spyOn(window,'matchMedia').mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()} as unknown as MediaQueryList);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(window,'scrollTo').mockImplementation(()=>{});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const deck:Deck={id:'source',schemaVersion:1,title:'単語帳',description:'',textbookTags:[],visibility:'public',wordCount:65,createdAt:'',updatedAt:''};
const words:Word[]=Array.from({length:65},(_,i)=>({id:`w${i}`,ordinal:i,word:`word-${i}`,meaning:`意味${i}`,otherMeanings:[`別の意味${i}`],example:`Example ${i}.`,examples:[{text:`Example ${i}.`,translation:`例文の訳${i}`}],tags:['名詞']}));
function Location(){return <output>{useLocation().search}</output>;}
const button=(text:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent?.includes(text))!;
it('opens a deep-linked page beyond the API first 50 and supports last-page and back navigation',async()=>{
 const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:null}))};
 await act(async()=>root.render(<MemoryRouter initialEntries={['/book?bookPage=15&q=keep']}><BookStudyPage deck={deck} reader={reader} onClose={()=>{}}/><Location/></MemoryRouter>));
 expect(reader.words).toHaveBeenLastCalledWith('source','',56,expect.any(AbortSignal));
 expect(container.querySelectorAll('.book-entry')).toHaveLength(8);
 expect(container.querySelector('.book-entry-word h2')?.textContent).toBe('word-56');
 await act(async()=>button('次のページ').click());
 expect(container.querySelector('output')?.textContent).toContain('bookPage=17');
 expect(container.querySelector('output')?.textContent).toContain('q=keep');
 expect(container.querySelectorAll('.book-entry')).toHaveLength(1);
 expect(button('次のページ').disabled).toBe(true);
 await act(async()=>button('前のページ').click());
 expect(container.querySelector('.book-entry-word h2')?.textContent).toBe('word-56');
});
it('conceals primary and additional meanings, reveals individually, and resets on page changes',async()=>{
 const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:null}))};
 await act(async()=>root.render(<MemoryRouter initialEntries={["/book?bookPage=1"]}><BookStudyPage deck={deck} reader={reader} onClose={()=>{}}/></MemoryRouter>));
 await act(async()=>container.querySelector<HTMLInputElement>('input')!.click());
 expect(container.querySelectorAll('.book-meaning-content:not(.is-blurred) .book-primary-meaning')).toHaveLength(0);
 expect(container.querySelectorAll('.book-meaning-content:not(.is-blurred) .book-other-meanings')).toHaveLength(0);
 expect(container.querySelector('.book-entry-example')?.textContent).toContain('Example 0.');
 expect(container.querySelector('.word-example-translation')?.textContent).toBe('例文の訳0');
 expect(container.querySelector('.word-example-translation')?.classList.contains('is-blurred')).toBe(true);
 await act(async()=>button('意味を表示').click());
 expect(container.querySelectorAll('.book-meaning-content:not(.is-blurred) .book-primary-meaning')).toHaveLength(1);
 expect(container.querySelector('.book-other-meanings')?.textContent).toContain('別の意味0');
 expect(container.querySelector('.word-example-translation')?.classList.contains('is-blurred')).toBe(false);
 await act(async()=>container.querySelector<HTMLButtonElement>('button[aria-label="word-0の例文1の日本語訳を隠す"]')!.click());
 expect(container.querySelector('.book-meaning-content')?.classList.contains('is-blurred')).toBe(true);
 expect(container.querySelector('.word-example-translation')?.classList.contains('is-blurred')).toBe(true);
 await act(async()=>button('次のページ').click());
 expect(container.querySelectorAll('.book-meaning-content:not(.is-blurred) .book-primary-meaning')).toHaveLength(0);
});
it('lets a failed page be retried without advancing',async()=>{
 const read=vi.fn().mockRejectedValueOnce(Error('通信エラー')).mockResolvedValue({words:words.slice(0,50),nextCursor:50});
 await act(async()=>root.render(<MemoryRouter initialEntries={["/book?bookPage=1"]}><BookStudyPage deck={deck} reader={{words:read}} onClose={()=>{}}/></MemoryRouter>));
 expect(container.querySelector('[role="alert"]')?.textContent).toContain('通信エラー');
 await act(async()=>button('もう一度読み込む').click());
 expect(container.querySelectorAll('.book-entry')).toHaveLength(8);
});

it('shows one four-word page on a phone and advances without skipping words',async()=>{
 vi.mocked(window.matchMedia).mockReturnValue({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()} as unknown as MediaQueryList);
 const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:null}))};
 await act(async()=>root.render(<MemoryRouter initialEntries={["/book?bookPage=1"]}><BookStudyPage deck={deck} reader={reader} onClose={()=>{}}/></MemoryRouter>));
 expect(container.querySelectorAll('.book-leaf')).toHaveLength(1);
 expect(container.querySelectorAll('.book-entry')).toHaveLength(4);
 await act(async()=>button('次のページ').click());
 expect(reader.words).toHaveBeenCalledTimes(1); // Adjacent pages reuse the fetched batch.
 expect(container.querySelector('.book-entry-word h2')?.textContent).toBe('word-4');
});
it('toggles the overlay on a tap and turns pages with horizontal swipes without treating scrolls as swipes',async()=>{
 const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:null}))};
 await act(async()=>root.render(<MemoryRouter initialEntries={["/book?bookPage=1"]}><BookStudyPage deck={deck} reader={reader} onClose={()=>{}}/><Location/></MemoryRouter>));
 const spread=container.querySelector<HTMLElement>('.book-spread')!;
 const nav=container.querySelector('nav')!;
 await act(async()=>spread.click());
 expect(nav.getAttribute('aria-hidden')).toBe('true');
 expect(container.querySelector('header')?.getAttribute('aria-hidden')).toBe('true');
 const swipe=async(x:number,y:number)=>{
  await act(async()=>{
   touchEvent(spread,'touchstart',200,100);
   touchEvent(spread,'touchmove',x,y);
   touchEvent(spread,'touchend',x,y);
   spread.click();
  });
 };
 await swipe(50,110);
 expect(container.querySelector('output')?.textContent).toContain('bookPage=3');
 expect(nav.getAttribute('aria-hidden')).toBe('true');
 expect(container.querySelector('header')?.getAttribute('aria-hidden')).toBe('true');
 await swipe(350,110);
 expect(container.querySelector('output')?.textContent).toContain('bookPage=1');
 await swipe(210,300);
 expect(container.querySelector('output')?.textContent).toContain('bookPage=1');
 expect(nav.getAttribute('aria-hidden')).toBe('true');
 expect(container.querySelector('header')?.getAttribute('aria-hidden')).toBe('true');
 await act(async()=>spread.click());
 expect(nav.getAttribute('aria-hidden')).toBe('false');
 expect(container.querySelector('header')?.getAttribute('aria-hidden')).toBe('false');
});

function touchEvent(target:Element,type:string,x:number,y:number) {
 const point={identifier:1,clientX:x,clientY:y};
 const event=new Event(type,{bubbles:true,cancelable:true});
 Object.defineProperties(event,{touches:{value:type==='touchend'?[]:[point]},changedTouches:{value:[point]}});
 target.dispatchEvent(event); return event;
}
it('can swipe starting on blurred meaning without revealing it or blocking vertical scroll',async()=>{
 const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:null}))};
 await act(async()=>root.render(<MemoryRouter initialEntries={["/book?bookPage=1"]}><BookStudyPage deck={deck} reader={reader} onClose={()=>{}}/><Location/></MemoryRouter>));
 await act(async()=>container.querySelector<HTMLInputElement>('input')!.click());
 expect(container.querySelectorAll('.book-meaning-content.is-blurred')).toHaveLength(8);
 expect(container.querySelector('.book-meaning-content')?.getAttribute('aria-hidden')).toBe('true');
 const answer=container.querySelector<HTMLButtonElement>('.book-meaning-reveal')!;
 await act(async()=>{
  touchEvent(answer,'touchstart',200,100);
  expect(touchEvent(answer,'touchmove',140,102).defaultPrevented).toBe(true);
  touchEvent(answer,'touchend',140,102);
  answer.click();
 });
 expect(container.querySelector('output')?.textContent).toContain('bookPage=3');
 expect(container.querySelectorAll('.book-meaning-content.is-blurred')).toHaveLength(8);
 const next=container.querySelector<HTMLButtonElement>('.book-meaning-reveal')!;
 await act(async()=>{
  touchEvent(next,'touchstart',200,100);
  expect(touchEvent(next,'touchmove',205,180).defaultPrevented).toBe(false);
  touchEvent(next,'touchend',205,180);
  next.click();
 });
 expect(container.querySelector('output')?.textContent).toContain('bookPage=3');
 await act(async()=>{touchEvent(next,'touchstart',200,100);touchEvent(next,'touchend',200,100);next.click();});
 expect(container.querySelectorAll('.book-meaning-content.is-blurred')).toHaveLength(7);
 expect(container.querySelector('.book-meaning-content')?.getAttribute('aria-hidden')).toBe('false');
});

it('renders actual adjacent paper during a swipe and cleans up the animation layer after settling', async()=>{
 vi.mocked(window.matchMedia).mockImplementation(query=>({matches:query.includes('min-width'),addEventListener:vi.fn(),removeEventListener:vi.fn()} as unknown as MediaQueryList));
 for(const key of ['clientWidth','offsetWidth'] as const)vi.spyOn(HTMLElement.prototype,key,'get').mockReturnValue(1000);
 for(const key of ['clientHeight','offsetHeight'] as const)vi.spyOn(HTMLElement.prototype,key,'get').mockReturnValue(700);
 const revealedAtHandoff:string[]=[];
 const destroy=BookPageCurl.prototype.destroy;
 vi.spyOn(BookPageCurl.prototype,'destroy').mockImplementation(function(this:BookPageCurl){
  revealedAtHandoff.push(container.querySelector('.book-spread > .book-leaf .book-entry-word h2')?.textContent||'');
  return destroy.call(this);
 });
 vi.useFakeTimers();
 try {
  const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:null}))};
  await act(async()=>root.render(<MemoryRouter initialEntries={["/book?bookPage=1"]}><BookStudyPage deck={deck} reader={reader} onClose={()=>{}}/><Location/></MemoryRouter>));
  await act(async()=>container.querySelector<HTMLInputElement>('input')!.click());
  const spread=container.querySelector<HTMLElement>('.book-spread')!;
  await act(async()=>{touchEvent(spread,'touchstart',900,600);touchEvent(spread,'touchmove',875,602);});
  expect(spread.querySelector('.book-curl-layer')?.getAttribute('aria-hidden')).toBe('true');
  expect(spread.querySelector('.book-curl-layer')?.textContent).toContain('word-8');
  expect(spread.querySelectorAll('.book-curl-layer .book-meaning-content:not(.is-blurred)')).toHaveLength(0);
  await act(async()=>touchEvent(spread,'touchend',875,602));
  await act(async()=>vi.advanceTimersByTime(1500));
  expect(reader.words).toHaveBeenCalledTimes(1);
  expect(spread.querySelector('.book-curl-layer')).toBeNull();
  expect(container.querySelector('output')?.textContent).not.toContain('bookPage=3');
  await act(async()=>{touchEvent(spread,'touchstart',900,600);touchEvent(spread,'touchmove',550,500);touchEvent(spread,'touchend',550,500);});
  expect(spread.querySelector('.book-curl-layer')).not.toBeNull();
  await act(async()=>vi.advanceTimersByTime(1500));
  expect(container.querySelector('output')?.textContent).toContain('bookPage=3');
  expect(spread.querySelector('.book-curl-layer')).toBeNull();
  expect(container.querySelector('.book-entry-word h2')?.textContent).toBe('word-8');
  expect(revealedAtHandoff.at(-1)).toBe('word-8'); // New text is committed before the overlay is removed.
  expect(vi.getTimerCount()).toBe(0);
 } finally {vi.useRealTimers();}
});

it.each([390,1000])('curls backward on a fast first drag at %ipx, including a directly opened page',async(width)=>{
 const wide=width>=900;
 vi.mocked(window.matchMedia).mockImplementation(query=>({matches:query.includes('min-width') && wide,addEventListener:vi.fn(),removeEventListener:vi.fn()} as unknown as MediaQueryList));
 for(const key of ['clientWidth','offsetWidth'] as const)vi.spyOn(HTMLElement.prototype,key,'get').mockReturnValue(width);
 for(const key of ['clientHeight','offsetHeight'] as const)vi.spyOn(HTMLElement.prototype,key,'get').mockReturnValue(700);
 vi.useFakeTimers();
 try {
  const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:null}))};
  await act(async()=>root.render(<MemoryRouter initialEntries={['/book?bookPage=7']}><BookStudyPage deck={deck} reader={reader} onClose={()=>{}}/><Location/></MemoryRouter>));
  const spread=container.querySelector<HTMLElement>('.book-spread')!;
  await act(async()=>{touchEvent(spread,'touchstart',20,600);touchEvent(spread,'touchmove',width*.8,570);});
  expect(spread.querySelector('.book-curl-layer')).not.toBeNull();
  await act(async()=>touchEvent(spread,'touchend',width*.8,570));
  await act(async()=>vi.advanceTimersByTime(1500));
  expect(container.querySelector('output')?.textContent).toContain(`bookPage=${wide?5:6}`);
  expect(container.querySelector('.book-entry-word h2')?.textContent).toBe(`word-${wide?16:20}`);
  expect(spread.querySelector('.book-curl-layer')).toBeNull();
  await act(async()=>button('前のページ').click());
  expect(spread.querySelector('.book-curl-layer')).not.toBeNull();
  await act(async()=>vi.advanceTimersByTime(1500));
  expect(container.querySelector('output')?.textContent).toContain(`bookPage=${wide?3:5}`);
 } finally {vi.useRealTimers();}
});

it.each([390,1000])('opens with a cover and turns to the first words and back at %ipx',async(width)=>{
 const wide=width>=900;
 vi.mocked(window.matchMedia).mockImplementation(query=>({matches:query.includes('min-width') && wide,addEventListener:vi.fn(),removeEventListener:vi.fn()} as unknown as MediaQueryList));
 for(const key of ['clientWidth','offsetWidth'] as const)vi.spyOn(HTMLElement.prototype,key,'get').mockReturnValue(width);
 for(const key of ['clientHeight','offsetHeight'] as const)vi.spyOn(HTMLElement.prototype,key,'get').mockReturnValue(700);
 vi.useFakeTimers();
 try {
  const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:null}))};
  const coverDeck={...deck,description:'毎日の学習に',textbookTags:[{name:'教材名',edition:'第2版'}],isOfficial:true,cefrLevel:'A1' as const};
  await act(async()=>root.render(<MemoryRouter><BookStudyPage deck={coverDeck} reader={reader} onClose={()=>{}}/><Location/></MemoryRouter>));
  const cover=container.querySelector('.book-spread .book-cover')!;
  expect(cover.textContent).toContain('毎日の学習に');
  expect(cover.textContent).toContain('教材名 / 第2版');
  expect(cover.textContent).toContain('65');
  expect(cover.textContent).toContain('CEFR-J A1');
  expect(container.querySelectorAll('.book-entry')).toHaveLength(0);
  await act(async()=>button('本を開く').click());
  expect(container.querySelector('.book-curl-layer')).not.toBeNull();
  await act(async()=>vi.advanceTimersByTime(1500));
  expect(container.querySelector('output')?.textContent).toContain('bookPage=1');
  expect(container.querySelector('.book-entry-word h2')?.textContent).toBe('word-0');
  expect(container.querySelectorAll('.book-entry')).toHaveLength(wide?8:4);
  await act(async()=>button('表紙に戻る').click());
  await act(async()=>vi.advanceTimersByTime(1500));
  expect(container.querySelector('output')?.textContent).toContain('bookPage=0');
  expect(container.querySelector('.book-spread .book-cover')).not.toBeNull();
  expect(container.querySelectorAll('.book-entry')).toHaveLength(0);
 } finally {vi.useRealTimers();}
});

it('shows all examples and translations, and hides translations along with meanings',async()=>{
 const first={...words[0],examples:[{text:'The captain refused.',translation:'船長は拒否した。'},{text:'The mage refused.',translation:'魔法使いは拒否した。'}]};
 await act(async()=>root.render(<MemoryRouter initialEntries={['/book?bookPage=1']}><BookStudyPage deck={{...deck,wordCount:1}} reader={{words:async()=>({words:[first],nextCursor:null})}} onClose={()=>{}}/></MemoryRouter>));
 expect(container.querySelector('.book-entry-example')?.textContent).toContain('The mage refused.');expect(container.querySelector('.book-entry-example')?.textContent).toContain('魔法使いは拒否した。');
 await act(async()=>container.querySelector<HTMLInputElement>('.book-study-toggle input')!.click());
 expect(container.querySelector('.book-entry-example')?.textContent).toContain('The captain refused.');expect(container.querySelector('.book-entry-example')?.textContent).toContain('船長は拒否した。');expect(container.querySelectorAll('.word-example-translation.is-blurred')).toHaveLength(2);
});

it('turns with arrow keys from navigation buttons and the window, but keeps editing keys',async()=>{
 const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:null}))};
 await act(async()=>root.render(<MemoryRouter initialEntries={['/book?bookPage=1']}><BookStudyPage deck={deck} reader={reader} onClose={()=>{}}/><Location/></MemoryRouter>));
 await act(async()=>button('次のページ').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})));
 expect(container.querySelector('output')?.textContent).toContain('bookPage=3');
 await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',cancelable:true})));
 expect(container.querySelector('output')?.textContent).toContain('bookPage=1');
 await act(async()=>container.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})));
 expect(container.querySelector('output')?.textContent).toContain('bookPage=1');
});

it('jumps to an entered page and back to the cover while retaining other URL options',async()=>{
 const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:null}))};
 await act(async()=>root.render(<MemoryRouter initialEntries={['/book?bookPage=1&q=keep']}><BookStudyPage deck={deck} reader={reader} onClose={()=>{}}/><Location/></MemoryRouter>));
 const enter=async(value:string)=>{await act(async()=>{const input=container.querySelector<HTMLInputElement>('#book-page-input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));};
 await enter('15');
 expect(container.querySelector('output')?.textContent).toContain('bookPage=15');
 expect(container.querySelector('output')?.textContent).toContain('q=keep');
 expect(container.querySelector('.book-entry-word h2')?.textContent).toBe('word-56');
 await enter('18');expect(container.querySelector('output')?.textContent).toContain('bookPage=15');
 await enter('0');expect(container.querySelector('.book-cover-leaf')).toBeTruthy();
});

it('blurs English words and sentences together without hiding Japanese or changing content',async()=>{
 await act(async()=>root.render(<MemoryRouter initialEntries={['/book?bookPage=1']}><BookStudyPage deck={deck} reader={{words:async()=>({words:words.slice(0,8),nextCursor:null})}} onClose={()=>{}}/></MemoryRouter>));
 const english=container.querySelectorAll<HTMLInputElement>('.book-study-toggle input')[1];
 await act(async()=>english.click());
 expect(container.querySelector('.book-entry-word h2')?.classList.contains('is-blurred')).toBe(true);
 expect(container.querySelector('.book-entry-example p[lang="en"]')?.classList.contains('is-blurred')).toBe(true);
 expect(container.querySelector('.word-example-translation')?.classList.contains('is-blurred')).toBe(false);
 await act(async()=>container.querySelector<HTMLButtonElement>('button[aria-label="word-0の例文1の英語を表示"]')!.click());
 expect(container.querySelector('.book-entry-word h2')?.classList.contains('is-blurred')).toBe(false);
 expect(container.querySelector('.book-entry-example p[lang="en"]')?.classList.contains('is-blurred')).toBe(false);
 expect(container.querySelector('.book-entry-word h2')?.textContent).toBe('word-0');
});

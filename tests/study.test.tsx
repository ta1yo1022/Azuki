// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { SettingsPage } from "../src/components/SettingsPage";
import { StudyPage } from "../src/components/StudyPage";
import type { Deck, Word, WordPage } from "../shared/model";
let root: Root, container: HTMLDivElement;
const words: Word[] = Array.from({ length: 53 }, (_, i) => ({ id: `w${i}`, ordinal: i, word: `english-${i}`, meaning: `日本語-${i}`, example: `An example for word ${i}.`, otherMeanings: [`別の意味-${i}`], tags: [] }));
const deck: Deck = { id: "book", schemaVersion: 1, title: "テスト", description: "", textbookTags: [], visibility: "public", wordCount: 53, createdAt: "", updatedAt: "" };
const reader = { words: vi.fn<(id: string, query: string, cursor: number) => Promise<WordPage>>() };
async function mount(start = true) { await act(async () => root.render(<StudyPage deck={deck} reader={reader} onClose={() => {}} />)); if(start && container.querySelector(".study-setup")) await click("学習をはじめる"); }
function button(text: string) { return [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text))!; }
async function click(text: string) { await act(async () => button(text).click()); }
async function choose(label: string, value: string) {
  await act(async () => root.render(<MemoryRouter><SettingsPage onClose={() => {}} /></MemoryRouter>));
  await act(async () => {
    const select = [...container.querySelectorAll("select")].find(item => item.getAttribute("aria-label") === label)!;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await click('設定を保存');
  await mount();
}
const face = () => container.querySelector('.study-card-face[aria-hidden="false"]')?.textContent ?? '';
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  reader.words.mockReset().mockImplementation(async (_id, _query, cursor) => ({ words: words.slice(cursor, cursor + 50), nextCursor: cursor === 0 ? 50 : null }));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('defaults to Japanese first, hides the English answer and example, and applies direction changes on the next session', async () => {
  await mount();
  expect(face()).toContain('日本語-0'); expect(face()).not.toContain('english-0'); expect(face()).not.toContain('An example');
  await click('タップして英語を見る'); expect(face()).toContain('english-0'); expect(face()).toContain('An example for word 0.'); expect(face()).not.toContain('日本語-0'); expect(face()).not.toContain('別の意味');
  await click('次の単語'); expect(face()).toContain('日本語-1'); expect(face()).not.toContain('english-1');
  await choose('カードの向き','en-ja'); expect(face()).toContain('english-0'); expect(face()).not.toContain('日本語-0');
  await click('タップして日本語を見る'); expect(face()).toContain('日本語-0');
  await choose('カードの向き','ja-en'); expect(face()).toContain('日本語-0'); expect(face()).not.toContain('english-0');
  expect(reader.words).toHaveBeenCalledTimes(3);
});
it('loads ordered pages lazily and moves backwards through the same sequence', async () => {
  await mount();
  for(let i=0;i<50;i++) await click('次の単語');
  expect(face()).toContain('日本語-50');
  expect(reader.words.mock.calls.map(c=>c[2])).toEqual([0,50]);
  await click('前の単語'); expect(face()).toContain('日本語-49');
});
it('shuffles the whole book without omissions or repeats and restores order when selected', async () => {
  vi.spyOn(Math,'random').mockReturnValue(0);
  await mount(); await choose('出題順','shuffle');
  expect(reader.words.mock.calls.map(c=>c[2])).toEqual([0,0,50]);
  const seen: string[]=[];
  for(let i=0;i<53;i++) {
    seen.push(container.querySelector('.study-question-ja')!.textContent!);
    if(i<52) await click('次の単語');
  }
  expect(new Set(seen).size).toBe(53);
  expect([...seen].sort()).toEqual(words.map(w=>w.meaning).sort());
  expect(seen).not.toEqual(words.map(w=>w.meaning));
  await click('学習を終える'); expect(container.textContent).toContain('53語の学習');
  vi.mocked(Math.random).mockReturnValue(0.5);
  await click('もう一度はじめる'); expect(face()).not.toContain(seen[0]);
  await choose('出題順','ordered'); expect(face()).toContain('日本語-0');
});
it('does not turn cards when arrow keys are used on settings', async () => {
  await mount(false);
  await act(async () => container.querySelector('select')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  await click('学習をはじめる');
  expect(face()).toContain('日本語-0');
  await act(async () => container.querySelector('.study-card')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  expect(face()).toContain('日本語-1');
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
  expect(face()).toContain('日本語-0');
});
it('discards partial shuffled content on failure and retries the whole book', async () => {
  await mount();
  reader.words.mockImplementation(async (_id,_query,cursor) => { if(cursor===50) throw new Error('非公開になりました。'); return {words:words.slice(0,50),nextCursor:50}; });
  await choose('出題順','shuffle');
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('非公開になりました。');
  expect(container.querySelector('.study-card')).toBeNull();
  reader.words.mockImplementation(async (_id,_query,cursor) => ({words:words.slice(cursor,cursor+50),nextCursor:cursor===0?50:null}));
  await click('最初から読み直す');
  expect(container.querySelector('.study-card')).toBeTruthy();
  expect(container.querySelector('progress')?.max).toBe(53);
});
it('ignores a stale shuffle page after switching back to ordered mode', async () => {
  await mount();
  let finish!: (page: WordPage) => void;
  reader.words.mockImplementation(async (_id,_query,cursor) => cursor===0 ? {words:words.slice(0,50),nextCursor:50} : new Promise(resolve=>{finish=resolve;}));
  await choose('出題順','shuffle');
  await choose('出題順','ordered');
  await act(async () => finish({words:words.slice(50),nextCursor:null}));
  expect(face()).toContain('日本語-0');
  expect(reader.words.mock.calls.map(c=>c[2])).toEqual([0,0,50,0]);
});

it('shows setup before fetching, remembers skipped setup, and can restore it from settings', async () => {
  await mount(false);
  expect(reader.words).not.toHaveBeenCalled();
  expect(container.querySelector('.study-card')).toBeNull();
  await act(async()=>{
    const order=container.querySelector('select')!;
    order.value='shuffle';order.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await act(async()=>container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await click('学習をはじめる');
  expect(container.querySelectorAll('select')).toHaveLength(0);
  await act(async()=>root.unmount());root=createRoot(container);
  await mount(false);
  expect(container.querySelector('.study-setup')).toBeNull();
  expect(container.querySelector('.study-card')).not.toBeNull();
  expect(button('設定')).toBeUndefined();
  await act(async () => root.render(<MemoryRouter><SettingsPage onClose={() => {}} /></MemoryRouter>));
  expect(container.querySelector('select')?.value).toBe('shuffle');
  await act(async()=>container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await click('設定を保存');
  await act(async()=>root.unmount());root=createRoot(container);
  await mount(false);expect(container.querySelector('.study-setup')).not.toBeNull();
});
it('tolerates unavailable storage and reports failure on the settings page', async () => {
  localStorage.setItem('azuki.study-preferences.v1','invalid');
  await mount(false);
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('unavailable'); } });
  await click('学習をはじめる');
  expect(container.textContent).toContain('今回の学習には適用');
  expect(face()).toContain('日本語-0');
  expect(button('設定')).toBeUndefined();
  await act(async () => root.render(<MemoryRouter><SettingsPage onClose={() => {}} /></MemoryRouter>));
  await click('設定を保存');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('設定を保存できませんでした');
});

it('shows every saved English example on the answer while keeping Japanese translations off the card',async()=>{
 reader.words.mockResolvedValue({words:[{...words[0],examples:[{text:'The captain refused.',translation:'船長は拒否した。'},{text:'The mage refused.',translation:'魔法使いは拒否した。'}]}],nextCursor:null});
 await mount();await click('タップして英語を見る');
 expect(face()).toContain('The captain refused.');expect(face()).toContain('The mage refused.');expect(face()).not.toContain('船長は拒否した。');
});

async function mountExamples() {
 await act(async()=>root.render(<StudyPage mode="examples" deck={deck} reader={reader} onClose={()=>{}} />));
 if(container.querySelector('.study-setup')) await click('学習をはじめる');
}
it('studies each translated example separately, fetching later pages and hiding the answer until flipped', async()=>{
 const first={...words[0],examples:[{text:'The captain refused.',translation:'船長は拒否した。'},{text:'The mage refused.',translation:'魔法使いは拒否した。'},{text:'No translation.'}]};
 reader.words.mockImplementation(async(_id,_query,cursor)=>cursor===0?{words:[first],nextCursor:50}:{words:[{...words[50],examples:[{text:'We arrived.',translation:'私たちは到着した。'}]}],nextCursor:null});
 await mountExamples();
 expect(reader.words.mock.calls.map(c=>c[2])).toEqual([0,50]);
 expect(container.querySelector('progress')?.max).toBe(3);
 expect(face()).toContain('The captain refused.');expect(face()).not.toContain('船長は拒否した。');expect(face()).not.toContain(first.meaning);
 await click('タップして日本語を見る');expect(face()).toContain('船長は拒否した。');expect(face()).not.toContain('The captain refused.');
 await click('次の例文');expect(face()).toContain('The mage refused.');
 await click('次の例文');expect(face()).toContain('We arrived.');
 await click('前の例文');expect(face()).toContain('The mage refused.');
 await click('次の例文');await click('学習を終える');expect(container.textContent).toContain('3例文の学習');
});
it('shows an actionable empty state for untranslated examples',async()=>{
 reader.words.mockResolvedValue({words:[words[0]],nextCursor:null});await mountExamples();
 expect(container.textContent).toContain('日本語訳付きの例文がありません');expect(container.querySelector('.study-card')).toBeNull();
});
it('keeps example direction separate from word direction and supports Japanese first',async()=>{
 localStorage.setItem('azuki.study-preferences.v1',JSON.stringify({order:'ordered',direction:'ja-en',exampleDirection:'ja-en',skipSetup:false}));
 reader.words.mockResolvedValue({words:[{...words[0],examples:[{text:'We arrived.',translation:'私たちは到着した。'}]}],nextCursor:null});
 await mountExamples();expect(face()).toContain('私たちは到着した。');expect(face()).not.toContain('We arrived.');
 await click('タップして英語を見る');expect(face()).toContain('We arrived.');expect(face()).not.toContain('私たちは到着した。');
 expect(JSON.parse(localStorage.getItem('azuki.study-preferences.v1')!).direction).toBe('ja-en');
});
it('shuffles individual examples without dropping or repeating them',async()=>{
 localStorage.setItem('azuki.study-preferences.v1',JSON.stringify({order:'shuffle',direction:'ja-en',skipSetup:true}));
 vi.spyOn(Math,'random').mockReturnValue(0);
 reader.words.mockResolvedValue({words:[{...words[0],examples:[{text:'First.',translation:'一。'},{text:'Second.',translation:'二。'},{text:'Third.',translation:'三。'}]}],nextCursor:null});
 await mountExamples();const seen=[];
 for(let i=0;i<3;i++){seen.push(container.querySelector('.study-card-face[aria-hidden="false"] .study-sentence')?.textContent);if(i<2)await click('次の例文');}
 expect(seen).not.toEqual(['First.','Second.','Third.']);expect([...seen].sort()).toEqual(['First.','Second.','Third.'].sort());
});

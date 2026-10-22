// @vitest-environment happy-dom
import {act,useState,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {WordPaste,emptyWordPaste,type WordPasteDraft} from '../src/components/WordPaste';
const mocks=vi.hoisted(()=>({generate:vi.fn(),quota:{pro:true,available:true,used:0,reserved:0,limit:500,remaining:500,resetsAt:''},refresh:vi.fn()}));
vi.mock('../src/lib/vocabulary',()=>({vocabularyRepository:{generate:mocks.generate},useVocabularyQuota:()=>({quota:mocks.quota,loading:false,error:'',refresh:mocks.refresh})}));
let root:Root,container:HTMLDivElement;const preview=vi.fn(),busy=vi.fn();
function Harness({draft=emptyWordPaste}:{draft?:WordPasteDraft}){const [value,setValue]=useState(draft);return <WordPaste draft={value} setDraft={setValue} onPreview={preview} onBusy={busy}/>;}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.quota={pro:true,available:true,used:0,reserved:0,limit:500,remaining:500,resetsAt:''};mocks.generate.mockReset().mockResolvedValue({examples:[{term:'book',meaning:'本',text:'I read a book every day.',translation:'私は毎日本を読みます。'}],failed:[]});preview.mockReset();busy.mockReset();container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function render(draft?:WordPasteDraft){await act(async()=>root.render(<StrictMode><MemoryRouter><Harness draft={draft}/></MemoryRouter></StrictMode>));}
async function input(selector:string,value:string){await act(async()=>{const el=container.querySelector(selector) as HTMLInputElement;const prototype=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
async function click(label:string){await act(async()=>[...container.querySelectorAll('button')].find(el=>el.textContent?.trim()===label)!.click());}
async function lookup(){await input('#vocabulary-input','words[1]: book');await click('TOONを読み込む');}
it('works in StrictMode and lets Free create a book from TOON with manually edited meanings',async()=>{
 mocks.quota.pro=false;await render();await lookup();expect(container.textContent).toContain('Proを見る');
 expect([...container.querySelectorAll('button')].find(el=>el.textContent==='この1語で単語帳を作る')?.disabled).toBe(true);
 await input('[aria-label="bookの意味"]','本');await click('この1語で単語帳を作る');expect(preview).toHaveBeenCalledWith([{word:'book',meaning:'本',tags:[]}]);expect(mocks.generate).not.toHaveBeenCalled();
});
it('generates meaning automatically and preserves edits to meaning, examples and translations when saving',async()=>{
 await render();await lookup();await click('1語の意味・例文を生成');expect((container.querySelector('[aria-label="bookの意味"]') as HTMLTextAreaElement).value).toBe('本');
 await input('[aria-label="bookの意味"]','本、書物');await input('[aria-label="bookの例文の日本語訳"]','私は毎日、本を読んでいます。');await click('この1語で単語帳を作る');expect(preview.mock.calls[0][0][0]).toMatchObject({meaning:'本、書物',examples:[{text:'I read a book every day.',translation:'私は毎日、本を読んでいます。'}]});
 await click('入力を変更');await click('TOONを読み込む');expect((container.querySelector('[aria-label="bookの意味"]') as HTMLTextAreaElement).value).toBe('本、書物');
});
it('shows the exhausted weekly quota while allowing already generated content to be edited and saved',async()=>{
 mocks.quota.remaining=0;mocks.quota.used=500;await render();await lookup();expect(container.textContent).toContain('今週の生成上限に達しました');expect([...container.querySelectorAll('button')].find(el=>el.textContent==='今週の上限に到達')?.disabled).toBe(true);await input('[aria-label="bookの意味"]','本');await click('この1語で単語帳を作る');expect(preview).toHaveBeenCalledOnce();
});
it('reports invalid TOON without making a generation request',async()=>{
 await render();await input('#vocabulary-input','book,agree');await click('TOONを読み込む');expect(container.querySelector('[role="alert"]')?.textContent).toContain('TOON');expect(mocks.generate).not.toHaveBeenCalled();
});
it('reuses the request ID after a network failure to avoid duplicate charging',async()=>{
 mocks.generate.mockRejectedValueOnce(new Error('network unavailable'));await render();await lookup();await click('1語の意味・例文を生成');await click('1語の意味・例文を生成');expect(mocks.generate.mock.calls[0][0]).toBe(mocks.generate.mock.calls[1][0]);expect(mocks.generate.mock.calls[1][1]).toEqual([{term:'book'}]);
});

it('uses a table with paging and preserves edits from every page when saving',async()=>{
 const rows=Array.from({length:51},(_,i)=>({term:`word-${i}`,meaning:`意味${i}`,text:'Example sentence.',translation:'例文です。',generated:true}));
 await render({raw:'',rows});expect(container.querySelector('table')).toBeTruthy();expect(container.querySelectorAll('tbody tr')).toHaveLength(25);
 await input('[aria-label="word-0の意味"]','最初のページで編集');await input('[aria-label="編集するページ"]','2');
 expect(container.querySelectorAll('tbody tr')).toHaveLength(1);await input('[aria-label="word-50の意味"]','最後のページで編集');await click('この51語で単語帳を作る');
 expect(preview.mock.calls[0][0]).toHaveLength(51);expect(preview.mock.calls[0][0][0].meaning).toBe('最初のページで編集');expect(preview.mock.calls[0][0][50].meaning).toBe('最後のページで編集');
 await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="word-50を除外"]')!.click());
 expect((container.querySelector('[aria-label="編集するページ"]') as unknown as HTMLSelectElement).value).toBe('1');expect(container.querySelectorAll('tbody tr')).toHaveLength(25);
});

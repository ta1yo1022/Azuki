// @vitest-environment happy-dom
import {encodeToon,decodeToon} from '../shared/toon';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {ImportPage} from '../src/components/ImportPage';
let root:Root,container:HTMLDivElement;
const save=vi.fn(),close=vi.fn();
beforeEach(async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);save.mockReset().mockResolvedValue(undefined);close.mockReset();container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);await act(async()=>root.render(<MemoryRouter initialEntries={['/library/import?tab=paste']}><ImportPage onClose={close} onImport={save}/></MemoryRouter>));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function input(selector:string,value:string){await act(async()=>{const el=container.querySelector(selector) as HTMLInputElement;const prototype=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
async function click(text:string){await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent?.trim()===text)!.click());}
async function preview(){await input('textarea',encodeToon([{word:'hello',meaning:'こんにちは'}]));await click('内容を確認');}
it('uses the textbook name as title and stores the edition separately',async()=>{
 await preview();await input('#import-title-input','独自の名前');await input('#import-category','textbook');
 expect(container.querySelector('#import-title-input')).toBeNull();
 await click('1語を登録する');expect(save).not.toHaveBeenCalled();expect(container.textContent).toContain('教材名を入力');
 await input('#import-textbook-name','  テスト教材  ');await input('#import-textbook-edition','第2版');await click('1語を登録する');
 expect(save.mock.calls[0][0]).toMatchObject({title:'テスト教材',textbookTags:[{name:'テスト教材',edition:'第2版'}]});
 expect(close).toHaveBeenCalledOnce();
});
it('preserves the custom title when switching back to another category',async()=>{
 await preview();await input('#import-title-input','旅の単語');await input('#import-category','textbook');await input('#import-textbook-name','テスト教材');await input('#import-category','旅行');
 expect((container.querySelector('#import-title-input') as HTMLInputElement).value).toBe('旅の単語');await click('1語を登録する');
 expect(save.mock.calls[0][0]).toMatchObject({title:'旅の単語',textbookTags:[{name:'旅行'}]});
});

it('shows a standalone page and keeps the draft available after a failed save',async()=>{
 expect(container.querySelector('dialog')).toBeNull();expect(container.querySelector('h1')?.textContent).toBe('単語帳を作成');
 await preview();await input('#import-title-input','旅の単語');save.mockRejectedValueOnce(new Error('保存できませんでした。'));
 await click('1語を登録する');expect(container.querySelector('[role="alert"]')?.textContent).toContain('保存できませんでした。');expect(close).not.toHaveBeenCalled();
 expect((container.querySelector('#import-title-input') as HTMLInputElement).value).toBe('旅の単語');await click('1語を登録する');expect(close).toHaveBeenCalledOnce();
});

it('saves a Chinese word with Thai meanings and the chosen language pair',async()=>{
 await input('textarea',encodeToon([{word:'学习',meaning:'เรียน',examples:[{text:'我每天学习中文。',translation:'ฉันเรียนภาษาจีนทุกวัน'}]}]));await click('内容を確認');
 await input('#import-language','zh');await input('#import-meaning-language','th');await input('#import-title-input','中国語の勉強');await click('1語を登録する');
 expect(save.mock.calls[0][0]).toMatchObject({language:'zh',meaningLanguage:'th',words:[{word:'学习',meaning:'เรียน'}]});
});

it('shows sample translations in the review and preserves them through registration',async()=>{
 await click('サンプルを使う');await click('内容を確認');
 expect(container.textContent).toContain('こんにちは、お元気ですか？');expect(container.textContent).toContain('私は電車で旅行するのが好きです。');
 await input('#import-title-input','サンプル');await click('2語を登録する');
 expect(save.mock.calls[0][0].words[0].examples[0].translation).toBe('こんにちは、お元気ですか？');
});
it('accepts the guide template from the initial creation tab and saves every translated example',async()=>{
 const {CreateGuide}=await import('../src/components/CreateGuide');
 await act(async()=>root.render(<MemoryRouter><CreateGuide/></MemoryRouter>));
 const template=container.querySelector<HTMLTextAreaElement>('#example-toon')!.value;
 await act(async()=>root.unmount());root=createRoot(container);
 await act(async()=>root.render(<MemoryRouter initialEntries={['/library/import']}><ImportPage onClose={close} onImport={save}/></MemoryRouter>));
 await input('#vocabulary-input',template);await click('TOONを読み込む');
 expect(container.textContent).toContain('私は学校の近くで小さなカフェを見つけました。');expect(container.textContent).toContain('探検家は隠された扉を発見しました。');
 await input('#import-title-input','ガイドから登録');await click('2語を登録する');
 expect(save.mock.calls[0][0].words[0].examples).toHaveLength(2);expect(save.mock.calls[0][0].words.every((word:any)=>word.examples.every((example:any)=>example.translation))).toBe(true);
});

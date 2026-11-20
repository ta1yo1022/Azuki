// @vitest-environment happy-dom
import {encodeJson,decodeJson} from '../shared/json';
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
async function preview(){await input('textarea',encodeJson([{word:'hello',meaning:'こんにちは'}]));await click('内容を確認');}
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
 await input('textarea',encodeJson([{word:'学习',meaning:'เรียน',examples:[{text:'我每天学习中文。',translation:'ฉันเรียนภาษาจีนทุกวัน'}]}]));await click('内容を確認');
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
 const template=container.querySelector<HTMLTextAreaElement>('#example-json')!.value;
 await act(async()=>root.unmount());root=createRoot(container);
 await act(async()=>root.render(<MemoryRouter initialEntries={['/library/import']}><ImportPage onClose={close} onImport={save}/></MemoryRouter>));
 await input('#vocabulary-input',template);await click('JSONを読み込む');
 expect(container.textContent).toContain('私は学校の近くで小さなカフェを見つけました。');expect(container.textContent).toContain('探検家は「隠された扉を発見した」と言いました。');
 await input('#import-title-input','ガイドから登録');await click('2語を登録する');
 expect(save.mock.calls[0][0].words[0].examples).toHaveLength(2);expect(save.mock.calls[0][0].words[0].examples[1].text).toBe('The explorer said, "I discovered a hidden door."');expect(save.mock.calls[0][0].words.every((word:any)=>word.examples.every((example:any)=>example.translation))).toBe(true);
});

it('registers manually entered words and multiple translated examples while preserving drafts across tabs and review',async()=>{
 await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(<MemoryRouter initialEntries={['/library/import?tab=manual']}><ImportPage onClose={close} onImport={save}/></MemoryRouter>));
 await input('[aria-label="1語目の単語"]','curious');await input('[aria-label="1語目の意味"]','好奇心の強い');await input('[aria-label="1語目の例文1"]','Stay curious.');await input('[aria-label="1語目の例文1の訳"]','好奇心を持ち続けて。');
 await click('例文を追加');await input('[aria-label="1語目の例文2"]','She is curious.');await input('[aria-label="1語目の例文2の訳"]','彼女は好奇心が強い。');
 await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(b=>b.textContent?.trim()==='JSONで単語帳登録')!.click());
 await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(b=>b.textContent?.trim()==='自分で入力')!.click());
 expect((container.querySelector('[aria-label="1語目の例文2の訳"]') as HTMLTextAreaElement).value).toBe('彼女は好奇心が強い。');
 await click('内容を確認');expect(container.textContent).toContain('好奇心を持ち続けて。');await click('入力に戻る');expect((container.querySelector('[aria-label="1語目の単語"]') as HTMLTextAreaElement).value).toBe('curious');await click('内容を確認');
 await input('#import-title-input','手入力の単語帳');await click('1語を登録する');expect(save.mock.calls[0][0].words[0].examples).toHaveLength(2);expect(save.mock.calls[0][0].words[0].meaning).toBe('好奇心の強い');
});
it('adds manual rows without requiring examples',async()=>{
 await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(<MemoryRouter initialEntries={['/library/import?tab=manual']}><ImportPage onClose={close} onImport={save}/></MemoryRouter>));
 expect(container.textContent).not.toContain('表からまとめて貼り付け');
 await input('[aria-label="1語目の単語"]','book');await input('[aria-label="1語目の意味"]','本');await click('単語を追加');
 await input('[aria-label="2語目の単語"]','travel');await input('[aria-label="2語目の意味"]','旅行する');
 await click('内容を確認');await input('#import-title-input','自分で作成');await click('2語を登録する');
 expect(save.mock.calls[0][0].words).toHaveLength(2);expect(save.mock.calls[0][0].words[0].examples).toBeUndefined();
});

it('groups paste, file selection and dropping under one JSON tab',async()=>{
 expect([...container.querySelectorAll('[role=tab]')].map(item=>item.textContent?.trim())).toEqual(['単語から作成','自分で入力','JSONで単語帳登録']);
 expect(container.querySelector('#json-input')).toBeTruthy();expect(container.querySelector('.json-file-drop')).toBeTruthy();
 expect(container.querySelector('input[type=file]')!.getAttribute('accept')).toBe('.json,application/json');
 await input('#json-input','{"words":[{"word":"hello","meaning":"こんにちは","examples":[{"text":"Hello, world!","translation":"世界よ、こんにちは！"}]}]}');
 await click('自分で入力');await click('JSONで単語帳登録');expect((container.querySelector('#json-input') as HTMLTextAreaElement).value).toContain('Hello, world!');
 await click('内容を確認');expect(container.textContent).toContain('世界よ、こんにちは！');
});
it('reads a selected JSON file into review with translated examples',async()=>{
 const selected={name:'words.json',size:100,text:async()=>JSON.stringify({words:[{word:'hello',meaning:'こんにちは',examples:[{text:'Hello, everyone.',translation:'皆さん、こんにちは。'}]}]})};
 const file=container.querySelector('input[type=file]')!;
 Object.defineProperty(file,'files',{value:[selected],configurable:true});
 await act(async()=>{file.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(container.textContent).toContain('words.json');expect(container.textContent).toContain('皆さん、こんにちは。');
 await input('#import-title-input','ファイルから');await click('1語を登録する');expect(save.mock.calls[0][0].words[0].examples[0].text).toBe('Hello, everyone.');
});
it('accepts a dropped JSON file and rejects malformed JSON without a partial preview',async()=>{
 const drop=async(text:string)=>{const event=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{files:[{name:'drop.json',size:text.length,text:async()=>text}]}});await act(async()=>{container.querySelector('.json-file-drop')!.dispatchEvent(event);});};
 await drop('{"words":[');expect(container.querySelector('[role=alert]')!.textContent).toContain('JSONの形式');expect(container.querySelector('.import-summary')).toBeNull();
 await drop('{"words":[{"word":"book","meaning":"本"}]}');expect(container.textContent).toContain('drop.json');expect(container.querySelector('.import-summary')).toBeTruthy();
});
it('rejects an oversized JSON file before reading it',async()=>{
 const read=vi.fn();const file=container.querySelector('input[type=file]')!;
 Object.defineProperty(file,'files',{value:[{name:'large.json',size:512*1024+1,text:read}],configurable:true});
 await act(async()=>{file.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(read).not.toHaveBeenCalled();expect(container.querySelector('[role=alert]')!.textContent).toContain('512KB');
});

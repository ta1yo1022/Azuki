// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {ForkDialog} from '../src/components/ForkDialog';
import type {Deck,Word,DeckInput} from '../shared/model';
vi.mock('../src/lib/repository',()=>({publicRepository:{}}));
let container:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const deck:Deck={id:'source',schemaVersion:1,title:'元の単語帳',description:'説明',textbookTags:[],visibility:'public',wordCount:501,createdAt:'',updatedAt:''};
const words:Word[]=Array.from({length:501},(_,i)=>({id:`w${i}`,ordinal:i,word:`word-${i}`,meaning:`意味${i}`,example:'A short example.',tags:[]}));
it('loads the complete book without a second range selector',async()=>{
  const reader={words:vi.fn(async(_id:string,_q:string,cursor:number)=>({words:words.slice(cursor,cursor+50),nextCursor:cursor+50<words.length?cursor+50:null}))};
  const save=vi.fn(async(_input:DeckInput)=>{}),close=vi.fn();
  await act(async()=>root.render(<ForkDialog deck={deck} reader={reader} onSave={save} onClose={close}/>));
  expect(reader.words).toHaveBeenCalledTimes(11);
  expect(container.querySelector('select')).toBeNull();
  const json=container.querySelector('.fork-json') as HTMLTextAreaElement;
  expect(JSON.parse(json.value)).toHaveLength(501);
  expect(save).not.toHaveBeenCalled();
  const button=(name:string)=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===name)!;
  await act(async()=>button('内容を確認').click());
  expect(container.querySelector('[aria-label="フォークの確認"]')?.textContent).toContain('501語');
  await act(async()=>button('フォークを保存').click());
  expect(save).toHaveBeenCalledTimes(1);expect(save.mock.calls[0][0].words).toHaveLength(501);expect(close).toHaveBeenCalled();
});

it('keeps large translated books editable and saveable within the JSON limit',async()=>{
  const sentence='The crew carefully checked every part of the ship before leaving the harbor. They then departed on schedule.';
  const translation='船が港を出る前に、乗組員は船のすべての部分を念入りに確認しました。確認後、船は予定どおりに出航しました。';
  const translated:Word[]=Array.from({length:1350},(_,i)=>({id:`translated-${i}`,ordinal:i,word:`word-${i}`,meaning:`意味${i}`,example:sentence,examples:[{text:sentence,translation}],tags:[]}));
  const source={...deck,wordCount:translated.length};
  const reader={words:vi.fn(async()=>({words:translated,nextCursor:null}))};
  const save=vi.fn(async(_input:DeckInput)=>{});
  await act(async()=>root.render(<ForkDialog deck={source} reader={reader} onSave={save} onClose={()=>{}}/>));
  const json=container.querySelector('.fork-json') as HTMLTextAreaElement;
  expect(new TextEncoder().encode(json.value).length).toBeLessThan(512*1024);
  expect(new TextEncoder().encode(JSON.stringify(JSON.parse(json.value),null,2)).length).toBeGreaterThan(512*1024);
  const button=(name:string)=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===name)!;
  await act(async()=>button('内容を確認').click());
  expect(container.querySelector('[aria-label="フォークの確認"]')?.textContent).toContain('1350語');
  await act(async()=>button('フォークを保存').click());
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0].words).toHaveLength(1350);
  expect(save.mock.calls[0][0].words[0].examples).toEqual([{text:sentence,translation}]);
});

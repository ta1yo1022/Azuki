// @vitest-environment happy-dom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {WordEditor} from '../src/components/WordEditor';
import {WordExamples} from '../src/components/WordExamples';
import {demoRepository} from '../src/lib/repository';
import type {Deck,Word} from '../shared/model';
vi.mock('../src/lib/firebase',()=>({auth:null}));
let container:HTMLDivElement,root:Root,deck:Deck,word:Word;
beforeEach(async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);deck=await demoRepository.create({schemaVersion:1,title:'例文を編集',description:'',textbookTags:[],words:[{word:'refuse',meaning:'拒否する',example:'The captain refused to leave.',tags:[]}]});word=(await demoRepository.words(deck.id,'',0)).words[0];});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();localStorage.clear();vi.unstubAllGlobals();});
async function click(label:string){const element=[...container.querySelectorAll('button')].find(b=>b.textContent?.includes(label));expect(element).toBeTruthy();await act(async()=>element!.click());}
async function type(selector:string,value:string){await act(async()=>{const el=container.querySelector<HTMLTextAreaElement>(selector)!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}
it('adds translations and multiple examples, persists on save, and can reopen and delete them',async()=>{
 const saved=vi.fn();await act(async()=>root.render(<WordEditor deck={deck} word={word} repository={demoRepository} onSaved={saved}/>));
 await click('例文を追加・編集');await click('例文を追加');
 await type('[aria-label="例文2"] textarea[lang="en"]','She refused the invitation.');await type('[aria-label="例文2"] textarea[lang="ja"]','彼女は招待を断った。');
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(saved).toHaveBeenCalledTimes(1);const latest=(await demoRepository.words(deck.id,'',0)).words[0];
 expect(latest.examples).toHaveLength(2);expect(latest.examples?.[1].translation).toBe('彼女は招待を断った。');expect((await demoRepository.list()).find(d=>d.id===deck.id)?.wordCount).toBe(1);
 await act(async()=>root.render(<WordEditor deck={deck} word={latest} repository={demoRepository} onSaved={saved}/>));await click('例文を追加・編集');
 await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="例文1を削除"]')!.click());
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect((await demoRepository.words(deck.id,'',0)).words[0].example).toBe('She refused the invitation.');
});
it('does not persist cancelled changes and renders user content as plain text',async()=>{
 await act(async()=>root.render(<WordEditor deck={deck} word={word} repository={demoRepository} onSaved={vi.fn()}/>));await click('例文を追加・編集');await type('[aria-label="例文1"] textarea[lang="en"]','Unsaved sentence.');await click('キャンセル');
 expect((await demoRepository.words(deck.id,'',0)).words[0].example).toBe(word.example);
 await act(async()=>root.render(<WordExamples word={{...word,examples:[{text:'<img src=x onerror=alert(1)>',translation:'訳です。'},{text:'Another example.'}]}}/>));
 expect(container.querySelector('img')).toBeNull();expect(container.textContent).toContain('訳です。');expect(container.textContent).toContain('Another example.');
});

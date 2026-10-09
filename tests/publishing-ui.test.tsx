// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ShareDialog } from "../src/components/ShareDialog";
import { DeckVariants } from "../src/components/DeckVariants";
import { WordEditor } from "../src/components/WordEditor";
import { PublishConflict, publicRepository, cloudRepository } from "../src/lib/repository";
import type { Deck, Word } from "../shared/model";
vi.mock("../src/lib/firebase",()=>({auth:null}));
const deck: Deck = {id:"copy",schemaVersion:1,title:"旅行",description:"",textbookTags:[],visibility:"private",wordCount:1,createdAt:"",updatedAt:"",sourceDeck:{id:"source",title:"元の旅行",available:true},unchangedCopy:true,variantCount:1};
let root:Root, container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); HTMLDialogElement.prototype.showModal = function(){this.open=true;};container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const button=(text:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent?.includes(text))!;
it('disables publishing unchanged copies but still allows an existing public copy to be withdrawn',async()=>{
 const change=vi.fn();
 await act(async()=>root.render(<MemoryRouter><ShareDialog deck={deck} demo={false} onClose={()=>{}} onVisibility={change}/></MemoryRouter>));
 expect(button('派生版として公開').disabled).toBe(true);
 expect(container.querySelector('a')?.getAttribute('href')).toBe('/shared/source');
 await act(async()=>root.render(<MemoryRouter><ShareDialog deck={{...deck,visibility:'public'}} demo={false} onClose={()=>{}} onVisibility={change}/></MemoryRouter>));
 await act(async()=>button('非公開に戻す').click());expect(change).toHaveBeenCalledWith('private');
});
it('links to the existing publication when duplicate content is rejected',async()=>{
 await act(async()=>root.render(<MemoryRouter><ShareDialog deck={{...deck,unchangedCopy:false}} demo={false} onClose={()=>{}} onVisibility={async()=>{throw new PublishConflict('同じ内容があります','existing');}}/></MemoryRouter>));
 await act(async()=>button('派生版として公開').click());
 expect(container.querySelector('[role="alert"]')?.textContent).toContain('同じ内容');
 expect(container.querySelector('a[href="/shared/existing"]')).not.toBeNull();
});
it('loads URL-selected variants, supports pagination, and reports failures',async()=>{
 const reader=vi.spyOn(publicRepository,'variants').mockResolvedValueOnce({decks:[{...deck,id:'variant-1'}],nextCursor:'next'}).mockRejectedValueOnce(new Error('接続エラー')).mockResolvedValueOnce({decks:[{...deck,id:'variant-2'}],nextCursor:null});
 await act(async()=>root.render(<MemoryRouter initialEntries={['/shared/source?variants=1']}><DeckVariants deck={{...deck,id:'source'}}/></MemoryRouter>));
 expect(container.querySelector('a[href="/shared/variant-1"]')).not.toBeNull();
 await act(async()=>button('続きを表示').click());expect(container.textContent).toContain('接続エラー');
 await act(async()=>button('再読み込み').click());expect(container.querySelector('a[href="/shared/variant-2"]')).not.toBeNull();
 expect(reader.mock.calls.map(c=>c[1])).toEqual([null,'next','next']);
});
it('keeps the editor open on failure and only reports successful saves',async()=>{
 const word:Word={id:'word',ordinal:0,word:'trip',meaning:'旅行',example:'A trip.',tags:[]};
 const saved=vi.fn(); const edit=vi.spyOn(cloudRepository,'editWord').mockRejectedValueOnce(new Error('保存エラー')).mockResolvedValueOnce({deck,word});
 await act(async()=>root.render(<WordEditor deck={{...deck,visibility:'public'}} word={word} onSaved={saved}/>));
 await act(async()=>button('単語・意味・例文を編集').click());expect(container.textContent).toContain('非公開になります');
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(saved).not.toHaveBeenCalled();expect(container.textContent).toContain('保存エラー');
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(edit).toHaveBeenCalledTimes(2);expect(saved).toHaveBeenCalledWith(deck);
});

// @vitest-environment happy-dom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {Collections} from '../src/components/Collections';
const mocks=vi.hoisted(()=>({list:vi.fn(),save:vi.fn(),remove:vi.fn(),favorites:vi.fn()}));
vi.mock('../src/lib/collections',()=>({collectionsRepository:mocks}));
vi.mock('../src/lib/repository',()=>({favoritesRepository:{list:mocks.favorites}}));
let container:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();mocks.list.mockResolvedValue([{id:'a',name:'学校',deckIds:['own','favorite']},{id:'b',name:'試験',deckIds:['own']}]);mocks.favorites.mockResolvedValue([{id:'favorite',deck:{title:'旅行'}}]);mocks.save.mockImplementation(async value=>({...value,id:value.id??'new'}));mocks.remove.mockResolvedValue({ok:true});HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
function button(text:string){return [...container.querySelectorAll('button')].find(b=>b.textContent===text)!;}
it('filters owned and favorite books together and preserves overlapping membership on edit',async()=>{
 const filter=vi.fn();await act(async()=>root.render(<Collections decks={[{id:'own',title:'自分の単語帳'} as any]} revision={0} onFilter={filter}/>));
 await act(async()=>button('学校2').click());expect(filter).toHaveBeenLastCalledWith(['own','favorite']);
 await act(async()=>button('コレクションを編集').click());expect(container.querySelector('dialog')!.hasAttribute('open')).toBe(true);
 const checkboxes=[...container.querySelectorAll('input[type=checkbox]')];expect(checkboxes).toHaveLength(2);expect(checkboxes.every(box=>(box as unknown as HTMLInputElement).checked)).toBe(true);
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(mocks.save).toHaveBeenCalledWith({id:'a',name:'学校',deckIds:['own','favorite']});
 await act(async()=>button('試験1').click());expect(filter).toHaveBeenLastCalledWith(['own']);
 await act(async()=>button('すべて').click());expect(filter).toHaveBeenLastCalledWith(null);
});
it('requires confirmation before deleting and retains saved groups after a failed save',async()=>{
 const filter=vi.fn();await act(async()=>root.render(<Collections decks={[]} revision={0} onFilter={filter}/>));
 await act(async()=>button('試験1').click());await act(async()=>button('コレクションを編集').click());
 mocks.save.mockRejectedValueOnce(new Error('通信エラー'));await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(container.querySelector('[role=alert]')!.textContent).toContain('通信エラー');expect(container.querySelector('dialog')!.hasAttribute('open')).toBe(true);
 await act(async()=>button('コレクションを削除').click());expect(mocks.remove).not.toHaveBeenCalled();expect(container.textContent).toContain('単語帳は削除されません');
 await act(async()=>button('コレクションを削除').click());expect(mocks.remove).toHaveBeenCalledWith('b');expect(filter).toHaveBeenLastCalledWith(null);
});

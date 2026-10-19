// @vitest-environment happy-dom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {FavoriteButton,Favorites} from '../src/components/Favorites';
const mocks=vi.hoisted(()=>({list:vi.fn(),add:vi.fn(),remove:vi.fn(),login:vi.fn(),user:null as null|{uid:string}}));
vi.mock('../src/lib/repository',()=>({favoritesRepository:mocks}));
vi.mock('../src/lib/firebase',()=>({auth:{get currentUser(){return mocks.user;}},googleSignIn:mocks.login}));
let container:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();mocks.user={uid:'alice'};mocks.list.mockResolvedValue([]);mocks.add.mockResolvedValue(undefined);mocks.remove.mockResolvedValue(undefined);container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('registers and removes a shortcut without invoking copy or import',async()=>{
 await act(async()=>root.render(<FavoriteButton id="standard-a1" userId="alice"/>));
 await act(async()=>container.querySelector('button')!.click());expect(mocks.add).toHaveBeenCalledWith('standard-a1');expect(container.textContent).toContain('登録済み');
 await act(async()=>container.querySelector('button')!.click());expect(mocks.remove).toHaveBeenCalledWith('standard-a1');expect(container.querySelector('button')!.getAttribute('aria-pressed')).toBe('false');
});
it('logs in before creating a shortcut',async()=>{
 mocks.user=null;mocks.login.mockImplementation(async()=>{mocks.user={uid:'alice'};});
 await act(async()=>root.render(<FavoriteButton id="standard-a1"/>));
 await act(async()=>container.querySelector('button')!.click());expect(mocks.login).toHaveBeenCalledOnce();expect(mocks.add).toHaveBeenCalledWith('standard-a1');
});
it('links to the original, and lets an unavailable shortcut be removed',async()=>{
 mocks.list.mockResolvedValue([{id:'original',deck:{title:'旅行のことば',wordCount:500},createdAt:''},{id:'hidden',deck:null,createdAt:''}]);
 await act(async()=>root.render(<MemoryRouter><Favorites owner="alice"/></MemoryRouter>));
 expect(container.querySelector('a[href="/shared/original"]')).toBeTruthy();expect(container.querySelector('a[href="/shared/hidden"]')).toBeNull();
 await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="開けない単語帳をお気に入りから外す"]')!.click());
 expect(mocks.remove).toHaveBeenCalledWith('hidden');expect(container.textContent).not.toContain('現在開けません');
});

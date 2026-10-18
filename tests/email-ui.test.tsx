// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {AdminEmails} from '../src/components/AdminEmails';
import {EmailPreferences} from '../src/components/EmailPreferences';
const mocks=vi.hoisted(()=>({dashboard:vi.fn(),action:vi.fn(),preferences:vi.fn(),setPreferences:vi.fn(),create:vi.fn()}));
vi.mock('firebase/auth',()=>({onAuthStateChanged:(_:unknown,cb:Function)=>{cb({uid:'admin'});return()=>{};}}));
vi.mock('../src/lib/firebase',()=>({auth:{currentUser:{uid:'admin'}},googleSignIn:vi.fn()}));
vi.mock('../src/lib/repository',()=>({emailRepository:mocks}));
let root:Root,container:HTMLDivElement;
const dashboard={ready:true,used:1,limit:290,subscribers:12,campaigns:[{id:'123',subject:'新機能のお知らせ',body:'<script>はテキスト表示</script>',status:'draft',created_at:'2026-10-18T00:00:00Z',pending:0,accepted:0,failed:0,unknown:0,skipped:0,test_status:'accepted'}]};
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();mocks.dashboard.mockResolvedValue(dashboard);mocks.action.mockResolvedValue({ok:true});mocks.preferences.mockResolvedValue({enabled:false,email:'user@example.com',available:true});mocks.setPreferences.mockResolvedValue({enabled:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function mount(node:React.ReactNode){await act(async()=>root.render(<MemoryRouter>{node}</MemoryRouter>));}
function button(label:string){const found=[...container.querySelectorAll('button')].find(b=>b.textContent===label);expect(found).toBeTruthy();return found!;}
async function click(label:string){await act(async()=>button(label).click());}
it('requires the final broadcast confirmation and previews content safely',async()=>{
 await mount(<AdminEmails/>);expect(container.querySelector('script')).toBeNull();expect(mocks.action).not.toHaveBeenCalled();
 await click('配信内容を確認');expect(container.querySelector('[aria-label="一斉配信の最終確認"]')?.textContent).toContain('12 人');expect(mocks.action).not.toHaveBeenCalled();
 await click('全受信登録者への配信を開始');expect(mocks.action).toHaveBeenCalledWith('123','start');
});
it('disables sending when provider configuration is missing',async()=>{
 mocks.dashboard.mockResolvedValue({...dashboard,ready:false});await mount(<AdminEmails/>);expect(button('配信内容を確認').disabled).toBe(true);expect(button('自分宛てにテスト送信').disabled).toBe(true);expect(container.textContent).toContain('配信はまだ無効');
});
it('shows no management controls after an authorization failure',async()=>{
 mocks.dashboard.mockRejectedValue(new Error('管理画面を利用する権限がありません。'));await mount(<AdminEmails/>);expect(container.querySelector('[role="alert"]')?.textContent).toContain('権限');expect(container.querySelector('form')).toBeNull();
});
it('does not subscribe until the user explicitly chooses to receive email',async()=>{
 await mount(<EmailPreferences/>);expect(mocks.setPreferences).not.toHaveBeenCalled();expect(container.textContent).toContain('受信しない');await click('アップデート通知を受け取る');expect(mocks.setPreferences).toHaveBeenCalledWith(true);expect(container.querySelector('[role="status"]')?.textContent).toContain('受け取る設定');
});

it('inserts bold text and an image into the draft without sending',async()=>{
 await mount(<AdminEmails/>);
 await click('太字');
 const body=container.querySelector<HTMLTextAreaElement>('#email-body')!;
 expect(body.value).toBe('**太字の文章**');
 await click('画像を挿入');
 async function input(id:string,value:string){await act(async()=>{const el=container.querySelector<HTMLInputElement>(id)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}
 await input('#email-image-url','javascript:alert(1)');await click('本文に画像を追加');expect(container.querySelector('[role="alert"]')?.textContent).toContain('HTTPS');
 await input('#email-image-url','https://example.com/image.png');await input('#email-image-alt','本型の画面');await click('本文に画像を追加');
 expect(body.value).toContain('**太字の文章**');
 expect(body.value).toContain('![本型の画面](https://example.com/image.png)');
 expect(container.querySelector('iframe')!.getAttribute('srcdoc')).toContain('src="https://example.com/image.png"');expect(mocks.action).not.toHaveBeenCalled();
});

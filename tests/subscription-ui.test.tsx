// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {PlansPage,ProBookGate} from '../src/components/PlansPage';
const mocks=vi.hoisted(()=>({status:{enabled:true,pro:false,testMode:true,monthlyPrice:480,status:null as string|null,periodEnd:null as number|null,cancelAtPeriodEnd:false,checkoutAvailable:true},error:'',request:vi.fn()}));
vi.mock('../src/lib/billing',()=>({useBilling:()=>({status:mocks.status,error:mocks.error,loading:false,refresh:vi.fn()}),billingRequest:mocks.request}));
vi.mock('../src/lib/firebase',()=>({auth:{currentUser:{uid:'user'}},googleSignIn:vi.fn()}));
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.status.pro=false;mocks.status.enabled=true;mocks.status.status=null;mocks.error='';mocks.request.mockReset().mockResolvedValue({});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('requires explicit consent before starting the fixed monthly checkout',async()=>{
 await act(async()=>root.render(<MemoryRouter><PlansPage/></MemoryRouter>));
 const button=Array.from(container.querySelectorAll('button')).find(button=>button.textContent?.includes('月額480円でProを始める'))!;
 expect(button.disabled).toBe(true);expect(container.textContent).toContain('単語音声の新規生成：1日10個');expect(container.textContent).toContain('例文音声の新規生成：1日5個');expect(container.textContent).toContain('生成済み音声の再生は制限なし');
 await act(async()=>container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
 expect(button.disabled).toBe(false);await act(async()=>button.click());
 expect(mocks.request).toHaveBeenCalledWith('checkout','POST',{acceptTerms:true});
});
it('does not mount book content for a free account and never fails open on verification errors',async()=>{
 const render=()=>root.render(<MemoryRouter><ProBookGate onClose={()=>{}}><div data-book>Book content</div></ProBookGate></MemoryRouter>);
 await act(async()=>render());expect(container.querySelector('[data-book]')).toBeNull();expect(container.textContent).toContain('Proで利用できます');
 mocks.error='確認できません';await act(async()=>render());expect(container.querySelector('[data-book]')).toBeNull();
 mocks.error='';mocks.status.pro=true;await act(async()=>render());expect(container.querySelector('[data-book]')).toBeTruthy();
});

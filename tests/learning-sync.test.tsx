// @vitest-environment happy-dom
import {act} from 'react';import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:{currentUser:{uid:'alice'} as {uid:string}|null},listener:null as null|((user:{uid:string}|null)=>void),request:vi.fn()}));
vi.mock('../src/lib/firebase',()=>({auth:mocks.auth}));vi.mock('firebase/auth',()=>({onAuthStateChanged:(_auth:unknown,listener:(user:{uid:string}|null)=>void)=>{mocks.listener=listener;return()=>{};}}));vi.mock('../src/lib/repository',()=>({apiRequest:mocks.request}));
import {useLearningProgress,readLearning,learningKey} from '../src/lib/learningProgress';
let root:Root,container:HTMLDivElement;
function Harness(){const progress=useLearningProgress('deck');return <><output>{JSON.stringify({ready:progress.ready,state:progress.ratings.get('word'),pending:progress.pending,error:progress.error})}</output><button onClick={()=>progress.rate('word','weak')}>weak</button><button onClick={()=>progress.rate('word','known')}>known</button></>;}
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();mocks.auth.currentUser={uid:'alice'};mocks.request.mockReset().mockResolvedValue({ratings:[],positions:[]});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();localStorage.clear();vi.useRealTimers();vi.unstubAllGlobals();});
const render=()=>act(async()=>root.render(<Harness/>));const click=(text:string)=>act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent===text)!.click());const state=()=>JSON.parse(container.querySelector('output')!.textContent!);
it('saves offline immediately, retains pending work after failure and retries it on reconnection',async()=>{
 mocks.request.mockRejectedValue(Error('offline'));await render();expect(state().ready).toBe(true);await click('weak');expect(readLearning(learningKey('alice','deck')).ratings[0].state).toBe('weak');
 await act(async()=>vi.advanceTimersByTimeAsync(600));expect(state().pending).toBe(1);expect(state().error).toBe('offline');
 mocks.request.mockImplementation(async(_path,options)=>options?.method==='POST'?{ok:true}:{ratings:[],positions:[]});await act(async()=>window.dispatchEvent(new Event('online')));expect(state().pending).toBe(0);expect(state().state).toBe('weak');
});
it('does not acknowledge a newer rating while an older request is still in flight',async()=>{
 await render();let finish!:(value:unknown)=>void;mocks.request.mockImplementation(async(_path,options)=>options?.method==='POST'?new Promise(resolve=>{finish=resolve;}):{ratings:[],positions:[]});
 await click('weak');await act(async()=>vi.advanceTimersByTimeAsync(600));await click('known');await act(async()=>finish({ok:true}));expect(state().state).toBe('known');expect(state().pending).toBe(1);expect(readLearning(learningKey('alice','deck')).pendingRatings[0].state).toBe('known');
});
it('keeps anonymous, Alice and Bob records separate and never posts Alice’s queue as Bob',async()=>{
 await render();await click('weak');mocks.request.mockClear();
 await act(async()=>{mocks.auth.currentUser={uid:'bob'};mocks.listener?.(mocks.auth.currentUser);});expect(state().state).toBeUndefined();expect(mocks.request.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
 await click('known');expect(readLearning(learningKey('bob','deck')).ratings[0].state).toBe('known');expect(readLearning(learningKey('alice','deck')).ratings[0].state).toBe('weak');
 await act(async()=>{mocks.auth.currentUser=null;mocks.listener?.(null);});expect(state().state).toBeUndefined();
});

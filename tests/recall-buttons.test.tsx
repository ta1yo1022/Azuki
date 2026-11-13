// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {RecallButtons} from '../src/components/RecallButtons';
import {useLearningProgress,readLearning,learningKey} from '../src/lib/learningProgress';
let container:HTMLDivElement,root:Root;
const parentClick=vi.fn();
function Harness(){const progress=useLearningProgress('recall',true);return <div onClick={parentClick}><RecallButtons wordId="word" progress={progress}/></div>;}
const button=(label:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent===label)!;
async function click(label:string){await act(async()=>button(label).click());}
beforeEach(async()=>{localStorage.clear();parentClick.mockClear();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);await act(async()=>root.render(<Harness/>));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('keeps the same rating on repeat clicks, shows the saved state, and clears only through the explicit action',async()=>{
 await click('覚えた');expect(button('覚えた').getAttribute('aria-pressed')).toBe('true');expect(container.querySelector('.recall-state-known')?.textContent).toBe('覚えたとして記録済み');
 const first=readLearning(learningKey('demo','recall')).ratings[0];
 await click('覚えた');expect(readLearning(learningKey('demo','recall')).ratings[0]).toEqual(first);
 await click('まだ苦手');expect(button('まだ苦手').getAttribute('aria-pressed')).toBe('true');expect(button('覚えた').getAttribute('aria-pressed')).toBe('false');
 expect(container.querySelector('.recall-state-weak')?.textContent).toBe('苦手として記録済み');
 await click('記録を解除');expect(container.querySelector('.recall-state')?.textContent).toBe('未評価');expect(button('記録を解除')).toBeUndefined();
 expect(readLearning(learningKey('demo','recall')).ratings[0].state).toBe('unseen');expect(parentClick).not.toHaveBeenCalled();
});

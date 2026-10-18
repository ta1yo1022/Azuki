// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {WordDetails} from '../src/components/WordDetails';
import type {Word} from '../shared/model';
let container:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const word:Word={id:'book',ordinal:0,word:'book',meaning:'本',example:'I borrowed a book from the library.',otherMeanings:['帳簿'],tags:['名詞','A1']};
it('separates the study meaning, its example and additional meanings',async()=>{
  await act(async()=>root.render(<WordDetails word={word}/>));
  expect(container.querySelector('[aria-label="代表的な意味"]')?.textContent).toContain('本');
  expect(container.querySelector('[aria-label="代表的な意味の例文"]')?.textContent).toContain(word.example);
  expect(container.querySelector('[aria-label="その他の意味"]')?.textContent).toContain('帳簿');
  expect(container.querySelector('[aria-label="代表的な意味"]')?.textContent).not.toContain('帳簿');
});
it('does not show an empty other meanings section and preserves legacy examples',async()=>{
  await act(async()=>root.render(<WordDetails word={{...word,otherMeanings:[]}}/>));
  expect(container.querySelector('[aria-label="その他の意味"]')).toBeNull();
  await act(async()=>root.render(<WordDetails word={{...word,otherMeanings:undefined}}/>));
  expect(container.querySelector('[aria-label="代表的な意味"]')).toBeNull();
  expect(container.querySelector('[aria-label="例文"]')?.textContent).toContain(word.example);
});

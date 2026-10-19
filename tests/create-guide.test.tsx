// @vitest-environment happy-dom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {CreateGuide,DECK_PROMPT,IMAGE_PROMPT} from '../src/components/CreateGuide';
import {parseDeck} from '../shared/model';
let container:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('provides importable translated examples in both AI prompts and the manual template',async()=>{
 for(const prompt of [DECK_PROMPT,IMAGE_PROMPT]) {
   const sample=JSON.parse(prompt.slice(prompt.indexOf('\n{')+1));
   const parsed=parseDeck(JSON.stringify({...sample,title:'ガイドのサンプル'}));
   expect(parsed.words[0].examples?.[0].translation).toBeTruthy();
   expect(prompt).toContain('1語あたりの例文数：3件');
 }
 await act(async()=>root.render(<MemoryRouter initialEntries={['/guide/create?mode=demo']}><CreateGuide/></MemoryRouter>));
 const template=container.querySelector<HTMLTextAreaElement>('#example-json')!.value;
 const parsed=parseDeck(JSON.stringify({...JSON.parse(template),title:'自作の単語帳'}));
 expect(parsed.words[0].examples).toHaveLength(2);
 expect(parsed.words.every(word=>word.examples?.every(example=>example.translation))).toBe(true);
 expect(container.querySelector('a[href="/library/import?tab=paste"]')).toBeTruthy();
 expect(container.textContent).toContain('お気に入りに登録');
 expect(container.textContent).toContain('例文カードは日本語訳付き');
});
it('switches between the image and word prompts',async()=>{
 await act(async()=>root.render(<MemoryRouter><CreateGuide/></MemoryRouter>));
 const click=async(text:string)=>act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent?.includes(text))!.click());
 await click('画像から作る');
 expect(container.querySelector<HTMLTextAreaElement>('#deck-prompt')!.value).toBe(IMAGE_PROMPT);
 await click('学びたい単語から作る');
 expect(container.querySelector<HTMLTextAreaElement>('#deck-prompt')!.value).toBe(DECK_PROMPT);
});

// @vitest-environment happy-dom
import {encodeJson,decodeJson} from '../shared/json';
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
   const sample=decodeJson(prompt.slice(prompt.indexOf('\n{')+1)) as object;
   const parsed=parseDeck(JSON.stringify({...sample,title:'ガイドのサンプル'}));
   expect(parsed.words[0].examples?.[0].translation).toBeTruthy();
   expect(prompt).toContain('1語あたりの例文数：3件');
 }
 await act(async()=>root.render(<MemoryRouter initialEntries={['/guide/create?mode=demo']}><CreateGuide/></MemoryRouter>));
 const template=container.querySelector<HTMLTextAreaElement>('#example-json')!.value;
 const parsed=parseDeck(JSON.stringify({...decodeJson(template) as object,title:'自作の単語帳'}));
 expect(parsed.words[0].examples).toHaveLength(2);
 expect(parsed.words.every(word=>word.examples?.every(example=>example.translation))).toBe(true);
 expect(container.querySelector('a[href="/library/import?tab=json"]')).toBeTruthy();
 expect(container.textContent).not.toMatch(/toon/i);
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
it('demonstrates safely quoted comma and quotation-mark examples across every guide language',async()=>{
 const {localizedGuidePrompt}=await import('../src/lib/guidePrompts');
 const {readCreationJson}=await import('../src/lib/importWords');
 await act(async()=>root.render(<MemoryRouter><CreateGuide/></MemoryRouter>));
 const template=container.querySelector<HTMLTextAreaElement>('#example-json')!.value;
 for(const language of ['ja','en','th','zh'] as const){
  for(const [kind,japanese] of [['words',DECK_PROMPT],['image',IMAGE_PROMPT]] as const){
   const prompt=localizedGuidePrompt(language,kind,japanese,template);
   expect(prompt).toContain('JSON');expect(prompt).not.toContain('words[53]');
   const raw=prompt.slice(prompt.indexOf('\n{')+1);
   const result=readCreationJson(raw);expect(result.kind).toBe('complete');
   if(result.kind==='complete')expect(result.words[0].examples?.[0].text).toContain(',');
  }
 }
 const result=readCreationJson(template);expect(result.kind).toBe('complete');
 if(result.kind==='complete')expect(result.words[0].examples?.[1].text).toContain('"I discovered a hidden door."');
 const inline=container.querySelector('.guide-json-checks pre code')!.textContent!;
 expect(decodeJson(inline)).toEqual({text:'She said, "Hello!"',translation:'彼女は「こんにちは！」と言いました。'});
});

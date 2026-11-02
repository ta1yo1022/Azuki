// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {LandingPage} from '../src/components/LandingPage';
import {PageMetadata} from '../src/components/PageMetadata';
import {detectSiteLanguage,resolveSiteLanguage,SITE_LANGUAGE_KEY} from '../shared/siteLocale';
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();vi.spyOn(navigator,'languages','get').mockReturnValue(['ja-JP']);document.documentElement.lang='ja';container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();});
async function render(){await act(async()=>root.render(<MemoryRouter><LandingPage canSignIn signingIn={false} error="" onLogin={()=>{}}/><PageMetadata/></MemoryRouter>));}
async function choose(value:string){await act(async()=>{const select=container.querySelector('select') as unknown as HTMLSelectElement;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(select,value);select.dispatchEvent(new Event('change',{bubbles:true}));});}
it('detects supported browser locales and honors an explicit preference',()=>{
 expect(detectSiteLanguage(['th-TH','en-US'])).toBe('th');expect(detectSiteLanguage(['zh-Hant-TW'])).toBe('zh');expect(detectSiteLanguage(['fr-FR','ja-JP'])).toBe('ja');expect(detectSiteLanguage(['de-DE'])).toBe('en');expect(resolveSiteLanguage('zh',['th-TH'])).toBe('zh');
});
it('shows Thai on first visit and updates document language and metadata',async()=>{
 vi.spyOn(navigator,'languages','get').mockReturnValue(['th-TH']);await render();
 expect(container.querySelector('h1')?.textContent).toContain('เรียนรู้ในแบบของคุณ');expect(document.documentElement.lang).toBe('th');expect(document.title).toContain('เรียนรู้');expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('เพิ่มคำศัพท์');
 expect(container.textContent).toContain('เข้าสู่ระบบด้วย Google');
});
it('switches immediately, remembers the selection and restores automatic mode',async()=>{
 await render();await choose('zh');expect(container.querySelector('h1')?.textContent).toContain('学习想学的语言');expect(document.documentElement.lang).toBe('zh');expect(localStorage.getItem(SITE_LANGUAGE_KEY)).toBe('zh');
 await act(async()=>root.unmount());root=createRoot(container);await render();expect(container.querySelector('h1')?.textContent).toContain('学习想学的语言');
 await choose('auto');expect(localStorage.getItem(SITE_LANGUAGE_KEY)).toBeNull();expect(container.textContent).toContain('Googleでログイン');
});
it('keeps language switching usable when browser storage is blocked',async()=>{
 await render();vi.spyOn(localStorage,'setItem').mockImplementation(()=>{throw Error('blocked');});await choose('en');
 expect(container.querySelector('h1')?.textContent).toContain('Your words.');expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not save');expect(document.documentElement.lang).toBe('en');
});
it('responds to a browser language change in automatic mode',async()=>{
 await render();vi.spyOn(navigator,'languages','get').mockReturnValue(['zh-CN']);await act(async()=>window.dispatchEvent(new Event('languagechange')));expect(container.textContent).toContain('使用 Google 登录');
});

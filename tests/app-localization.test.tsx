// @vitest-environment happy-dom
import {act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {SettingsPage} from '../src/components/SettingsPage';
import {DeckMetadataFields,type MetadataFields} from '../src/components/DeckMetadataFields';
import {SiteLanguageSelect} from '../src/components/SiteLanguageSelect';
import {LegalPage} from '../src/components/LegalPage';
import {PageMetadata} from '../src/components/PageMetadata';
import {InterfaceLanguage,translate} from '../src/lib/i18n';
import messages from '../src/lib/translations.json';
import {SITE_LANGUAGE_KEY} from '../shared/siteLocale';
vi.mock('../src/lib/firebase',()=>({auth:null,googleSignIn:vi.fn()}));
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();localStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function mount(children:React.ReactNode,path='/'){await act(async()=>root.render(<MemoryRouter initialEntries={[path]}><InterfaceLanguage/>{children}</MemoryRouter>));}
async function choose(value:string){await act(async()=>{const select=container.querySelector('.site-language-control select') as unknown as HTMLSelectElement;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(select,value);select.dispatchEvent(new Event('change',{bubbles:true}));});}
it('translates Settings automatically and preserves a pending preference when changing language',async()=>{
 vi.spyOn(navigator,'languages','get').mockReturnValue(['th-TH']);
 await mount(<SettingsPage demo onClose={()=>{}}/>,'/library/settings');
 expect(container.querySelector('h1')?.textContent).toBe('ตั้งค่า');expect(document.documentElement.lang).toBe('th');
 const checkbox=container.querySelector('.study-skip-setup input') as unknown as HTMLInputElement;
 await act(async()=>checkbox.click());const checked=checkbox.checked;await choose('en');
 expect(container.querySelector('h1')?.textContent).toBe('Settings');expect(checkbox.checked).toBe(checked);expect(container.textContent).toContain('Save settings');
 expect(container.textContent).not.toContain('remain in Japanese');expect(document.documentElement.lang).toBe('en');
});
function MetadataForm(){const [value,setValue]=useState<MetadataFields>({title:'旅行の単語',description:'私の説明',category:'旅行',textbookName:'',edition:'',language:'th',meaningLanguage:'ja'});return <><SiteLanguageSelect/><DeckMetadataFields value={value} onChange={setValue} prefix="test"/><output>{JSON.stringify(value)}</output></>;}
it('translates form labels and categories while keeping saved values and wordbook content intact',async()=>{
 await mount(<MetadataForm/>);await choose('zh');
 expect(container.textContent).toContain('词本名称');expect(container.textContent).toContain('泰语');
 const category=container.querySelector('#test-category') as unknown as HTMLSelectElement;expect(category.value).toBe('旅行');expect(category.selectedOptions[0].textContent).toBe('旅行');
 expect((container.querySelector('#test-title-input') as unknown as HTMLInputElement).value).toBe('旅行の単語');expect(container.querySelector('output')?.textContent).toContain('私の説明');
 await choose('en');expect(category.value).toBe('旅行');expect(category.selectedOptions[0].textContent).toBe('Travel');
});
it.each(['privacy','terms','copyright','commerce'] as const)('translates the full %s page',async kind=>{
 localStorage.setItem(SITE_LANGUAGE_KEY,'en');await mount(<><LegalPage kind={kind}/><PageMetadata/></>,'/'+kind);
 expect(container.querySelector('h1')?.textContent).not.toMatch(/[ぁ-んァ-ヶ一-龯]/);expect(container.querySelector('main')?.textContent).not.toMatch(/[ぁ-んァ-ヶ一-龯]/);expect(document.title).not.toMatch(/[ぁ-んァ-ヶ一-龯]/);expect(document.head.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe('en_US');
});
it('localizes API errors with amounts, and nested validation field labels',()=>{
 expect(translate('en','本日の単語音声の新規生成は10個までです。生成済みの音声は再生できます。')).toContain('10');
 expect(translate('en','2語目の単語を入力してください。')).toBe('Enter Word 2.');
 expect(translate('zh','TOONは512KB以内にしてください。')).toBe('TOON 不能超过 512 KB。');
 expect(translate('en','リンクをコピーしました')).toBe('Link copied');
});
it('keeps placeholder arguments literal, including user text that resembles translation keys',()=>{
 expect(translate('en','「{0}」に{1}語を登録しました','設定',2)).toBe('Added 2 words to “設定”');
 expect(translate('en','{0}語', '$&{1}')).toBe('$&{1} words');
});
it('has all three translations and preserves every interpolation slot',()=>{
 for(const [source,translations] of Object.entries(messages)){expect(translations).toHaveLength(3);const slots=[...new Set(source.match(/\{\d+\}/g)||[])].sort();for(const translated of translations){expect(translated.trim(),source).not.toBe('');expect([...new Set(translated.match(/\{\d+\}/g)||[])].sort(),source).toEqual(slots);}}
});

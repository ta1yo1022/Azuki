// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useStudyTracking,demoStudySummary,syncStudy} from '../src/lib/studyTracking';
import {StudyStatsPage} from '../src/components/StudyStatsPage';
import {summarizeStudy} from '../shared/studyStats';
const mocks=vi.hoisted(()=>({record:vi.fn(),summary:vi.fn(),user:null as null|{uid:string}}));
vi.mock('../src/lib/firebase',()=>({auth:{get currentUser(){return mocks.user;}}}));
vi.mock('firebase/auth',()=>({onAuthStateChanged:(_:unknown,callback:Function)=>{callback(mocks.user);return()=>{};}}));
vi.mock('../src/lib/repository',()=>({studyRepository:mocks}));
const deck={id:'book',title:'旅行の単語',schemaVersion:1 as const,description:'',wordCount:1,textbookTags:[],createdAt:'',updatedAt:'',visibility:'public' as const};
let root:Root,container:HTMLDivElement;
function Probe({enabled=true,demo=true}:{enabled?:boolean;demo?:boolean}){useStudyTracking(deck,'words',enabled,demo);return null;}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T12:00:00+09:00'));localStorage.clear();vi.clearAllMocks();mocks.user=null;mocks.record.mockResolvedValue({ok:true});mocks.summary.mockResolvedValue(summarizeStudy([]));vi.spyOn(document,'hasFocus').mockReturnValue(true);vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('records active demo learning locally, pauses on blur, and does not count setup time',async()=>{
 await act(async()=>root.render(<Probe enabled={false}/>));await act(async()=>vi.advanceTimersByTime(20000));expect(demoStudySummary().totalMilliseconds).toBe(0);
 await act(async()=>root.render(<Probe/>));await act(async()=>vi.advanceTimersByTime(20000));
 expect(demoStudySummary().totalMilliseconds).toBe(15000);expect(demoStudySummary().totalSessions).toBe(1);
 vi.mocked(document.hasFocus).mockReturnValue(false);await act(async()=>window.dispatchEvent(new Event('blur')));await act(async()=>vi.advanceTimersByTime(30000));
 expect(demoStudySummary().totalMilliseconds).toBe(20000);expect(mocks.record).not.toHaveBeenCalled();
});
it('retries a durable cloud event with the same id after a network failure',async()=>{
 mocks.user={uid:'alice'};mocks.record.mockRejectedValueOnce(new Error('offline'));
 await act(async()=>root.render(<Probe demo={false}/>));await act(async()=>vi.advanceTimersByTime(15000));
 const first=mocks.record.mock.calls[0][0][0];expect(first.deckId).toBe('book');
 await act(async()=>syncStudy('alice'));expect(mocks.record.mock.calls[1][0][0].id).toBe(first.id);
 expect(JSON.parse(localStorage.getItem('azuki.study.v1.pending.alice')!)).toEqual([]);
});
it('shows an empty statistics page and an actionable retry after failure',async()=>{
 await act(async()=>root.render(<MemoryRouter><StudyStatsPage demo/></MemoryRouter>));expect(container.textContent).toContain('最初の学習を記録しよう');expect(container.querySelectorAll('.stats-chart li')).toHaveLength(7);
 await act(async()=>root.render(<MemoryRouter><StudyStatsPage userId="alice"/></MemoryRouter>));
 mocks.summary.mockRejectedValueOnce(new Error('接続できませんでした'));
 await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='再読み込み')!.click());
 expect(container.querySelector('[role="alert"]')?.textContent).toContain('接続できませんでした');
});

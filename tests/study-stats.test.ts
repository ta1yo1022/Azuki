import {expect,it,vi} from 'vitest';
vi.mock('../src/lib/firebase',()=>({auth:null}));
import {ActiveStudyClock} from '../src/lib/studyTracking';
import {studyDay,studyParts,summarizeStudy,type StudyRecord} from '../shared/studyStats';
it('splits time at Japanese midnight and counts sessions without duplicating heartbeats',()=>{
 const start=Date.parse('2026-10-19T23:59:50+09:00'),end=start+20000;
 const event={id:'event',sessionId:'session',deckId:'deck',mode:'words' as const,start,end};
 const parts=studyParts(event);expect(parts).toEqual([{day:'2026-10-19',milliseconds:10000},{day:'2026-10-20',milliseconds:10000}]);
 const records:StudyRecord[]=parts.map(part=>({...event,...part,title:'旅行'}));
 const result=summarizeStudy(records,end);expect(result.totalSessions).toBe(1);expect(result.totalMilliseconds).toBe(20000);expect(result.days).toHaveLength(7);expect(result.decks[0]).toMatchObject({sessions:1,milliseconds:20000});expect(studyDay(end)).toBe('2026-10-20');
});
it('pauses at 90 seconds of inactivity and excludes hidden, blurred, or suspended intervals',()=>{
 const clock=new ActiveStudyClock(0);let elapsed=0;
 for(let now=5000;now<=100000;now+=5000){const sample=clock.sample(now,true,true);if(sample)elapsed+=sample.end-sample.start;}
 expect(elapsed).toBe(90000);clock.interact(100000);expect(clock.sample(105000,true,true)).toEqual({start:100000,end:105000});
 expect(clock.sample(110000,false,true)).toBeNull();expect(clock.sample(115000,true,true)).toBeNull();expect(clock.sample(120000,true,true)).toEqual({start:115000,end:120000});
 expect(clock.sample(125000,true,false)).toBeNull();expect(clock.sample(130000,true,true)).toBeNull();expect(clock.sample(180000,true,true)).toBeNull();
});
it('excludes records outside seven days and ranks by sessions then time',()=>{
 const now=Date.parse('2026-10-20T12:00:00+09:00');const record=(sessionId:string,deckId:string,day:string,milliseconds:number):StudyRecord=>({id:sessionId,sessionId,deckId,title:deckId,mode:'book',start:now,end:now+milliseconds,day,milliseconds});
 const summary=summarizeStudy([record('s1','a','2026-10-20',3000),record('s1','a','2026-10-20',3000),record('s2','a','2026-10-20',3000),record('s3','b','2026-10-20',20000),record('old','c','2026-10-13',10000)],now);
 expect(summary.decks.map(deck=>deck.id)).toEqual(['a','b']);expect(summary.totalSessions).toBe(3);expect(summary.totalMilliseconds).toBe(29000);
});

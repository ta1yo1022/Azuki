export type StudyMode = 'words' | 'examples' | 'book';
export type StudyEvent = {id:string;sessionId:string;deckId:string;mode:StudyMode;start:number;end:number};
export type StudyRecord = StudyEvent & {day:string;milliseconds:number;title:string};
export type StudySummary = {today:string;days:{day:string;milliseconds:number;sessions:number}[];decks:{id:string;title:string;milliseconds:number;sessions:number}[];totalMilliseconds:number;totalSessions:number};
export const studyDay=(time:number)=>new Date(time+9*3600000).toISOString().slice(0,10);
export function studyParts(event:StudyEvent):{day:string;milliseconds:number}[]{
 const result=[];let cursor=event.start;
 while(cursor<event.end){const day=studyDay(cursor),boundary=Date.parse(`${day}T00:00:00+09:00`)+86400000,end=Math.min(boundary,event.end);result.push({day,milliseconds:end-cursor});cursor=end;}
 return result;
}
export function summarizeStudy(records:StudyRecord[],now=Date.now()):StudySummary{
 const today=studyDay(now),days=Array.from({length:7},(_,i)=>({day:studyDay(now-(6-i)*86400000),milliseconds:0,sessions:0}));
 const chosen=records.filter(record=>record.day>=days[0].day&&record.day<=today),decks=new Map<string,StudySummary['decks'][number]>();
 for(const day of days){const matching=chosen.filter(record=>record.day===day.day);day.milliseconds=matching.reduce((sum,record)=>sum+record.milliseconds,0);day.sessions=new Set(matching.map(record=>record.sessionId)).size;}
 for(const record of chosen){const entry=decks.get(record.deckId)??{id:record.deckId,title:record.title,milliseconds:0,sessions:0};entry.title=record.title;entry.milliseconds+=record.milliseconds;decks.set(record.deckId,entry);}
 for(const deck of decks.values())deck.sessions=new Set(chosen.filter(record=>record.deckId===deck.id).map(record=>record.sessionId)).size;
 return {today,days,decks:[...decks.values()].sort((a,b)=>b.sessions-a.sessions||b.milliseconds-a.milliseconds),totalMilliseconds:days.reduce((sum,day)=>sum+day.milliseconds,0),totalSessions:new Set(chosen.map(record=>record.sessionId)).size};
}

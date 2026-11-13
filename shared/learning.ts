export type Recall='known'|'weak'|'unseen';
export type LearningMode='words'|'examples'|'book';
export type RecallRecord={wordId:string;state:Recall;updatedAt:number;review?:ReviewSchedule};
export type LearningPosition={mode:LearningMode;wordId:string;ordinal:number;page:number;order:'ordered'|'shuffle';seed:number;weakOnly:boolean;completed:boolean;updatedAt:number;reviewOnly?:boolean;reviewSession?:ReviewSession};
export type LearningData={ratings:RecallRecord[];positions:LearningPosition[]};
export const emptyLearning=():LearningData=>({ratings:[],positions:[]});
export const baseWordId=(id:string)=>id.split(':example:')[0];
export function mergeLearning(local:LearningData,remote:LearningData):LearningData{
 const merge=<T extends {updatedAt:number}>(a:T[],b:T[],key:(value:T)=>string)=>{const result=new Map<string,T>();for(const item of [...a,...b]){const old=result.get(key(item));if(!old||item.updatedAt>old.updatedAt)result.set(key(item),item);}return [...result.values()];};
 return {ratings:merge(local.ratings,remote.ratings,item=>item.wordId),positions:merge(local.positions,remote.positions,item=>item.mode)};
}
export function shuffleLearning<T extends {id:string}>(items:T[],seed:number):T[]{
 const hash=(id:string)=>{let h=seed|0;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
 return [...items].sort((a,b)=>hash(a.id)-hash(b.id)||a.id.localeCompare(b.id));
}

export const REVIEW_DAYS=[1,3,7,14,30,60,90] as const;
export type ReviewSchedule={step:number;dueAt:number};
export type ReviewPending={wordId:string;remaining:number};
export type ReviewSession={pending:ReviewPending[];activeId:string;cursorId:string;cursorOrdinal:number};
export function validReview(value:unknown,state:Recall):value is ReviewSchedule{
 if(!value||typeof value!=='object')return false;const r=value as ReviewSchedule;
 return Number.isInteger(r.step)&&r.step>=(state==='weak'?-1:0)&&r.step<REVIEW_DAYS.length&&(state!=='weak'||r.step===-1)&&state!=='unseen'&&Number.isSafeInteger(r.dueAt)&&r.dueAt>0;
}
export function scheduleRecall(previous:RecallRecord|undefined,state:Recall,now:number):ReviewSchedule|undefined{
 if(state==='unseen')return undefined;
 if(state==='weak')return {step:-1,dueAt:now};
 if(previous?.state==='known'&&previous.review&&previous.review.dueAt>now)return previous.review;
 const step=Math.min((previous?.review?.step??-1)+1,REVIEW_DAYS.length-1);
 return {step,dueAt:now+REVIEW_DAYS[step]*86400000};
}
export function isReviewDue(record:RecallRecord|undefined,now:number){return !!record&&(record.state==='weak'||!!record.review&&record.review.dueAt<=now);}
// Three other cards must be shown before a missed card returns. No duplicate word siblings.
export function advanceReview(pending:ReviewPending[],wordId:string,state?:'known'|'weak'){
 const next=pending.filter(item=>!state||baseWordId(item.wordId)!==baseWordId(wordId)).map(item=>({...item,remaining:Math.max(0,item.remaining-1)}));
 if(state==='weak')next.push({wordId,remaining:3});
 return next;
}
export function validReviewSession(value:unknown):value is ReviewSession{
 if(!value||typeof value!=='object')return false;const s=value as ReviewSession;
 const id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,120}(?::example:[0-9])?$/.test(v);
 return Array.isArray(s.pending)&&s.pending.length<=8&&s.pending.every(p=>p&&id(p.wordId)&&Number.isInteger(p.remaining)&&p.remaining>=0&&p.remaining<=3)&&new Set(s.pending.map(p=>baseWordId(p.wordId))).size===s.pending.length&&(s.activeId===''||id(s.activeId))&&(s.cursorId===''||id(s.cursorId))&&Number.isSafeInteger(s.cursorOrdinal)&&s.cursorOrdinal>=0;
}

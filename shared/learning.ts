export type Recall='known'|'weak'|'unseen';
export type LearningMode='words'|'examples'|'book';
export type RecallRecord={wordId:string;state:Recall;updatedAt:number};
export type LearningPosition={mode:LearningMode;wordId:string;ordinal:number;page:number;order:'ordered'|'shuffle';seed:number;weakOnly:boolean;completed:boolean;updatedAt:number};
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

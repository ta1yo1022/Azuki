export type StudyFilter='all'|'weak'|'due';
export function studyFilterFromSearch(search:string):StudyFilter{
 const value=new URLSearchParams(search).get('filter');return value==='weak'||value==='due'?value:'all';
}

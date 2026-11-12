import {it,expect} from 'vitest';
import {baseWordId,mergeLearning,shuffleLearning} from '../shared/learning';
it('merges offline changes per word and per mode without overwriting newer changes',()=>{
 const local={ratings:[{wordId:'w',state:'known' as const,updatedAt:20}],positions:[]};const remote={ratings:[{wordId:'w',state:'weak' as const,updatedAt:10},{wordId:'other',state:'weak' as const,updatedAt:30}],positions:[]};
 expect(mergeLearning(local,remote).ratings).toEqual([local.ratings[0],remote.ratings[1]]);expect(baseWordId('w:example:2')).toBe('w');
});
it('uses a reproducible shuffle when resuming and keeps each card exactly once',()=>{
 const words=Array.from({length:100},(_,i)=>({id:'w'+i}));const first=shuffleLearning(words,42);expect(shuffleLearning([...words].reverse(),42)).toEqual(first);expect(new Set(first.map(w=>w.id)).size).toBe(100);expect(shuffleLearning(words,732)).not.toEqual(first);
});

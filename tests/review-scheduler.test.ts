import {expect,it} from 'vitest';
import {scheduleRecall,isReviewDue,advanceReview,validReviewSession,type RecallRecord} from '../shared/learning';
const day=86400000,now=1800000000000;
it('graduates 1, 3, 7 days up to 90, ignores early repeats and resets forgotten words',()=>{
 let record:RecallRecord={wordId:'w',state:'known',updatedAt:now,review:scheduleRecall(undefined,'known',now)};
 expect(record.review).toEqual({step:0,dueAt:now+day});expect(isReviewDue(record,now)).toBe(false);
 expect(scheduleRecall(record,'known',now+1000)).toEqual(record.review);
 for(const days of [3,7,14,30,60,90,90]){const at=record.review!.dueAt;expect(isReviewDue(record,at)).toBe(true);record={...record,review:scheduleRecall(record,'known',at)};expect(record.review!.dueAt-at).toBe(days*day);}
 const missed={...record,state:'weak' as const,review:scheduleRecall(record,'weak',now)};expect(missed.review).toEqual({step:-1,dueAt:now});expect(isReviewDue(missed,now)).toBe(true);
 expect(scheduleRecall(missed,'known',now)).toEqual({step:0,dueAt:now+day});expect(scheduleRecall(record,'unseen',now)).toBeUndefined();
 expect(isReviewDue({wordId:'legacy',state:'weak',updatedAt:1},now)).toBe(true);
});
it('waits three intervening cards, deduplicates sibling examples, and removes recovered words',()=>{
 let queue=advanceReview([],'w:example:0','weak');expect(queue[0].remaining).toBe(3);
 queue=advanceReview(queue,'a');expect(queue[0].remaining).toBe(2);queue=advanceReview(queue,'b');expect(queue[0].remaining).toBe(1);queue=advanceReview(queue,'c');expect(queue[0].remaining).toBe(0);
 queue=advanceReview(queue,'w:example:1','weak');expect(queue).toEqual([{wordId:'w:example:1',remaining:3}]);expect(advanceReview(queue,'w:example:0','known')).toEqual([]);
});
it('bounds persisted queues and validates every ID and countdown',()=>{
 const session={pending:[{wordId:'w',remaining:2}],activeId:'',cursorId:'b',cursorOrdinal:2};expect(validReviewSession(session)).toBe(true);
 expect(validReviewSession({...session,pending:Array(9).fill(session.pending[0])})).toBe(false);
 expect(validReviewSession({...session,pending:[{wordId:'w',remaining:4}]})).toBe(false);
 expect(validReviewSession({...session,pending:[{wordId:'w',remaining:0},{wordId:'w:example:1',remaining:1}]})).toBe(false);
});

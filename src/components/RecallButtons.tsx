import {Check,Circle,RotateCcw,RotateCw} from 'lucide-react';
import {useI18n,locale} from '../lib/i18n';
import {baseWordId} from '../../shared/learning';
import type {LearningProgress} from '../lib/learningProgress';
export function RecallButtons({wordId,progress,answerVisible=true,onReveal,onEvaluate,onClear}:{
 wordId:string;progress:LearningProgress;answerVisible?:boolean;onReveal?:()=>void;
 onEvaluate?:(state:'known'|'weak')=>void;onClear?:()=>void;
}){
 const t=useI18n(),state=progress.ratings.get(baseWordId(wordId))??'unseen';
 function evaluate(value:'known'|'weak'){
  // Repeating the same choice keeps the record. Clearing is a separate action.
  if(onEvaluate)onEvaluate(value);
  else if(state!==value)progress.rate(wordId,value);
 }
 return <section className={`recall-control${onEvaluate?' recall-control-session':''}`} aria-label={t('覚えたかどうかを記録')}>
  <div className="recall-current">
   <span className={`recall-state recall-state-${state}`}><span aria-hidden="true">{state==='known'?<Check size={15}/>:state==='weak'?<RotateCcw size={15}/>:<Circle size={13}/>}</span>{t(state==='known'?'覚えたとして記録済み':state==='weak'?'苦手として記録済み':'未評価')}</span>
   {state==='known'&&progress.records.get(baseWordId(wordId))?.review&&<small className="recall-next-review">{t('次の復習：{0}',new Date(progress.records.get(baseWordId(wordId))!.review!.dueAt).toLocaleDateString(locale(),{month:'short',day:'numeric'}))}</small>}
   {state!=='unseen'&&<button type="button" className="text-button recall-clear" disabled={!progress.ready} onClick={event=>{event.stopPropagation();progress.rate(wordId,'unseen');onClear?.();}}>{t('記録を解除')}</button>}
  </div>
  <div className="recall-buttons" role="group" aria-label={t('覚えたかどうかを記録')}>
   {answerVisible?<>
    <button type="button" className="recall-choice recall-weak" aria-pressed={state==='weak'} disabled={!progress.ready} onClick={event=>{event.stopPropagation();evaluate('weak');}}><RotateCcw size={20}/><span>{t('まだ苦手')}{onEvaluate&&<small>{t('記録して次へ')}</small>}</span></button>
    <button type="button" className="recall-choice recall-known" aria-pressed={state==='known'} disabled={!progress.ready} onClick={event=>{event.stopPropagation();evaluate('known');}}><Check size={20}/><span>{t('覚えた')}{onEvaluate&&<small>{t('記録して次へ')}</small>}</span></button>
   </>:<button type="button" className="button primary recall-reveal" disabled={!progress.ready} onClick={onReveal}>{t('答えを見る')}<RotateCw size={18}/></button>}
  </div>
 </section>;
}
export function LearningSaveStatus({progress}:{progress:LearningProgress}){const t=useI18n();return <p className="learning-save-status" role="status">{progress.error?<>{t(progress.error)} {t('このブラウザの記録は、接続後に再び同期します。')}<button className="text-button" onClick={()=>void progress.retry()}>{t('再試行')}</button></>:!progress.ready?t('学習記録を確認しています…'):progress.syncing||progress.cloud&&progress.pending?t('自動保存中…'):progress.cloud?t('自動保存済み'):t('このブラウザに自動保存しています')}</p>;}

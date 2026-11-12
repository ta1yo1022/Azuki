import {useI18n} from '../lib/i18n';
import {baseWordId} from '../../shared/learning';
import type {LearningProgress} from '../lib/learningProgress';
export function RecallButtons({wordId,progress}:{wordId:string;progress:LearningProgress}){
 const t=useI18n(),state=progress.ratings.get(baseWordId(wordId));
 return <div className="recall-buttons" role="group" aria-label={t('覚えたかどうかを記録')}>
  <button type="button" className="button secondary" aria-pressed={state==='weak'} disabled={!progress.ready} onClick={event=>{event.stopPropagation();progress.rate(wordId,state==='weak'?'unseen':'weak');}}>{t('まだ苦手')}</button>
  <button type="button" className="button secondary" aria-pressed={state==='known'} disabled={!progress.ready} onClick={event=>{event.stopPropagation();progress.rate(wordId,state==='known'?'unseen':'known');}}>{t('覚えた')}</button>
 </div>;
}
export function LearningSaveStatus({progress}:{progress:LearningProgress}){const t=useI18n();return <p className="learning-save-status" role="status">{progress.error?<>{t(progress.error)} {t('このブラウザの記録は、接続後に再び同期します。')}<button className="text-button" onClick={()=>void progress.retry()}>{t('再試行')}</button></>:!progress.ready?t('学習記録を確認しています…'):progress.syncing||progress.cloud&&progress.pending?t('自動保存中…'):progress.cloud?t('自動保存済み'):t('このブラウザに自動保存しています')}</p>;}

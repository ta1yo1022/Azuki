import {useI18n} from '../lib/i18n';
export type ReviewPreferences={repeatMissed:boolean;useReviewSchedule:boolean;showRecall:boolean};
export function ReviewSettings({value,onChange,disabled=false}:{value:ReviewPreferences;onChange:(value:ReviewPreferences)=>void;disabled?:boolean}){
 const t=useI18n();
 return <fieldset className="review-settings-fields" disabled={disabled}>
  <legend className="visually-hidden">{t('復習の設定')}</legend>
  <label className="study-repeat-toggle"><input type="checkbox" name="showRecall" checked={value.showRecall} onChange={event=>onChange({...value,showRecall:event.target.checked})}/>{t('覚えた・まだ苦手ボタンを表示')}</label>
  <p className="review-settings-note">{t('非表示でも学習位置と過去の記録は残ります。学習中の再出題は止まります。')}</p>
  <label className="study-repeat-toggle"><input type="checkbox" name="repeatMissed" disabled={!value.showRecall} checked={value.repeatMissed} onChange={event=>onChange({...value,repeatMissed:event.target.checked})}/>{t('苦手な単語を3枚あとに再出題')}</label>
  <label className="study-repeat-toggle"><input type="checkbox" name="useReviewSchedule" checked={value.useReviewSchedule} onChange={event=>onChange({...value,useReviewSchedule:event.target.checked})}/>{t('翌日以降の復習予定を使う')}</label>
  <p className="review-settings-note">{t('オフにしても「まだ苦手」の記録は残ります。復習予定をオフにすると、新しい予定は作りません。')}</p>
 </fieldset>;
}

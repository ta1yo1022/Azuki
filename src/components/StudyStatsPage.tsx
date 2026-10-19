import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock3, BookOpen, BarChart3 } from 'lucide-react';
import { studyRepository } from '../lib/repository';
import { demoStudySummary, syncStudy } from '../lib/studyTracking';
import type { StudySummary } from '../../shared/studyStats';
import { LegalLinks } from './LegalPage';
export function studyDuration(milliseconds:number){const seconds=Math.floor(milliseconds/1000);if(seconds<60)return `${seconds}秒`;const minutes=Math.floor(seconds/60);return minutes>=60?`${Math.floor(minutes/60)}時間${minutes%60}分`:`${minutes}分`;}
function useStudySummary(demo:boolean,userId?:string){
 const [data,setData]=useState<StudySummary|null>(null),[error,setError]=useState(''),[note,setNote]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);

 useEffect(()=>{let active=true;setLoading(true);setError('');setNote('');setData(null);
  (async()=>{try{if(!demo&&userId)try{await syncStudy(userId);}catch{if(active)setNote('未同期の学習記録があります。通信が戻ったら再読み込みしてください。');}const summary=demo?demoStudySummary():await studyRepository.summary();if(active)setData(summary);}catch(e){if(active)setError(e instanceof Error?e.message:'学習統計を取得できませんでした。');}finally{if(active)setLoading(false);}})();return()=>{active=false;};
 },[demo,userId,retry]);
 return {data,error,note,loading,refresh:()=>setRetry(value=>value+1)};
}
export function StudyStatsSummary({demo=false,userId}:{demo?:boolean;userId?:string}){
 const {data,error,loading}=useStudySummary(demo,userId);
 const today=data?.days.find(day=>day.day===data.today);
 return <section className="stats-mini" aria-label="学習統計の概要">
  <span className="stats-mini-label"><BarChart3 size={18}/>学習の記録</span>
  {loading?<span role="status">読み込み中…</span>:error?<span>記録を取得できませんでした</span>:<><span>今日 <strong>{studyDuration(today?.milliseconds??0)}</strong></span><span>直近7日間 <strong>{studyDuration(data?.totalMilliseconds??0)}</strong></span></>}
  <Link className="text-button" to={`${demo?'/demo':'/library'}/stats`}>詳しく見る →</Link>
 </section>;
}
export function StudyStatsPage({demo=false,userId,embedded=false}:{demo?:boolean;userId?:string;embedded?:boolean}){
 const {data,error,note,loading,refresh}=useStudySummary(demo,userId);
 const [sort,setSort]=useState<'sessions'|'time'>('sessions');
 const base=demo?'/demo':'/library';
 useEffect(()=>{const previous=document.title;document.title='学習統計 — Azuki';return()=>{document.title=previous;};},[]);
 const today=data?.days.find(day=>day.day===data.today),maximum=Math.max(60000,...(data?.days.map(day=>day.milliseconds)??[]));
 const ranked=[...(data?.decks??[])].sort((a,b)=>sort==='time'?b.milliseconds-a.milliseconds||b.sessions-a.sessions:b.sessions-a.sessions||b.milliseconds-a.milliseconds);
 return <div className={embedded?"stats-embedded":"study-page stats-page"}>{!embedded&&<header className="study-header"><Link className="text-button study-back" to={base}><ArrowLeft size={20}/>ライブラリに戻る</Link><h1>学習統計</h1></header>}<div className="stats-content">
  <div className="stats-intro"><div>{embedded?<h1>学習統計</h1>:<h2>学びの積み重ね。</h2>}<p className="muted">カードも、本での学習も。直近7日間の記録です。</p></div><button className="button secondary" disabled={loading} onClick={refresh}>再読み込み</button></div>
  {demo&&<p className="stats-note">お試しモードの記録は、このブラウザだけに保存されます。Googleアカウントへの自動移行はありません。</p>}
  {note&&<p role="status" className="stats-note">{note}</p>}{error&&<p role="alert" className="error-box">{error}</p>}
  {loading?<p role="status">学習記録を読み込んでいます…</p>:data&&<>
   <div className="stats-counters"><article><Clock3 size={20}/><h3>今日の学習時間</h3><strong>{studyDuration(today?.milliseconds??0)}</strong><p>{today?.sessions??0}回の学習</p></article><article><BarChart3 size={20}/><h3>直近7日間の学習時間</h3><strong>{studyDuration(data.totalMilliseconds)}</strong><p>{data.days.filter(day=>day.milliseconds>0).length}日間 学習しました</p></article><article><BookOpen size={20}/><h3>直近7日間の学習回数</h3><strong>{data.totalSessions}<small>回</small></strong><p>単語・例文カード、本型学習の合計</p></article></div>
   <section className="stats-panel" aria-labelledby="weekly-heading"><h2 id="weekly-heading">1週間の学習時間</h2><ol className="stats-chart">{data.days.map(day=><li key={day.day} aria-label={`${day.day}：${studyDuration(day.milliseconds)}`}><span className="stats-chart-value">{studyDuration(day.milliseconds)}</span><div className="stats-chart-track" aria-hidden="true"><span style={{height:`${Math.max(day.milliseconds?2:0,day.milliseconds/maximum*100)}%`}}/></div><span>{day.day.slice(5).replace('-','/')}</span><small>{day.day===data.today?'今日':new Intl.DateTimeFormat('ja-JP',{weekday:'short',timeZone:'Asia/Tokyo'}).format(new Date(`${day.day}T00:00:00+09:00`))}</small></li>)}</ol></section>
   <section className="stats-panel" aria-labelledby="ranking-heading"><div className="stats-ranking-heading"><h2 id="ranking-heading">よく学習した単語帳</h2><label>並び順<select value={sort} onChange={event=>setSort(event.target.value as 'sessions'|'time')}><option value="sessions">学習回数</option><option value="time">学習時間</option></select></label></div>{ranked.length?<ol className="stats-ranking">{ranked.slice(0,10).map((deck,index)=><li key={deck.id}><span className="stats-rank">{String(index+1).padStart(2,'0')}</span><strong>{deck.title}</strong><span>{deck.sessions}回</span><span>{studyDuration(deck.milliseconds)}</span></li>)}</ol>:<div className="stats-empty"><BookOpen size={28}/><h3>最初の学習を記録しよう</h3><p>単語帳を開いて学習すると、ここに時間と回数が表示されます。</p><Link className="button primary" to={base}>単語帳を選ぶ</Link></div>}</section>
  </>}
  <aside className="stats-method"><h2>記録について</h2><p>統計はこの機能の公開後の学習から記録します。日付は日本時間、1週間は今日を含む直近7日間です。</p><p>学習画面が手前に表示されている時間を計測します。開始前の設定・読み込み・本の表紙・完了画面は除き、90秒間操作がなければ一時停止します。タップ・キー操作・スクロールで再開します。同じブラウザの複数タブによる重複計測を抑えています。時間は目安です。</p><p>学習回数は、学習画面を開いて実際に学習した回数です。同じ画面内でのカード・ページの切り替えは回数を増やしません。{!demo&&'ログイン中の記録はアカウントに保存されます。通信失敗時はこのブラウザに一時保存し、学習画面や統計画面を開いたときに再送します。'}</p></aside><LegalLinks/>
 </div></div>;
}

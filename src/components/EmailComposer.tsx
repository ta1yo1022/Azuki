import { Brand } from './Brand';
import { useState } from 'react';
import { Monitor, Smartphone, Mail, ArrowRight } from 'lucide-react';
import { renderEmail } from '../../shared/emailTemplate';
import './emails.css';
export const sampleEmail={subject:'単語帳を、本のようにめくれるようになりました。',body:'いつもAzukiをご利用いただき、ありがとうございます。\n\n今回のアップデートで、新しく「単語帳モード」を追加しました。英単語・意味・例文をまとめて読みながら、本のページをめくるように学習できます。\n\nスマートフォンでは一面、パソコンでは見開きに。自分に合った画面で、覚えたいことばを少しずつ読み進めてみてください。\n\nAzukiをひらく\nhttps://azuki.mame-app.com/\n\nこれからも、みなさんの学習に役立つ機能を届けていきます。\n\nAzuki運営'};
export function EmailPreview({subject,body,mobile=false}:{subject:string;body:string;mobile?:boolean}) {
 const html=renderEmail(subject,body,'https://azuki.mame-app.com/library/settings',false,new URL('/email-logo.png',window.location.origin).href).htmlContent;
 return <iframe className={`email-preview-frame ${mobile?'is-mobile':''}`} title="送信メールのプレビュー" sandbox="" referrerPolicy="no-referrer" srcDoc={html} />;
}
export function EmailComposer({busy=false,onSave}:{busy?:boolean;onSave?:(id:string,subject:string,body:string)=>Promise<void>}) {
 const [subject,setSubject]=useState(''),[body,setBody]=useState(''),[id,setId]=useState(()=>crypto.randomUUID()),[mobile,setMobile]=useState(false);
 const [message,setMessage]=useState('');
 return <section className="email-studio" aria-label="メールを作成">
  <form className="email-editor" onSubmit={async e=>{e.preventDefault();if(!onSave)return;setMessage('');try{await onSave(id,subject,body);setMessage('下書きを保存しました。下の一覧からテスト送信できます。');}catch{/* Parent shows the request error; keep the editor content. */}}}>
   <div className="email-editor-heading"><span className="eyebrow">NEW MESSAGE</span><h2>お知らせを書く</h2><p>伝えたいことを、あなたの言葉で。</p></div>
   <fieldset disabled={busy}>
    <label htmlFor="email-subject">件名・見出し <span>{subject.length} / 120</span></label><input id="email-subject" required maxLength={120} value={subject} onChange={e=>{setSubject(e.target.value);setId(crypto.randomUUID());setMessage('');}} placeholder="今回のアップデートについて"/>
    <label htmlFor="email-body">本文 <span>{body.length.toLocaleString()} / 5,000</span></label><textarea id="email-body" required maxLength={5000} rows={16} value={body} onChange={e=>{setBody(e.target.value);setId(crypto.randomUUID());setMessage('');}} placeholder={'いつもAzukiをご利用いただき、ありがとうございます。\n\nお知らせしたい内容を、自由に入力してください。'}/>
    <p className="email-editor-help">空行で段落を区切れます。URLはリンクになります。ロゴ・問い合わせ先・配信停止リンクは自動で付きます。</p>
    <button type="button" className="text-button" onClick={()=>{setSubject(sampleEmail.subject);setBody(sampleEmail.body);setId(crypto.randomUUID());setMessage('');}}>例文を入れる</button>
    {onSave?<button className="button primary" disabled={!subject.trim()||!body.trim()} type="submit"><Mail size={18}/>{busy?'保存中…':'下書きを保存'}<ArrowRight size={18}/></button>:<p className="email-editor-help">デザイン確認用です。ここから保存・送信はされません。</p>}
   </fieldset>
   {message&&<p role="status">{message}</p>}
  </form>
  <div className="email-preview-panel"><div className="email-preview-toolbar"><div><strong>メールプレビュー</strong><span>入力内容をそのまま反映</span></div><div role="group" aria-label="プレビューの表示幅"><button type="button" aria-label="パソコン幅" aria-pressed={!mobile} onClick={()=>setMobile(false)}><Monitor size={18}/></button><button type="button" aria-label="スマートフォン幅" aria-pressed={mobile} onClick={()=>setMobile(true)}><Smartphone size={18}/></button></div></div><EmailPreview subject={subject||'Azukiからのお知らせ'} body={body||'ここに入力した文章が表示されます。\n\n件名と本文を入力して、メールの仕上がりを確認してください。'} mobile={mobile}/><p className="email-preview-caption">メールアプリによって、フォントや余白が多少異なる場合があります。</p></div>
 </section>;
}
export function EmailDesignPreview(){return <main className="email-design-page"><a href="/" className="email-design-brand"><Brand/></a><h1>メールのデザイン</h1><p>文章を入力すると、送信メールの見た目を確認できます。</p><EmailComposer/></main>;}

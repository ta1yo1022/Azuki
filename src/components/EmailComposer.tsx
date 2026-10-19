import { Brand } from './Brand';
import { useRef, useState } from 'react';
import { Monitor, Smartphone, Mail, ArrowRight, Bold, ImagePlus } from 'lucide-react';
import { renderEmail } from '../../shared/emailTemplate';
import { emailImageUrl } from '../../shared/emailBody';
import './emails.css';
export const sampleEmail={"subject": "CEFR-J単語帳・本型の学習モード・自分用の例文づくりを追加しました", "body": "いつもAzukiをご利用いただき、ありがとうございます。\n今回のアップデートで、3つの機能を追加しました。\n\n**CEFR-Jのレベル別単語帳を追加しました**\n\nA1・A2・B1・B2の単語帳を、それぞれ前編・後編に分けて用意しました。英単語と品詞に加え、Azukiが編集した代表的な意味や例文も確認できます。公開ライブラリから、自分の学びたいレベルを選んで学習できます。\n\n前編・後編は原典の掲載順を二分したもので、同じレベル内での難易度の違いではありません。日本語の意味と例文はCEFR-Jの公式訳・公式例文ではなく、Azukiが編集したものです。\n\n**公開単語帳から、自分用の例文で学べます**\n\n「JSONを編集してフォーク」から、公開単語帳をもとに自分用の単語帳を作れるようになりました。\n\nJSONをChatGPTやGeminiなどに渡して、例文を自分に合う内容に書き換えてもらうこともできます。たとえば、こんなふうに頼めます。\n\n「英単語と意味はそのままに、例文を学校生活や部活動で使う場面に書き換えてください。JSONの形式は変えずに出力してください。」\n\n出力された内容を確認・修正して取り込めば、自分になじみのある例文で学べる単語帳になります。必要な単語だけを残したり、自分で考えた例文を入れたりすることもできます。\n\n**本をめくるように学べるようになりました**\n\n「単語帳で学習」では、英単語・意味・例文を並べて読みながら、紙の単語帳のようにページをめくれます。パソコンでは見開き、スマートフォンでは1ページずつ表示します。\n\n意味をぼかして隠し、思い出してからタップして確かめることもできます。1語ずつ集中したいときはカード、まとめて読み返したいときは本型の表示を使ってみてください。\n\nぜひ、いつもの学習で試してみてください。\nhttps://azuki.mame-app.com/\n\n英単語帳アプリ Azuki"};
export function EmailPreview({subject,body,mobile=false}:{subject:string;body:string;mobile?:boolean}) {
 const html=renderEmail(subject,body,'https://azuki.mame-app.com/library/settings',false,new URL('/email-logo.png',window.location.origin).href,new URL('/volta-email-logo.png',window.location.origin).href).htmlContent;
 return <iframe className={`email-preview-frame ${mobile?'is-mobile':''}`} title="送信メールのプレビュー" sandbox="" referrerPolicy="no-referrer" srcDoc={html} />;
}
export function EmailComposer({busy=false,onSave}:{busy?:boolean;onSave?:(id:string,subject:string,body:string)=>Promise<void>}) {
 const [subject,setSubject]=useState(''),[body,setBody]=useState(''),[id,setId]=useState(()=>crypto.randomUUID()),[mobile,setMobile]=useState(false);
 const [message,setMessage]=useState(''),[formatError,setFormatError]=useState('');
 const [showImage,setShowImage]=useState(false),[imageUrl,setImageUrl]=useState(''),[imageAlt,setImageAlt]=useState('');
 const editor=useRef<HTMLTextAreaElement>(null), selection=useRef({start:0,end:0});
 function rememberSelection() { if(editor.current) selection.current={start:editor.current.selectionStart,end:editor.current.selectionEnd}; }
 function insert(value:string,selectStart=0,selectEnd=value.length) {
   const {start,end}=selection.current;
   const next=body.slice(0,start)+value+body.slice(end);
   if(next.length>5000){setFormatError('本文は画像URLや太字の記号も含めて5,000文字以内にしてください。');return false;}
   setBody(next);setId(crypto.randomUUID());setMessage('');setFormatError('');
   requestAnimationFrame(()=>{editor.current?.focus();editor.current?.setSelectionRange(start+selectStart,start+selectEnd);rememberSelection();});
   return true;
 }
 function bold() {
   const {start,end}=selection.current, selected=body.slice(start,end)||'太字の文章';
   if(selected.startsWith('**')&&selected.endsWith('**')&&selected.length>4)insert(selected.slice(2,-2));
   else insert('**'+selected+'**',2,selected.length+2);
 }
 function addImage() {
   const url=emailImageUrl(imageUrl);
   if(!url){setFormatError('公開されている画像のHTTPS URLを入力してください。');return;}
   const alt=imageAlt.trim().replace(/[\[\]\r\n]/g,' ')||'画像';
   const lineEnd=body.indexOf('\n',selection.current.end);
   const position=lineEnd===-1?body.length:lineEnd;
   selection.current={start:position,end:position};
   const value='\n\n!['+alt+']('+url+')\n\n';
   if(insert(value,value.length,value.length)){setShowImage(false);setImageUrl('');setImageAlt('');}
 }
 return <section className="email-studio" aria-label="メールを作成">
  <form className="email-editor" onSubmit={async e=>{e.preventDefault();if(!onSave)return;setMessage('');try{await onSave(id,subject,body);setMessage('下書きを保存しました。下の一覧からテスト送信できます。');}catch{/* Parent shows the request error; keep the editor content. */}}}>
   <div className="email-editor-heading"><h2>お知らせを書く</h2><p>伝えたいことを、あなたの言葉で。</p></div>
   <fieldset disabled={busy}>
    <label htmlFor="email-subject">件名・見出し <span>{subject.length} / 120</span></label><input id="email-subject" required maxLength={120} value={subject} onChange={e=>{setSubject(e.target.value);setId(crypto.randomUUID());setMessage('');}} placeholder="今回のアップデートについて"/>
    <label htmlFor="email-body">本文 <span>{body.length.toLocaleString()} / 5,000</span></label>
    <div className="email-format-toolbar" role="group" aria-label="本文の書式">
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={bold}><Bold size={16}/>太字</button>
      <button type="button" aria-expanded={showImage} aria-controls="email-image-fields" onMouseDown={e=>e.preventDefault()} onClick={()=>{setShowImage(v=>!v);setFormatError('');}}><ImagePlus size={16}/>画像を挿入</button>
    </div>
    {showImage&&<div id="email-image-fields" className="email-image-fields">
      <label htmlFor="email-image-url">画像URL</label><input id="email-image-url" type="text" inputMode="url" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://example.com/image.png"/>
      <label htmlFor="email-image-alt">画像の説明</label><input id="email-image-alt" maxLength={160} value={imageAlt} onChange={e=>setImageAlt(e.target.value)} placeholder="単語帳モードの画面"/>
      <p className="email-editor-help">公開済みの画像URLを指定してください。画像のアップロードは行いません。</p>
      <button type="button" className="button secondary" onClick={addImage}>本文に画像を追加</button>
    </div>}
    {formatError&&<p role="alert" className="error-box">{formatError}</p>}
    <textarea ref={editor} onSelect={rememberSelection} onKeyDown={e=>{if(!e.nativeEvent.isComposing&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='b'){e.preventDefault();rememberSelection();bold();}}} id="email-body" required maxLength={5000} rows={16} value={body} onChange={e=>{setBody(e.target.value);setId(crypto.randomUUID());setMessage('');}} placeholder={'いつもAzukiをご利用いただき、ありがとうございます。\n\nお知らせしたい内容を、自由に入力してください。'}/>
    <p className="email-editor-help">選択した文章を「太字」で強調できます。画像はURLから挿入でき、右側で仕上がりを確認できます。空行で段落を区切れます。</p>
    <button type="button" className="text-button" onClick={()=>{setSubject(sampleEmail.subject);setBody(sampleEmail.body);setId(crypto.randomUUID());setMessage('');}}>例文を入れる</button>
    {onSave?<button className="button primary" disabled={!subject.trim()||!body.trim()} type="submit"><Mail size={18}/>{busy?'保存中…':'下書きを保存'}<ArrowRight size={18}/></button>:<p className="email-editor-help">デザイン確認用です。ここから保存・送信はされません。</p>}
   </fieldset>
   {message&&<p role="status">{message}</p>}
  </form>
  <div className="email-preview-panel"><div className="email-preview-toolbar"><div><strong>メールプレビュー</strong><span>入力内容をそのまま反映</span></div><div role="group" aria-label="プレビューの表示幅"><button type="button" aria-label="パソコン幅" aria-pressed={!mobile} onClick={()=>setMobile(false)}><Monitor size={18}/></button><button type="button" aria-label="スマートフォン幅" aria-pressed={mobile} onClick={()=>setMobile(true)}><Smartphone size={18}/></button></div></div><EmailPreview subject={subject||'Azukiからのお知らせ'} body={body||'ここに入力した文章が表示されます。\n\n件名と本文を入力して、メールの仕上がりを確認してください。'} mobile={mobile}/><p className="email-preview-caption">メールアプリによって、フォントや余白が多少異なる場合があります。</p></div>
 </section>;
}
export function EmailDesignPreview(){return <main className="email-design-page"><a href="/" className="email-design-brand"><Brand/></a><h1>メールのデザイン</h1><p>文章を入力すると、送信メールの見た目を確認できます。</p><EmailComposer/></main>;}

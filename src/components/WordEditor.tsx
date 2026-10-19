import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { LIMITS, wordExamples, type Deck, type Word, type WordExample } from "../../shared/model";
import { cloudRepository, type Repository } from "../lib/repository";
type ExampleDraft = WordExample & {key:string};
const drafts = (word:Word):ExampleDraft[] => wordExamples(word).map(example=>({...example,key:crypto.randomUUID()}));
export function WordEditor({deck,word,onSaved,repository=cloudRepository}:{deck:Deck;word:Word;onSaved:(deck:Deck,word:Word)=>void;repository?:Repository}) {
  const [editing,setEditing]=useState(false);
  const [value,setValue]=useState({word:word.word,meaning:word.meaning});
  const [examples,setExamples]=useState<ExampleDraft[]>(()=>drafts(word));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  function update(key:string,change:Partial<WordExample>){setExamples(previous=>previous.map(example=>example.key===key?{...example,...change}:example));}
  if(!editing)return <button type="button" className="text-button word-edit-trigger" onClick={()=>{setValue({word:word.word,meaning:word.meaning});setExamples(drafts(word));setError('');setEditing(true);}}><Pencil size={15}/>例文を追加・編集</button>;
  return <form className="word-edit-form" aria-label={`${word.word}を編集`} onSubmit={async event=>{
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    try {
      if(!repository.editWord)throw new Error('この単語帳は編集できません。');
      const result=await repository.editWord(deck.id,word,{...value,examples:examples.map(({text,translation})=>({text:text.trim(),...(translation?.trim()?{translation:translation.trim()}: {})}))});
      onSaved(result.deck,result.word);setEditing(false);
    } catch(cause){setError(cause instanceof Error?cause.message:'保存できませんでした。');}
    finally{setBusy(false);}
  }}>
    <fieldset disabled={busy} className="word-editor-fields">
      <div className="word-editor-vocabulary"><label>英単語<input required maxLength={120} value={value.word} onChange={e=>setValue({...value,word:e.target.value})}/></label><label>意味<textarea required maxLength={1000} rows={2} value={value.meaning} onChange={e=>setValue({...value,meaning:e.target.value})}/></label></div>
      <div className="word-examples-heading"><h3>例文</h3><span>{examples.length} / {LIMITS.examplesPerWord}件</span></div>
      {examples.length===0&&<p className="muted">例文を追加して、覚えたい場面の英文を残せます。</p>}
      <div className="word-example-edit-list">{examples.map((example,index)=><section className="word-example-edit" key={example.key} aria-label={`例文${index+1}`}>
        <div className="word-example-edit-heading"><strong>例文 {index+1}</strong><button type="button" className="text-button" aria-label={`例文${index+1}を削除`} onClick={()=>setExamples(previous=>previous.filter(item=>item.key!==example.key))}><Trash2 size={15}/>削除</button></div>
        <label>英文 {index+1}<textarea required maxLength={1000} rows={3} lang="en" value={example.text} onChange={e=>update(example.key,{text:e.target.value})} placeholder="The captain refused to leave the spaceship."/></label>
        <label>日本語訳 {index+1}（任意）<textarea maxLength={1000} rows={2} lang="ja" value={example.translation??''} onChange={e=>update(example.key,{translation:e.target.value})} placeholder="船長は宇宙船を離れることを拒んだ。"/></label>
      </section>)}</div>
      <button type="button" className="button secondary add-word-example" disabled={examples.length>=LIMITS.examplesPerWord} onClick={()=>setExamples(previous=>[...previous,{key:crypto.randomUUID(),text:''}])}><Plus size={17}/>例文を追加</button>
      <p className="muted">1語につき最大{LIMITS.examplesPerWord}件。例文を増やしても保存語数は増えません。</p>
      {deck.visibility==='public'&&<p>編集を保存すると非公開になります。内容を確認してから、再び公開できます。</p>}
      {error&&<p role="alert" className="error-box">{error}</p>}
      <div className="word-editor-actions"><button type="submit" className="button primary">{busy?'保存しています…':'変更を保存'}</button><button type="button" className="button secondary" onClick={()=>setEditing(false)}>キャンセル</button></div>
    </fieldset>
  </form>;
}

import { useState } from "react";
import type { Deck, Word } from "../../shared/model";
import { cloudRepository } from "../lib/repository";
export function WordEditor({ deck, word, onSaved }: { deck: Deck; word: Word; onSaved: (deck: Deck) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState({ word: word.word, meaning: word.meaning, example: word.example ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!editing) return <button className="text-button" onClick={() => { setValue({ word: word.word, meaning: word.meaning, example: word.example ?? "" }); setError(""); setEditing(true); }}>単語・意味・例文を編集</button>;
  return <form className="word-edit-form" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { const result = await cloudRepository.editWord!(deck.id, word, value); onSaved(result.deck); setEditing(false); }
    catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした。"); }
    finally { setBusy(false); }
  }}>
    <label>英単語<input required maxLength={120} value={value.word} disabled={busy} onChange={e => setValue({...value, word:e.target.value})} /></label>
    <label>意味<textarea required maxLength={1000} value={value.meaning} disabled={busy} onChange={e => setValue({...value, meaning:e.target.value})} /></label>
    <label>例文<textarea maxLength={1000} value={value.example} disabled={busy} onChange={e => setValue({...value, example:e.target.value})} /></label>
    {deck.visibility === "public" && <p>編集を保存すると非公開になります。内容を確認してから、再び公開できます。</p>}
    {error && <p role="alert" className="error-box">{error}</p>}
    <div><button className="button primary" disabled={busy}>{busy ? "保存しています…" : "変更を保存"}</button><button className="button secondary" type="button" disabled={busy} onClick={() => setEditing(false)}>キャンセル</button></div>
  </form>;
}

import { parseDeck, ValidationError, type Word } from "../shared/model";
import { contentHash } from "../shared/content";
import { deckResult, deckSelect, type DeckRow } from "./decks";
import type { Env } from "./index";

export async function setVisibility(env: Env, uid: string, row: DeckRow, visibility: "public" | "private") {
  const conflict = async () => {
    if (row.source_deck_id && (!row.source_hash || row.source_hash === row.content_hash))
      return Response.json({ error: "保存したままのコピーは公開できません。単語・意味・例文を編集すると、派生版として公開できます。", code: "unchanged_copy", ...(row.source_available ? { existingDeckId: row.source_deck_id } : {}) }, { status: 409 });
    const duplicate = await env.DB.prepare("SELECT id FROM decks WHERE visibility='public' AND content_hash=? AND id<>? ORDER BY (owner_id='azuki:official') DESC,created_at,id LIMIT 1").bind(row.content_hash, row.id).first<{ id: string }>();
    if (duplicate) return Response.json({ error: "同じ単語・意味・例文の単語帳がすでに公開されています。公開中の単語帳をご利用ください。", code: "duplicate_content", existingDeckId: duplicate.id }, { status: 409 });
    return null;
  };
  if (visibility === "public" && row.visibility !== "public") {
    const response = await conflict();
    if (response) return response;
  }
  try {
    const changed = await env.DB.prepare("UPDATE decks SET visibility=?,updated_at=? WHERE id=? AND owner_id=? AND content_hash=? RETURNING id").bind(visibility, new Date().toISOString(), row.id, uid, row.content_hash).first();
    if (!changed) return Response.json({ error: "内容が更新されました。画面を読み込み直してください。" }, { status: 409 });
  } catch (e) {
    if (/AZUKI_(DUPLICATE_PUBLIC|UNCHANGED_COPY)/.test(String(e))) {
      const response = await conflict();
      if (response) return response;
    }
    throw e;
  }
  const updated = await env.DB.prepare(`${deckSelect} WHERE d.id=? AND d.owner_id=?`).bind(row.id, uid).first<DeckRow>();
  return Response.json({ deck: deckResult(updated!) });
}

export async function editWord(env: Env, uid: string, id: string, wordId: string, raw: string) {
  const row = await env.DB.prepare(`${deckSelect} WHERE d.id=? AND d.owner_id=?`).bind(id, uid).first<DeckRow>();
  if (!row) return Response.json({ error: "単語帳が見つかりません。" }, { status: 404 });
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { throw new ValidationError("編集内容を確認してください。"); }
  if (!input || typeof input !== "object") throw new ValidationError("編集内容を確認してください。");
  const data = parseDeck(JSON.stringify({ title: row.title, words: [input] })).words[0];
  const result = await env.DB.prepare("SELECT id,ordinal,word,meaning,example,tags FROM words WHERE deck_id=? ORDER BY ordinal").bind(id).all<Omit<Word,"tags"> & { tags: string }>();
  const old = result.results.find(w => w.id === wordId);
  if (!old) return Response.json({ error: "単語が見つかりません。" }, { status: 404 });
  if (input.expectedWord !== old.word || input.expectedMeaning !== old.meaning || input.expectedExample !== old.example)
    return Response.json({ error: "この単語は更新されています。画面を読み込み直してください。" }, { status: 409 });
  if (data.word === old.word && data.meaning === old.meaning && (data.example ?? "") === old.example) return Response.json({ deck: deckResult(row), word: {...old, tags: JSON.parse(old.tags)} });
  const words = result.results.map(w => w.id === wordId ? { ...data, tags: JSON.parse(old.tags) } : { word: w.word, meaning: w.meaning, example: w.example, tags: JSON.parse(w.tags) });
  const parsed = parseDeck(JSON.stringify({ title: row.title, description: row.description, textbookTags: JSON.parse(row.textbook_tags), words }));
  const hash = await contentHash(parsed.words);
  const bytes = new TextEncoder().encode(JSON.stringify(parsed)).length;
  const now = new Date().toISOString();
  const changes = await env.DB.batch([
    env.DB.prepare("UPDATE words SET word=?,meaning=?,example=? WHERE id=? AND deck_id=? AND EXISTS(SELECT 1 FROM decks WHERE id=? AND owner_id=? AND content_hash=?)").bind(data.word, data.meaning, data.example ?? "", wordId, id, id, uid, row.content_hash),
    env.DB.prepare("UPDATE decks SET content_hash=?,data_bytes=?,visibility='private',updated_at=? WHERE id=? AND owner_id=? AND content_hash=?").bind(hash, bytes, now, id, uid, row.content_hash),
  ]);
  if (!changes[0].meta.changes) return Response.json({ error: "内容が更新されました。画面を読み込み直してください。" }, { status: 409 });
  const updated = await env.DB.prepare(`${deckSelect} WHERE d.id=? AND d.owner_id=?`).bind(id, uid).first<DeckRow>();
  return Response.json({ deck: deckResult(updated!), word: { ...old, ...data, tags: JSON.parse(old.tags) } });
}

import { deckResult, deckSelect, type DeckRow } from "./decks";
import { contentHash } from "../shared/content";
import type { Env } from "./index";

export async function savePublicDeck(env: Env, uid: string, sourceId: string) {
  const existing = () => env.DB.prepare(
    `${deckSelect} WHERE d.owner_id=? AND (d.id=? OR d.source_deck_id=?) LIMIT 1`,
  ).bind(uid, sourceId, sourceId).first<DeckRow>();
  const saved = await existing();
  if (saved) return Response.json({ deck: deckResult(saved), alreadySaved: true });
  if (env.ALLOW_IMPORTS !== "true") {
    return Response.json({ error: "現在、新しい単語帳の保存をお休みしています。" }, { status: 503 });
  }
  // Seeded books from earlier versions receive their fingerprint before copying.
  const source = await env.DB.prepare("SELECT content_hash FROM decks WHERE id=? AND visibility='public'").bind(sourceId).first<{content_hash:string}>();
  if (source && !source.content_hash) {
    const words = await env.DB.prepare("SELECT word,meaning,example FROM words WHERE deck_id=?").bind(sourceId).all<{word:string;meaning:string;example:string}>();
    await env.DB.prepare("UPDATE decks SET content_hash=? WHERE id=? AND content_hash='' AND visibility='public'").bind(await contentHash(words.results), sourceId).run();
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    // Visibility, metadata, words, tags, and quota counters share one transaction.
    // Copy in SQL so a 500-word deck fits comfortably within D1 Free's query limits.
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO users(id) VALUES (?)").bind(uid),
      env.DB.prepare(`INSERT INTO decks(id,owner_id,title,description,visibility,word_count,created_at,updated_at,data_bytes,source_deck_id,content_source,source_title,source_hash,content_hash,root_deck_id)
        SELECT ?,?,title,description,'private',word_count,?,?,data_bytes,id,content_source,title,content_hash,content_hash,COALESCE(root_deck_id,id)
        FROM decks WHERE id=? AND visibility='public'`).bind(id, uid, now, now, sourceId),
      env.DB.prepare(`INSERT INTO words(id,deck_id,ordinal,word,meaning,example,tags)
        SELECT ? || '-' || w.ordinal,?,w.ordinal,w.word,w.meaning,w.example,w.tags
        FROM words w WHERE w.deck_id=? AND EXISTS(SELECT 1 FROM decks WHERE id=?)`).bind(id, id, sourceId, id),
      env.DB.prepare(`INSERT INTO deck_textbook_tags(deck_id,tag_id)
        SELECT ?,tag_id FROM deck_textbook_tags
        WHERE deck_id=? AND EXISTS(SELECT 1 FROM decks WHERE id=?)`).bind(id, sourceId, id),
    ]);
  } catch (error) {
    // A concurrent retry can lose either to the unique key or to the quota trigger.
    // Return the first successful copy instead of consuming quota twice.
    const concurrent = await existing();
    if (concurrent) return Response.json({ deck: deckResult(concurrent), alreadySaved: true });
    throw error;
  }
  const result = await env.DB.prepare(`${deckSelect} WHERE d.id=? AND d.owner_id=?`).bind(id, uid).first<DeckRow>();
  if (!result) return Response.json({ error: "この単語帳は公開されていないか、削除されています。" }, { status: 404 });
  return Response.json({ deck: deckResult(result), alreadySaved: false }, { status: 201 });
}

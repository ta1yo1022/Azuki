import { isDeckTheme } from '../shared/deckThemes';
import { standardDeck } from "../shared/standardDecks";
import { ValidationError, type Deck, type TextbookTag, type Word } from "../shared/model";
import { OFFICIAL_OWNER_ID } from "./official";
export type DeckRow = {
  id: string;
  owner_id: string;
  source_deck_id: string | null;
  source_title: string;
  source_hash: string;
  content_hash: string;
  root_deck_id: string | null;
  source_available: number;
  variant_count: number;
  content_source: string;
  official_level: string;
  theme?: string;
  title: string;
  description: string;
  visibility: "private" | "public";
  word_count: number;
  data_bytes: number;
  created_at: string;
  updated_at: string;
  textbook_tags: string;
};
export const deckSelect = `SELECT d.*, EXISTS(SELECT 1 FROM decks src WHERE src.id=d.source_deck_id AND src.visibility='public') AS source_available, (SELECT max(count(DISTINCT CASE WHEN v.content_hash='' THEN v.id ELSE v.content_hash END)-1,0) FROM decks v WHERE v.visibility='public' AND COALESCE(v.root_deck_id,v.id)=COALESCE(d.root_deck_id,d.id)) AS variant_count, COALESCE((SELECT json_group_array(json_object('name', t.name, 'edition', t.edition, 'chapter', t.chapter)) FROM deck_textbook_tags dt JOIN textbook_tags t ON t.id = dt.tag_id WHERE dt.deck_id = d.id), '[]') AS textbook_tags FROM decks d`;
export function deckResult(row: DeckRow): Deck {
  const official = row.owner_id === OFFICIAL_OWNER_ID;
  const level = row.official_level;
  return {
    ...(row.source_deck_id ? { sourceDeck: { id: row.source_deck_id, title: row.source_title || "コピー元の単語帳", available: Boolean(row.source_available || standardDeck(row.source_deck_id)) }, unchangedCopy: !row.source_hash || row.content_hash === row.source_hash } : {}),
    variantCount: row.variant_count ?? 0,
    schemaVersion: 1,
    id: row.id,
    title: row.title,
    ...(isDeckTheme(row.theme)?{theme:row.theme}:{}),
    description: row.description,
    visibility: row.visibility,
    wordCount: row.word_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    textbookTags: JSON.parse(row.textbook_tags) as TextbookTag[],
    isOfficial: official,
    ...(official && (level === "beginner" || level === "intermediate" || level === "advanced")
      ? { officialLevel: level } : {}),
    ...(row.root_deck_id && standardDeck(row.root_deck_id) ? {contentSource:standardDeck(row.root_deck_id)!.contentSource} : row.content_source === "ejdict" ? { contentSource: "ejdict" as const } : {}),
  };
}

export function searchQuery(url: URL): string {
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length > 100)
    throw new ValidationError("検索は100文字以内にしてください。");
  return q;
}
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

export type StoredWord = Omit<Word, 'tags' | 'examples'> & {tags:string;examples_json:string};
export function wordResult({tags,examples_json,...word}:StoredWord): Word {
  const examples = JSON.parse(examples_json);
  return {...word,tags:JSON.parse(tags),...(examples.length ? {examples} : {})};
}

export async function readWords(
  db: D1Database,
  id: string,
  url: URL,
  ownerId?: string,
) {
  const rawCursor = url.searchParams.get("cursor") ?? "0";
  if (!/^\d{1,6}$/.test(rawCursor))
    throw new ValidationError("ページの指定が正しくありません。");
  const q = searchQuery(url);
  const pattern = likePattern(q);
  // Recheck visibility/ownership in the word query, including after a concurrent unpublish.
  const access = ownerId ? "d.owner_id=?" : "d.visibility='public'";
  const result = await db
    .prepare(
      `SELECT w.id,w.ordinal,w.word,w.meaning,w.example,w.tags,w.examples_json FROM words w
     JOIN decks d ON d.id=w.deck_id
     WHERE w.deck_id=? AND ${access} AND w.ordinal>=?
       AND (?='' OR w.word LIKE ? ESCAPE '\\' OR w.meaning LIKE ? ESCAPE '\\')
     ORDER BY w.ordinal LIMIT 51`,
    )
    .bind(
      id,
      ...(ownerId ? [ownerId] : []),
      Number(rawCursor),
      q,
      pattern,
      pattern,
    )
    .all<StoredWord>();
  return Response.json({
    words: result.results
      .slice(0, 50)
      .map(wordResult),
    nextCursor: result.results.length > 50 ? result.results[50].ordinal : null,
  });
}

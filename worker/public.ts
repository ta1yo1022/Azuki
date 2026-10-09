import { ValidationError } from "../shared/model";
import {
  deckSelect,
  deckResult,
  likePattern,
  readWords,
  searchQuery,
  type DeckRow,
} from "./decks";
import type { Env } from "./index";

function cursorFor(row: DeckRow) {
  return btoa(JSON.stringify([row.created_at, row.id]));
}
function parseCursor(value: string | null): [string, string] | null {
  if (!value) return null;
  try {
    if (value.length > 240) throw new Error();
    const data: unknown = JSON.parse(atob(value));
    if (
      !Array.isArray(data) ||
      data.length !== 2 ||
      typeof data[0] !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data[0]) ||
      !Number.isFinite(Date.parse(data[0])) ||
      typeof data[1] !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(data[1])
    )
      throw new Error();
    return [data[0], data[1]];
  } catch {
    throw new ValidationError("ページの指定が正しくありません。");
  }
}

export async function publicRoute(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET")
    return Response.json(
      { error: "この操作は利用できません。" },
      { status: 405 },
    );
  if (url.pathname === "/api/public/decks") {
    const q = searchQuery(url);
    const pattern = likePattern(q);
    const cursor = parseCursor(url.searchParams.get("cursor"));
    const clauses = ["d.visibility='public'", "d.id IN (SELECT id FROM public_families WHERE family_rank=1)"];
    const params: string[] = [];
    if (q) {
      clauses.push(`EXISTS (SELECT 1 FROM decks member WHERE member.visibility='public' AND COALESCE(member.root_deck_id,member.id)=COALESCE(d.root_deck_id,d.id) AND (member.title LIKE ? ESCAPE '\\' OR member.description LIKE ? ESCAPE '\\' OR EXISTS (
        SELECT 1 FROM deck_textbook_tags dt JOIN textbook_tags t ON t.id=dt.tag_id
        WHERE dt.deck_id=member.id AND (t.name LIKE ? ESCAPE '\\' OR t.edition LIKE ? ESCAPE '\\' OR t.chapter LIKE ? ESCAPE '\\')
      )))`);
      params.push(pattern, pattern, pattern, pattern, pattern);
    }
    if (cursor) {
      clauses.push("(d.created_at, d.id) < (?, ?)");
      params.push(...cursor);
    }
    const result = await env.DB.prepare(
      `${deckSelect} WHERE ${clauses.join(" AND ")} ORDER BY d.created_at DESC, d.id DESC LIMIT 21`,
    )
      .bind(...params)
      .all<DeckRow>();
    return Response.json({
      decks: result.results.slice(0, 20).map(deckResult),
      nextCursor:
        result.results.length > 20 ? cursorFor(result.results[19]) : null,
    });
  }
  const path = /^\/api\/public\/decks\/([a-zA-Z0-9-]{1,80})(\/words|\/variants)?$/.exec(
    url.pathname,
  );
  if (path) {
    const row = await env.DB.prepare(
      `${deckSelect} WHERE d.id=? AND d.visibility='public'`,
    )
      .bind(path[1])
      .first<DeckRow>();
    if (!row)
      return Response.json(
        { error: "この単語帳は公開されていないか、削除されています。" },
        { status: 404 },
      );
    if (path[2] === "/variants") {
      const cursor = parseCursor(url.searchParams.get("cursor"));
      const representative = await env.DB.prepare("SELECT d.content_hash,d.id FROM public_families f JOIN decks d ON d.id=f.id WHERE f.family_id=? AND f.family_rank=1").bind(row.root_deck_id || row.id).first<{id:string;content_hash:string}>();
      if (!representative) return Response.json({error:"この単語帳は現在公開されていません。"}, {status:404});
      const result = await env.DB.prepare(`${deckSelect} WHERE d.visibility='public' AND COALESCE(d.root_deck_id,d.id)=? AND d.id<>?
        AND (d.content_hash='' OR d.content_hash<>?)
        AND NOT EXISTS(SELECT 1 FROM decks earlier WHERE earlier.visibility='public' AND COALESCE(earlier.root_deck_id,earlier.id)=COALESCE(d.root_deck_id,d.id) AND d.content_hash<>'' AND earlier.content_hash=d.content_hash AND (earlier.created_at,earlier.id)<(d.created_at,d.id))
        ${cursor ? "AND (d.created_at,d.id)<(?,?)" : ""} ORDER BY d.created_at DESC,d.id DESC LIMIT 21`)
        .bind(row.root_deck_id || row.id, representative!.id, representative!.content_hash, ...(cursor || [])).all<DeckRow>();
      return Response.json({decks: result.results.slice(0,20).map(deckResult), nextCursor: result.results.length>20 ? cursorFor(result.results[19]) : null});
    }
    if (path[2]) return readWords(env.DB, row.id, url);
    return Response.json({ deck: deckResult(row) });
  }
  return Response.json({ error: "単語帳が見つかりません。" }, { status: 404 });
}

import { ensureDefaultEmailPreference, emailAdminRoute, preferencesRoute, processEmailQueue, unsubscribeRoute } from './email';
import { standardDeck } from "../shared/standardDecks";
import { LIMITS, parseDeck, ValidationError, type Deck } from "../shared/model";
import { verifyFirebaseIdentity, type VerifiedIdentity } from "./auth";
import { reportsRoute } from "./reports";
import { wordResult, type StoredWord, deckSelect, deckResult, type DeckRow, readWords } from "./decks";
import { publicRoute } from "./public";
import { savePublicDeck } from "./save";
import { contentHash } from "../shared/content";
import { editWord, setVisibility } from "./publishing";
import { OFFICIAL_OWNER_ID } from "./official";
export interface Env {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGINS: string;
  ALLOW_IMPORTS: string;
  ADMIN_EMAILS?: string;
  BREVO_API_KEY?: string;
  EMAIL_ENABLED?: string;
  EMAIL_FROM?: string;
  EMAIL_API_URL?: string;
  EMAIL_DAILY_LIMIT?: string;
}
type Verify = (token: string, projectId: string) => Promise<string | VerifiedIdentity>;
const json = (data: unknown, status = 200) => Response.json(data, { status });
export async function limitedBody(
  request: Request,
  limit = LIMITS.bytes,
): Promise<string> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ValidationError("JSON形式で送信してください。");
  const reader = request.body?.getReader();
  if (!reader) throw new ValidationError("JSONを入力してください。");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      throw new ValidationError("送信するJSONが大きすぎます。");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
async function route(
  request: Request,
  env: Env,
  verify: Verify,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/email/unsubscribe") return unsubscribeRoute(request, env);
  if (url.pathname === "/api/health" && request.method === "GET")
    return json({ ok: true });
  if (url.pathname.startsWith("/api/public/")) return publicRoute(request, env);
  if (
    !env.FIREBASE_PROJECT_ID ||
    env.FIREBASE_PROJECT_ID.startsWith("REPLACE_")
  )
    return json(
      { error: "ログインの準備中です。時間をおいてお試しください。" },
      503,
    );
  const match = /^Bearer ([^\s]+)$/.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match)
    return json({ error: "Googleアカウントでログインしてください。" }, 401);
  let uid: string;
  let identity: VerifiedIdentity;
  try {
    const verified = await verify(match[1], env.FIREBASE_PROJECT_ID);
    identity = typeof verified === "string" ? { uid: verified, emailVerified: false } : verified;
    uid = identity.uid;
  } catch {
    return json(
      {
        error: "ログインの有効期限が切れました。もう一度ログインしてください。",
      },
      401,
    );
  }
  if (url.pathname === "/api/email/preferences") return preferencesRoute(request, env, identity);
  if (url.pathname === "/api/admin/emails" || url.pathname.startsWith("/api/admin/emails/")) return emailAdminRoute(request, env, identity);
  if (url.pathname.startsWith("/api/admin/") || /^\/api\/decks\/[^/]+\/report$/.test(url.pathname)) return reportsRoute(request, env, identity);
  if (uid === OFFICIAL_OWNER_ID)
    return json({ error: "このアカウントでは操作できません。" }, 403);
  if (url.pathname === "/api/decks" && request.method === "GET") {
    await ensureDefaultEmailPreference(env, identity);
    const result = await env.DB.prepare(
      `${deckSelect} WHERE d.owner_id = ? ORDER BY d.created_at DESC, d.id DESC LIMIT 20`,
    )
      .bind(uid)
      .all<DeckRow>();
    return json({ decks: result.results.map(deckResult) });
  }
  const forkPath = /^\/api\/decks\/([a-zA-Z0-9-]{1,80})\/fork$/.exec(url.pathname);
  if ((url.pathname === "/api/decks" || forkPath) && request.method === "POST") {
    if (env.ALLOW_IMPORTS !== "true")
      return json(
        {
          error:
            "現在、新しい単語帳の登録をお休みしています。登録済みの単語帳は閲覧できます。",
        },
        503,
      );
    const data = parseDeck(await limitedBody(request), {maxWords:forkPath ? LIMITS.forkWords : LIMITS.importWords,allowExampleVariants:Boolean(forkPath)});
    let source: {id:string;title:string;hash:string;root:string;contentSource:string;standard:boolean} | undefined;
    if (forkPath) {
      const original = standardDeck(forkPath[1]);
      if (original) source = {id:original.id,title:original.title,hash:original.contentHash,root:original.id,contentSource:original.contentSource === "ejdict" ? "ejdict" : "",standard:true};
      else {
        const row = await env.DB.prepare("SELECT * FROM decks WHERE id=? AND (visibility='public' OR owner_id=?)").bind(forkPath[1],uid).first<DeckRow>();
        if (!row) return json({error:"コピー元の単語帳が見つからないか、公開されていません。"},404);
        const words = await env.DB.prepare("SELECT id,ordinal,word,meaning,example,tags,examples_json FROM words WHERE deck_id=?").bind(row.id).all<StoredWord>();
        source={id:row.id,title:row.title,hash:await contentHash(words.results.map(wordResult)),root:row.root_deck_id || row.id,contentSource:row.content_source,standard:false};
      }
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const dataBytes = new TextEncoder().encode(JSON.stringify(data)).length;
    const statements = [
      env.DB.prepare("INSERT OR IGNORE INTO users(id) VALUES (?)").bind(uid),
      env.DB.prepare(
        `INSERT INTO decks(id,owner_id,title,description,visibility,word_count,created_at,updated_at,data_bytes,content_hash,source_deck_id,source_title,source_hash,root_deck_id,content_source,is_fork)
         SELECT ?,?,?,?,'private',?,?,?,?,?,?,?,?,?,?,?
         WHERE ?='' OR ?=1 OR EXISTS(SELECT 1 FROM decks WHERE id=? AND (visibility='public' OR owner_id=?))`,
      ).bind(id,uid,data.title,data.description,data.words.length,now,now,dataBytes,await contentHash(data.words),source?.id ?? null,source?.title ?? "",source?.hash ?? "",source?.root ?? null,source?.contentSource ?? "",source ? 1 : 0,source?.id ?? "",source?.standard ? 1 : 0,source?.id ?? "",uid),
    ];
    // JSON batches keep imports and full-book forks within D1's statement and bind limits.
    for(let offset=0;offset<data.words.length;offset+=250) {
      const chunk=data.words.slice(offset,offset+250).map((word,i)=>({...word,id:crypto.randomUUID(),ordinal:offset+i}));
      statements.push(env.DB.prepare(`INSERT INTO words(id,deck_id,ordinal,word,meaning,example,tags,examples_json)
        SELECT json_extract(value,'$.id'),?,json_extract(value,'$.ordinal'),json_extract(value,'$.word'),json_extract(value,'$.meaning'),COALESCE(json_extract(value,'$.example'),''),json_extract(value,'$.tags'),COALESCE(json_extract(value,'$.examples'),'[]') FROM json_each(?)`).bind(id,JSON.stringify(chunk)));
    }
    if (data.textbookTags.length) {
      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO textbook_tags(id,name,edition,chapter) VALUES ${data.textbookTags.map(() => "(?,?,?,?)").join(",")}`,
        ).bind(
          ...data.textbookTags.flatMap((t) => [
            crypto.randomUUID(),
            t.name,
            t.edition ?? "",
            t.chapter ?? "",
          ]),
        ),
      );
      for (const tag of data.textbookTags)
        statements.push(
          env.DB.prepare(
            "INSERT INTO deck_textbook_tags(deck_id,tag_id) SELECT ?,id FROM textbook_tags WHERE name=? AND edition=? AND chapter=?",
          ).bind(id, tag.name, tag.edition ?? "", tag.chapter ?? ""),
        );
    }
    try { await env.DB.batch(statements); }
    catch (error) {
      if (source && /FOREIGN KEY/.test(String(error))) return json({error:"コピー元の公開状態が変わりました。開き直してください。"},409);
      throw error;
    }
    if (source) {
      const row = await env.DB.prepare(`${deckSelect} WHERE d.id=? AND d.owner_id=?`).bind(id,uid).first<DeckRow>();
      return json({deck:deckResult(row!)},201);
    }
    return json(
      {
        deck: {
          schemaVersion: 1,
          id,
          title: data.title,
          description: data.description,
          textbookTags: data.textbookTags,
          visibility: "private",
          wordCount: data.words.length,
          createdAt: now,
          updatedAt: now,
        } satisfies Deck,
      },
      201,
    );
  }
  const savePath = /^\/api\/decks\/([a-zA-Z0-9-]{1,80})\/save$/.exec(url.pathname);
  if (savePath && request.method === "POST") return savePublicDeck(env, uid, savePath[1]);
  const wordEdit = /^\/api\/decks\/([a-zA-Z0-9-]{1,80})\/words\/([a-zA-Z0-9-]{1,120})$/.exec(url.pathname);
  if (wordEdit && request.method === "PATCH") return editWord(env, uid, wordEdit[1], wordEdit[2], await limitedBody(request, LIMITS.bytes));
  const path = /^\/api\/decks\/([a-zA-Z0-9-]+)(\/words|\/visibility)?$/.exec(
    url.pathname,
  );
  if (path) {
    // Owner routes remain private even when the deck is publicly readable elsewhere.
    const row = await env.DB.prepare(
      `${deckSelect} WHERE d.id = ? AND d.owner_id = ?`,
    )
      .bind(path[1], uid)
      .first<DeckRow>();
    if (!row) return json({ error: "単語帳が見つかりません。" }, 404);
    if (path[2] === "/words" && request.method === "GET")
      return readWords(env.DB, row.id, url, uid);
    if (path[2] === "/visibility" && request.method === "PATCH") {
      let data: unknown;
      try {
        data = JSON.parse(await limitedBody(request, 1024));
      } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError("公開設定の形式が正しくありません。");
      }
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        !("visibility" in data) ||
        (data.visibility !== "public" && data.visibility !== "private")
      )
        throw new ValidationError("公開または非公開を指定してください。");
      const visibility = (data as { visibility: "public" | "private" })
        .visibility;
      return setVisibility(env, uid, row, visibility);
    }
    if (!path[2] && request.method === "GET")
      return json({ deck: deckResult(row) });
    if (!path[2] && request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM decks WHERE id=? AND owner_id=?")
        .bind(row.id, uid)
        .run();
      return json({ ok: true });
    }
  }
  return json({ error: "この操作は利用できません。" }, 404);
}
export function createHandler(verify: Verify = verifyFirebaseIdentity) {
  return async (request: Request, env: Env, ctx?: Pick<ExecutionContext, "waitUntil">): Promise<Response> => {
    const origin = request.headers.get("origin");
    const allowed = (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (origin && !allowed.includes(origin) && new URL(request.url).pathname !== "/api/email/unsubscribe")
      return json({ error: "このアクセス元は許可されていません。" }, 403);
    let response: Response;
    try {
      response =
        request.method === "OPTIONS"
          ? new Response(null, { status: 204 })
          : await route(request, env, verify);
      const emailAction = /^\/api\/admin\/emails\/([a-f0-9-]{36})\/(test|start)$/.exec(new URL(request.url).pathname);
      if (ctx && response.ok && request.method === 'POST' && emailAction) {
        ctx.waitUntil(processEmailQueue(env, fetch, {
          campaignId: emailAction[1], batchSize: emailAction[2] === 'test' ? 1 : 10, maxDurationMs: 20000,
        }).catch(() => { console.error('Azuki email background processing failed'); }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (error instanceof ValidationError)
        response = json({ error: message }, 400);
      else if (/AZUKI_.*LIMIT/.test(message))
        response = json(
          {
            error: message.includes("AZUKI_DECK_LIMIT")
              ? "単語帳の上限（20冊）に達しました。不要な単語帳を削除してから保存してください。"
              : message.includes("AZUKI_WORD_LIMIT")
                ? "保存できる単語数（合計15,000語）を超えます。不要な単語帳を削除してから保存してください。"
                : message.includes("AZUKI_DAILY_LIMIT")
                  ? "1日の登録上限（5,000語）を超えます。削除した分も当日分に含まれます。日本時間9時にリセットされます。"
                  : message.includes("AZUKI_APP_DAILY_LIMIT")
                    ? "アプリ全体の本日の登録上限に達しました。日本時間9時以降に、もう一度お試しください。"
                    : "アプリ全体の保存容量の上限に達しました。登録済みの単語帳は引き続き閲覧できます。",
            code: message.match(/AZUKI_[A-Z_]+LIMIT/)?.[0],
          },
          429,
        );
      else {
        console.error("Azuki request failed", {
          path: new URL(request.url).pathname,
          name: error instanceof Error ? error.name : "Unknown",
        });
        response = json(
          {
            error: "処理できませんでした。時間をおいてもう一度お試しください。",
          },
          503,
        );
      }
    }
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Vary", "Origin");
    if (origin) response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    return response;
  };
}
export default { fetch: createHandler(), scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) { ctx.waitUntil(processEmailQueue(env)); } };

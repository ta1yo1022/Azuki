import { limitedBody, type Env } from "./index";
import type { VerifiedIdentity } from "./auth";
import { REPORT_REASONS, type DeckReport } from "../shared/reports";
import { ValidationError } from "../shared/model";
const json = (data: unknown, status = 200) => Response.json(data, { status });
function body(raw: string): Record<string, unknown> {
  try { const value = JSON.parse(raw); if (value && typeof value === "object" && !Array.isArray(value)) return value; } catch {}
  throw new ValidationError("送信内容を確認してください。");
}
function note(value: unknown) {
  if (typeof value !== "string" || value.trim().length > 1000) throw new ValidationError("補足・対応メモは1,000文字以内で入力してください。");
  return value.trim();
}
export async function reportsRoute(request: Request, env: Env, identity: VerifiedIdentity) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/admin/")) {
    const isAdmin = identity.emailVerified && !!identity.email && (env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean).includes(identity.email.toLowerCase());
    if (url.pathname === "/api/admin/access" && request.method === "GET") return json({ isAdmin });
    if (!isAdmin) return json({ error: "管理画面を利用する権限がありません。" }, 403);
    if (url.pathname === "/api/admin/reports" && request.method === "GET") {
      const status = url.searchParams.get("status") ?? "pending";
      if (!["pending", "resolved", "dismissed"].includes(status)) throw new ValidationError("状態を確認してください。");
      const cursor = url.searchParams.get("cursor");
      let time = "9999", id = "";
      if (cursor) { try { const c = JSON.parse(cursor); if (!Array.isArray(c) || c.length !== 2 || c.some(v => typeof v !== "string" || v.length > 80)) throw new Error(); [time,id] = c; } catch { throw new ValidationError("ページの指定が正しくありません。"); } }
      const rows = await env.DB.prepare(`SELECT r.id,r.deck_id,r.deck_title,r.reason,r.details,r.status,r.created_at,r.updated_at,r.admin_note,d.visibility AS current_visibility FROM deck_reports r LEFT JOIN decks d ON d.id=r.deck_id WHERE r.status=? AND (r.created_at<? OR (r.created_at=? AND r.id<?)) ORDER BY r.created_at DESC,r.id DESC LIMIT 51`).bind(status,time,time,id).all<DeckReport>();
      const reports = rows.results.slice(0,50), last = reports.at(-1);
      return json({ reports, nextCursor: rows.results.length > 50 && last ? JSON.stringify([last.created_at,last.id]) : null });
    }
    const match = /^\/api\/admin\/reports\/([a-zA-Z0-9-]{1,80})$/.exec(url.pathname);
    if (match && request.method === "PATCH") {
      const data = body(await limitedBody(request,8192));
      if (typeof data.status !== "string" || !["pending","resolved","dismissed"].includes(data.status)) throw new ValidationError("状態を確認してください。");
      const result = await env.DB.prepare("UPDATE deck_reports SET status=?,admin_note=?,reviewed_by=?,updated_at=? WHERE id=? RETURNING id").bind(data.status,note(data.adminNote ?? ""),identity.uid,new Date().toISOString(),match[1]).first();
      return result ? json({ ok: true }) : json({error:"通報が見つかりません。"},404);
    }
    return json({error:"この操作は利用できません。"},404);
  }
  const match = /^\/api\/decks\/([a-zA-Z0-9-]{1,80})\/report$/.exec(url.pathname);
  if (!match || request.method !== "POST") return json({error:"この操作は利用できません。"},404);
  const data = body(await limitedBody(request,8192));
  if (typeof data.reason !== "string" || !Object.hasOwn(REPORT_REASONS,data.reason)) throw new ValidationError("通報理由を選択してください。");
  const details = note(data.details ?? "");
  if (data.reason === "other" && !details) throw new ValidationError("その他を選んだ場合は内容を入力してください。");
  const existing = await env.DB.prepare("SELECT id FROM deck_reports WHERE reporter_id=? AND deck_id=?").bind(identity.uid,match[1]).first();
  if (existing) return json({ok:true,duplicate:true});
  const now = new Date().toISOString();
  try {
    const result = await env.DB.prepare("INSERT INTO deck_reports(id,deck_id,deck_title,reporter_id,reason,details,created_at,updated_at) SELECT ?,id,title,?,?,?,?,? FROM decks WHERE id=? AND visibility='public' RETURNING id").bind(crypto.randomUUID(),identity.uid,data.reason,details,now,now,match[1]).first();
    return result ? json({ok:true},201) : json({error:"この単語帳は公開されていません。"},404);
  } catch (error) {
    if (String(error).includes("AZUKI_REPORT_LIMIT")) return json({error:"通報は24時間に5件までです。時間をおいてお試しください。"},429);
    if (String(error).includes("UNIQUE constraint failed")) return json({ok:true,duplicate:true});
    throw error;
  }
}

import { afterEach, vi, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { contentHash } from "../shared/content";
import { parseDeck } from "../shared/model";
import { createHandler, type Env } from "../worker";
import { verifyFirebaseToken } from "../worker/auth";
import { OFFICIAL_OWNER_ID } from "../worker/official";
afterEach(() => vi.restoreAllMocks());
const officialSeed = readFileSync(new URL("../content/official/seed.sql", import.meta.url), "utf8");
const previousOfficialSeed = readFileSync(new URL("../content/official/releases/v2/seed.sql", import.meta.url), "utf8");
const originalOfficialSeed = readFileSync(new URL("../content/official/releases/v1/seed.sql", import.meta.url), "utf8");
const officialManifest = JSON.parse(readFileSync(new URL("../content/official/manifest.json", import.meta.url), "utf8"));
const sample = (n = 2) => ({
  title: "日常のことば",
  textbookTags: [{ name: "教科書", edition: "第2版", chapter: "Lesson 1" }],
  words: Array.from({ length: n }, (_, i) => ({
    word: `word-${i}`,
    meaning: `意味 ${i}`,
    tags: ["名詞"],
  })),
});
function sqliteD1(db: DatabaseSync): D1Database {
  function prepare(sql: string) {
    const entry = {
      sql,
      values: [] as (string | number | null)[],
      bind(...values: (string | number | null)[]) {
        if (values.length > 100) throw new Error("D1 parameter limit");
        entry.values = values;
        return entry;
      },
      async first() {
        return db.prepare(sql).get(...entry.values) ?? null;
      },
      async all() {
        return { success: true, results: db.prepare(sql).all(...entry.values) };
      },
      execute() {
        return { success: true, meta: db.prepare(sql).run(...entry.values) };
      },
      async run() { return entry.execute(); },
    };
    return entry;
  }
  return {
    prepare,
    async batch(entries: ReturnType<typeof prepare>[]) {
      if (entries.length > 50) throw new Error("D1 query limit");
      db.exec("BEGIN");
      try {
        const results = [];
        // D1 serializes transactions; do not yield mid-transaction on this connection.
        for (const entry of entries) results.push(entry.execute());
        db.exec("COMMIT");
        return results;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  } as unknown as D1Database;
}
describe("JSON import boundary", () => {
  it("normalizes input and ignores forged ownership and public status", () => {
    const data = parseDeck(
      JSON.stringify({ ...sample(), ownerId: "other", visibility: "public", isOfficial: true, officialLevel: "advanced", contentSource: "ejdict" }),
    );
    expect(data.words).toHaveLength(2);
    expect(data).not.toHaveProperty("ownerId");
    expect(data).not.toHaveProperty("visibility");
    expect(data).not.toHaveProperty("isOfficial");
    expect(data).not.toHaveProperty("officialLevel");
    expect(data).not.toHaveProperty("contentSource");
  });
  it("rejects missing meaning, duplicate entries, invalid version, and too many words", () => {
    expect(() => parseDeck('{"title":"test","words":[{"word":"hi"}]}')).toThrow(
      "意味",
    );
    const data = sample(1);
    data.words.push({ ...data.words[0], word: " WORD-0 " });
    expect(() => parseDeck(JSON.stringify(data))).toThrow("重複");
    expect(() =>
      parseDeck(JSON.stringify({ ...sample(), schemaVersion: 2 })),
    ).toThrow("バージョン");
    expect(() => parseDeck(JSON.stringify(sample(5001)))).toThrow("5000");
  });
});
describe("owner isolation and atomic D1 imports", () => {
  let db: DatabaseSync;
  let env: Env;
  const handle = createHandler(async (token) => {
    if (token === "alice" || token === "bob") return token;
    if (token === "admin" || token === "unverified") return {uid:token,email:"admin@example.test",emailVerified:token === "admin"};
    throw new Error("bad token");
  });
  function call(path: string, method = "GET", data?: unknown, who = "alice") {
    return handle(
      new Request(`https://api.test/api${path}`, {
        method,
        headers: {
          Origin: "https://azuki.test",
          Authorization: `Bearer ${who}`,
          "Content-Type": "application/json",
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
      env,
    );
  }
  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    const dir = new URL("../migrations/", import.meta.url);
    for (const filename of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort())
      db.exec(readFileSync(new URL(filename, dir), "utf8"));
    env = {
      DB: sqliteD1(db),
      FIREBASE_PROJECT_ID: "azuki-test",
      ALLOWED_ORIGINS: "https://azuki.test",
      ALLOW_IMPORTS: "true",
    };
  });
  function audioMock(){
    const objects=new Map<string,ArrayBuffer>();
    const types=new Map<string,string>();
    const mp3=Uint8Array.from([73,68,51,...Array(50).fill(0)]).buffer;
    const run=vi.fn(async()=>({audio:btoa(String.fromCharCode(...new Uint8Array(mp3)))}));
    env.AI={run} as unknown as Ai;env.AUDIO_ENABLED='true';
    env.AUDIO={get:vi.fn(async(key:string)=>objects.has(key)?{body:new Response(objects.get(key)!).body,httpMetadata:{contentType:types.get(key)}}:null),put:vi.fn(async(key:string,data:ArrayBuffer,options:{httpMetadata:{contentType:string}})=>{objects.set(key,data);types.set(key,options.httpMetadata.contentType);})} as unknown as R2Bucket;
    return {objects,run};
  }
  it('generates stored words only, caches audio in R2, and checks access before every replay',async()=>{
    const {run,objects}=audioMock();
    const deck=(await (await call('/decks','POST',sample())).json() as any).deck;
    const word=db.prepare('SELECT id FROM words WHERE deck_id=? ORDER BY ordinal').get(deck.id) as any;
    const path=`/decks/${deck.id}/words/${word.id}/audio`;
    const first=await call(path,'POST',{text:'Never synthesize this injected text'});
    expect(first.status).toBe(200);expect(first.headers.get('content-type')).toBe('audio/mpeg');expect(objects.size).toBe(1);
    expect(run).toHaveBeenCalledWith('@cf/myshell-ai/melotts',{prompt:'word-0',lang:'en'});
    expect((await call(path,'POST')).status).toBe(200);expect(run).toHaveBeenCalledTimes(1);
    expect((await call(path,'POST',undefined,'bob')).status).toBe(404);
    expect((await call('/public'+path,'POST')).status).toBe(404);
    await call(`/decks/${deck.id}/visibility`,'PATCH',{visibility:'public'});
    expect((await call('/public'+path,'POST',undefined,'')).status).toBe(200);
    await call(`/decks/${deck.id}/visibility`,'PATCH',{visibility:'private'});
    expect((await call('/public'+path,'POST')).status).toBe(404);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('keeps cached audio working at the generation limit and never stores failed audio',async()=>{
    const {run,objects}=audioMock();env.AUDIO_DAILY_GENERATION_LIMIT='1';
    const deck=(await (await call('/decks','POST',sample())).json() as any).deck;
    const words=db.prepare('SELECT id FROM words WHERE deck_id=? ORDER BY ordinal').all(deck.id) as any[];
    const path=(i:number)=>`/decks/${deck.id}/words/${words[i].id}/audio`;
    expect((await call(path(0),'POST')).status).toBe(200);
    expect((await call(path(1),'POST')).status).toBe(429);
    expect((await call(path(0),'POST')).status).toBe(200);expect(run).toHaveBeenCalledTimes(1);
    env.AUDIO_DAILY_GENERATION_LIMIT='10';run.mockResolvedValueOnce({audio:btoa('Not a valid MP3 result')});
    expect((await call(path(1),'POST')).status).toBe(503);expect(objects.size).toBe(1);
    expect((db.prepare('SELECT count(*) AS n FROM audio_generation_locks').get() as any).n).toBe(0);
  });
  it('accepts the actual MeloTTS WAV format and preserves its type when replaying from R2',async()=>{
    const {run}=audioMock();const wav=new Uint8Array(76),view=new DataView(wav.buffer);
    wav.set(new TextEncoder().encode('RIFF'),0);view.setUint32(4,68,true);wav.set(new TextEncoder().encode('WAVEfmt '),8);
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,24000,true);view.setUint32(28,48000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);wav.set(new TextEncoder().encode('data'),36);view.setUint32(40,32,true);
    run.mockResolvedValueOnce({audio:btoa(String.fromCharCode(...wav))});
    const deck=(await (await call('/decks','POST',sample())).json() as any).deck;
    const word=db.prepare('SELECT id FROM words WHERE deck_id=? ORDER BY ordinal').get(deck.id) as any;
    const path=`/decks/${deck.id}/words/${word.id}/audio`;
    for(let i=0;i<2;i++){const result=await call(path,'POST');expect(result.status).toBe(200);expect(result.headers.get('content-type')).toBe('audio/wav');expect(new Uint8Array(await result.arrayBuffer())).toEqual(wav);}
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('does not generate the same audio twice while another request is running',async()=>{
    const {run}=audioMock();let resolve!:(value:{audio:string})=>void;
    run.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    const deck=(await (await call('/decks','POST',sample())).json() as any).deck;
    const word=db.prepare('SELECT id FROM words WHERE deck_id=? ORDER BY ordinal').get(deck.id) as any;
    const path=`/decks/${deck.id}/words/${word.id}/audio`;
    const pending=call(path,'POST');await vi.waitFor(()=>expect(run).toHaveBeenCalledTimes(1));
    expect((await call(path,'POST')).status).toBe(202);
    resolve({audio:btoa('ID3'+String.fromCharCode(...Array(50).fill(0)))});expect((await pending).status).toBe(200);
    expect((await call(path,'POST')).status).toBe(200);expect(run).toHaveBeenCalledTimes(1);
  });
  it("stores learning idempotently with Japanese dates and owner isolation",async()=>{
    const end=Date.now()-1000,event={id:'event-1',sessionId:'session-1',deckId:'azuki-cefrj-a1-1-v1',mode:'examples',start:end-15000,end};
    expect((await call('/study','POST',{events:[event]})).status).toBe(200);
    await call('/study','POST',{events:[event]});
    const summary=await (await call('/study')).json() as any;
    expect(summary.totalMilliseconds).toBe(15000);expect(summary.totalSessions).toBe(1);expect(summary.decks[0].title).toContain('CEFR-J A1');
    expect((await (await call('/study','GET',undefined,'bob')).json() as any).totalMilliseconds).toBe(0);
    expect((await call('/study','POST',{events:[{...event,id:'invalid',start:end-60001}]})).status).toBe(400);
    expect((await call('/study','POST',{events:[{...event,id:'future',start:end+100000,end:end+110000}]})).status).toBe(400);
    expect((await call('/study','POST',{events:[{...event,id:null}]})).status).toBe(400);
    const own=(await (await call('/decks','POST',sample())).json() as any).deck;
    await call('/study','POST',{events:[{...event,id:'private',deckId:own.id}]},'bob');
    expect((await (await call('/study','GET',undefined,'bob')).json() as any).decks).toEqual([]);
    expect((await call('/study','GET',undefined,'invalid')).status).toBe(401);
    expect(db.prepare('SELECT count(*) n FROM words WHERE deck_id=?').get(event.deckId)?.n).toBe(0);
  });
  it("imports 5,000 words into one book atomically and rejects 5,001",async()=>{
    const response=await call('/decks','POST',sample(5000));
    expect(response.status).toBe(201);
    const {deck}=await response.json() as any;
    expect(deck.wordCount).toBe(5000);
    expect(db.prepare('SELECT count(*) n FROM words WHERE deck_id=?').get(deck.id)?.n).toBe(5000);
    expect((await call('/decks','POST',sample(5001), 'bob')).status).toBe(400);
    expect(db.prepare("SELECT word_count,daily_words FROM users WHERE id='alice'").get()).toEqual({word_count:5000,daily_words:5000});
  });
  it("bookmarks references without copying words, isolates owners, and hides unavailable content", async () => {
    const source=(await (await call('/decks','POST',sample())).json() as any).deck;
    expect((await call(`/favorites/${source.id}`,'PUT',undefined,'bob')).status).toBe(404);
    await call(`/decks/${source.id}/visibility`,'PATCH',{visibility:'public'});
    expect((await call('/favorites/azuki-cefrj-a1-1-v1','PUT',undefined,'bob')).status).toBe(200);
    await call(`/favorites/${source.id}`,'PUT',undefined,'bob');
    await call(`/favorites/${source.id}`,'PUT',undefined,'bob');
    const list=await (await call('/favorites','GET',undefined,'bob')).json() as any;
    expect(list.favorites).toHaveLength(2);
    expect((await (await call('/favorites')).json() as any).favorites).toEqual([]);
    expect((await (await call('/decks','GET',undefined,'bob')).json() as any).decks).toEqual([]);
    expect(db.prepare('SELECT count(*) n FROM words').get()?.n).toBe(2);
    await call(`/decks/${source.id}/visibility`,'PATCH',{visibility:'private'});
    const hidden=await (await call('/favorites','GET',undefined,'bob')).json() as any;
    expect(hidden.favorites.find((f:any)=>f.id===source.id).deck).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain(source.title);
    await call(`/favorites/${source.id}`,'DELETE');
    expect((await (await call('/favorites','GET',undefined,'bob')).json() as any).favorites).toHaveLength(2);
    await call(`/favorites/${source.id}`,'DELETE',undefined,'bob');
    expect((await (await call('/favorites','GET',undefined,'bob')).json() as any).favorites).toHaveLength(1);
    expect((await call('/favorites/missing','PUT')).status).toBe(404);
    expect((await call('/favorites','GET',undefined,'invalid')).status).toBe(401);
  });
  it("forks edited JSON atomically with trusted lineage and supports multiple forks", async () => {
    const source=(await (await call("/decks","POST",sample())).json() as any).deck;
    expect((await call(`/decks/${source.id}/fork`,"POST",sample(),"bob")).status).toBe(404);
    await call(`/decks/${source.id}/visibility`,"PATCH",{visibility:"public"});
    const edited={...sample(),title:"My fork",words:[{word:"hello",meaning:"こんにちは",example:"Hello, my name is Amy.",tags:[]}],isOfficial:true,sourceDeck:{id:"forged"}};
    const response=await call(`/decks/${source.id}/fork`,"POST",edited,"bob");
    expect(response.status).toBe(201);
    const fork=(await response.json() as any).deck;
    expect(fork.visibility).toBe("private");expect(fork.isOfficial).toBe(false);
    expect(fork.sourceDeck.id).toBe(source.id);expect(fork.unchangedCopy).toBe(false);
    expect((await call(`/decks/${fork.id}/visibility`,"PATCH",{visibility:"public"},"bob")).status).toBe(200);
    expect((await call(`/decks/${source.id}/fork`,"POST",edited,"bob")).status).toBe(201);
    expect((await call(`/decks/${source.id}/save`,"POST",undefined,"bob")).status).toBe(201);
    expect((await call(`/decks/${source.id}/save`,"POST",undefined,"bob")).status).toBe(200);
    expect(db.prepare("SELECT count(*) AS n FROM words WHERE deck_id=?").get(source.id)?.n).toBe(2);
    const unchanged=(await (await call(`/decks/${source.id}/fork`,"POST",sample(),"bob")).json() as any).deck;
    expect((await call(`/decks/${unchanged.id}/visibility`,"PATCH",{visibility:"public"},"bob")).status).toBe(409);
  });
  it("forks an entire CEFR book beyond 500 words and permits later word editing",async()=>{
    const catalog=JSON.parse(readFileSync('shared/cefrj-catalog.json','utf8'));
    const book=catalog.find((d:any)=>d.id==='azuki-cefrj-b2-1-v1');
    const words=JSON.parse(readFileSync(`public/content/cefrj/${book.file}`,'utf8'));
    const response=await call(`/decks/${book.id}/fork`,"POST",{title:'全編',words});
    expect(response.status).toBe(201);
    const deck=(await response.json() as any).deck;
    expect(deck.wordCount).toBe(1390);
    expect(db.prepare('SELECT count(*) AS n FROM words WHERE deck_id=?').get(deck.id)?.n).toBe(1390);
    const word=db.prepare('SELECT * FROM words WHERE deck_id=? ORDER BY ordinal LIMIT 1').get(deck.id) as any;
    const examples=JSON.parse(word.examples_json);
    expect(examples[0].translation).toMatch(/[ぁ-んァ-ン一-龥]/);
    const edited=await call(`/decks/${deck.id}/words/${word.id}`,"PATCH",{word:word.word,meaning:'編集した意味',examples,expectedWord:word.word,expectedMeaning:word.meaning,expectedExample:word.example,expectedExamples:examples});
    expect(edited.status).toBe(200);
    expect((await edited.json() as any).word.examples).toEqual(examples);
  });
  it("forks standard books with server-owned attribution and validates limits before writing", async () => {
    const id="azuki-cefrj-a1-1-v1";
    const response=await call(`/decks/${id}/fork`,"POST",sample());
    expect(response.status).toBe(201);
    const deck=(await response.json() as any).deck;
    expect(deck.sourceDeck).toEqual({id,title:"CEFR-J A1 前編",available:true});
    expect(deck.contentSource).toBe("cefrj");expect(deck.isOfficial).toBe(false);
    expect((await call(`/decks/${id}/fork`,"POST",sample(5001))).status).toBe(400);
    expect((await call('/decks/nonexistent/fork',"POST",sample())).status).toBe(404);
    expect(db.prepare("SELECT count(*) AS n FROM decks").get()?.n).toBe(1);
    env.ALLOW_IMPORTS="false";
    expect((await call(`/decks/${id}/fork`,"POST",sample())).status).toBe(503);
  });
  it("accepts reports only for known standard decks and shows them to admins", async () => {
    env.ADMIN_EMAILS = "admin@example.test";
    const id = "azuki-cefrj-a1-1-v1";
    expect((await call(`/decks/${id}/report`, "POST", {reason:"inaccurate",details:"参考訳の確認"}, "bob")).status).toBe(201);
    expect((await call(`/decks/azuki-cefrj-fake/report`, "POST", {reason:"spam"}, "bob")).status).toBe(404);
    const response = await call("/admin/reports", "GET", undefined, "admin");
    const result = await response.json() as any;
    expect(result.reports[0].deck_title).toBe("CEFR-J A1 前編");
    expect(result.reports[0].current_visibility).toBe("public");
    expect(db.prepare("SELECT count(*) AS n FROM decks").get()).toEqual({n:0});
  });
  it("keeps reports private, deduplicates them, and restricts administration to verified configured admins", async () => {
    env.ADMIN_EMAILS="admin@example.test";
    const {deck}=await (await call("/decks","POST",sample())).json() as any;
    expect((await call(`/decks/${deck.id}/report`,"POST",{reason:"copyright"},"bob")).status).toBe(404);
    await call(`/decks/${deck.id}/visibility`,"PATCH",{visibility:"public"});
    expect((await call(`/decks/${deck.id}/report`,"POST",{reason:"wrong"},"bob")).status).toBe(400);
    expect((await call(`/decks/${deck.id}/report`,"POST",{reason:"other"},"bob")).status).toBe(400);
    expect((await call(`/decks/${deck.id}/report`,"POST",{reason:"copyright",details:"Please review",reporter_id:"alice",status:"resolved"},"bob")).status).toBe(201);
    expect((await (await call(`/decks/${deck.id}/report`,"POST",{reason:"copyright"},"bob")).json() as any).duplicate).toBe(true);
    expect(db.prepare("SELECT reporter_id,status FROM deck_reports").get()).toEqual({reporter_id:"bob",status:"pending"});
    expect((await call("/admin/reports")).status).toBe(403);
    expect((await call("/admin/reports","GET",undefined,"unverified")).status).toBe(403);
    const {reports}=await (await call("/admin/reports","GET",undefined,"admin")).json() as any;
    expect(reports).toHaveLength(1);
    expect(reports[0]).not.toHaveProperty("reporter_id");
    expect((await call(`/admin/reports/${reports[0].id}`,"PATCH",{status:"resolved",adminNote:"reviewed"})).status).toBe(403);
    expect((await call(`/admin/reports/${reports[0].id}`,"PATCH",{status:"resolved",adminNote:"reviewed"},"admin")).status).toBe(200);
    expect(db.prepare("SELECT visibility FROM decks WHERE id=?").get(deck.id)?.visibility).toBe("public");
    await call(`/decks/${deck.id}`,"DELETE");
    const archived=await (await call("/admin/reports?status=resolved","GET",undefined,"admin")).json() as any;
    expect(archived.reports[0].current_visibility).toBeNull();
    expect(archived.reports[0].deck_title).toBe(deck.title);
    env.ADMIN_EMAILS="";
    expect((await call("/admin/reports","GET",undefined,"admin")).status).toBe(403);
  });
  it("limits reports across concurrent submissions without changing deck visibility", async () => {
    const ids:string[]=[];
    for(let i=0;i<6;i++) {
      const input=sample(1);input.words[0].word=`report-${i}`;
      const {deck}=await (await call("/decks","POST",input)).json() as any;
      await call(`/decks/${deck.id}/visibility`,"PATCH",{visibility:"public"});ids.push(deck.id);
    }
    const results=await Promise.all(ids.map(id=>call(`/decks/${id}/report`,"POST",{reason:"spam"},"bob")));
    expect(results.filter(r=>r.status===201)).toHaveLength(5);
    expect(results.filter(r=>r.status===429)).toHaveLength(1);
    expect(db.prepare("SELECT count(*) AS n FROM decks WHERE visibility='public'").get()?.n).toBe(6);
  });
  it("requires a valid login and exact allowed origin", async () => {
    expect((await call("/decks", "GET", undefined, "invalid")).status).toBe(
      401,
    );
    expect(
      (await handle(new Request("https://api.test/api/decks"), env)).status,
    ).toBe(401);
    expect(
      (
        await handle(
          new Request("https://api.test/api/decks", {
            headers: { Origin: "https://evil.test" },
          }),
          env,
        )
      ).status,
    ).toBe(403);
  });
  it("imports privately, reads textbook tags, and blocks another user from reading/deleting", async () => {
    const response = await call("/decks", "POST", {
      ...sample(),
      visibility: "public",
      owner_id: "bob",
    });
    expect(response.status).toBe(201);
    const { deck } = (await response.json()) as any;
    expect(deck.visibility).toBe("private");
    expect(
      (await call(`/decks/${deck.id}`, "GET", undefined, "bob")).status,
    ).toBe(404);
    expect(
      (await call(`/decks/${deck.id}/words`, "GET", undefined, "bob")).status,
    ).toBe(404);
    expect(
      (await call(`/decks/${deck.id}`, "DELETE", undefined, "bob")).status,
    ).toBe(404);
    const list = (await (await call("/decks")).json()) as any;
    expect(list.decks[0].textbookTags[0].name).toBe("教科書");
    expect(
      ((await (await call("/decks", "GET", undefined, "bob")).json()) as any)
        .decks,
    ).toHaveLength(0);
    expect((await call(`/decks/${deck.id}`)).headers.get("cache-control")).toBe(
      "no-store",
    );
  });
  function anonymous(path: string, method = "GET", body?: unknown) {
    return handle(
      new Request(`https://api.test/api/public${path}`, {
        method,
        headers: {
          Origin: "https://azuki.test",
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      env,
    );
  }
  async function published(count = 2) {
    const { deck } = await (await call("/decks", "POST", {
      ...sample(count), description: "保存用の説明",
      words: sample(count).words.map((word) => ({ ...word, example: "A useful example." })),
    })).json() as any;
    await call(`/decks/${deck.id}/visibility`, "PATCH", { visibility: "public" });
    return deck;
  }
  async function editFirst(id: string, who = "bob", changes: Record<string,string> = {example: "A new example."}) {
    const { words } = await (await call(`/decks/${id}/words`, "GET", undefined, who)).json() as any;
    const w = words[0];
    return call(`/decks/${id}/words/${w.id}`, "PATCH", {word:w.word, meaning:w.meaning, example:w.example, ...changes, expectedWord:w.word,expectedMeaning:w.meaning,expectedExample:w.example}, who);
  }
  it("round-trips multiple examples through imports, public copies, forks and in-place edits",async()=>{
    const examples=[{text:'The captain refused to leave.',translation:'船長は立ち去ることを拒んだ。'},{text:'She refused the invitation.'}];
    const input={title:'例文のある単語帳',words:[{word:'refuse',meaning:'拒否する',examples,tags:['動詞']},{word:'stay',meaning:'とどまる',examples:[{text:'Stay here.'},{text:'We stayed at home.'}],tags:[]}]};
    const created=await call('/decks','POST',input);expect(created.status).toBe(201);const {deck}=await created.json() as any;
    const page=await (await call(`/decks/${deck.id}/words`)).json() as any;
    expect(page.words[0]).toMatchObject({example:examples[0].text,examples});
    await call(`/decks/${deck.id}/visibility`,'PATCH',{visibility:'public'});
    const copied=await (await call(`/decks/${deck.id}/save`,'POST',undefined,'bob')).json() as any;
    expect((await (await call(`/decks/${copied.deck.id}/words`,'GET',undefined,'bob')).json() as any).words[0].examples).toEqual(examples);
    const forked=await call(`/decks/${deck.id}/fork`,'POST',input,'bob');expect(forked.status).toBe(201);
    expect((await (await call(`/decks/${(await forked.json() as any).deck.id}/words`,'GET',undefined,'bob')).json() as any).words[1].examples).toEqual(input.words[1].examples);
    const old=page.words[0],next=[...examples,{text:'I refuse to give up.',translation:'諦めない。'}];
    const edit={word:old.word,meaning:old.meaning,examples:next,expectedWord:old.word,expectedMeaning:old.meaning,expectedExample:old.example,expectedExamples:examples};
    expect((await call(`/decks/${deck.id}/words/${old.id}`,'PATCH',edit)).status).toBe(200);
    const latest=await (await call(`/decks/${deck.id}/words`)).json() as any;
    expect(latest.words[0].examples).toEqual(next);expect(latest.words[1].examples).toEqual(input.words[1].examples);
    expect((await call(`/decks/${deck.id}/words/${old.id}`,'PATCH',edit)).status).toBe(409);
    expect((await call(`/decks/${deck.id}/words/${old.id}`,'PATCH',edit,'bob')).status).toBe(404);
    expect(db.prepare('SELECT visibility,word_count FROM decks WHERE id=?').get(deck.id)).toEqual({visibility:'private',word_count:2});
    expect(db.prepare("SELECT word_count FROM users WHERE id='alice'").get()?.word_count).toBe(2);
  });
  it('preserves legacy examples and allows deleting every example without changing word quotas',async()=>{
    const deck=await published(1);const old=(await (await call(`/decks/${deck.id}/words`)).json() as any).words[0];
    const edit={word:old.word,meaning:old.meaning,examples:[],expectedWord:old.word,expectedMeaning:old.meaning,expectedExample:old.example,expectedExamples:[{text:old.example}]};
    expect((await call(`/decks/${deck.id}/words/${old.id}`,'PATCH',edit)).status).toBe(200);
    const latest=(await (await call(`/decks/${deck.id}/words`)).json() as any).words[0];
    expect(latest.example).toBe('');expect(latest.examples).toBeUndefined();
    expect(db.prepare("SELECT word_count FROM users WHERE id='alice'").get()?.word_count).toBe(1);
  });
  it('counts translations and added examples in storage limits and rolls the whole edit back',async()=>{
    const deck=await published(1);const old=(await (await call(`/decks/${deck.id}/words`)).json() as any).words[0];
    const before=db.prepare('SELECT * FROM words WHERE id=?').get(old.id);
    db.exec('UPDATE app_usage SET byte_count=104857600');
    const response=await call(`/decks/${deck.id}/words/${old.id}`,'PATCH',{word:old.word,meaning:old.meaning,examples:[{text:old.example},{text:'Another sentence.',translation:'別の例文です。'}],expectedWord:old.word,expectedMeaning:old.meaning,expectedExample:old.example});
    expect(response.status).toBe(429);expect(db.prepare('SELECT * FROM words WHERE id=?').get(old.id)).toEqual(before);
  });
  it("blocks unchanged copies even after metadata changes or source withdrawal", async () => {
    const original = await published();
    const {deck:copy} = await (await call(`/decks/${original.id}/save`,"POST",undefined,"bob")).json() as any;
    expect(copy.sourceDeck).toEqual({id:original.id,title:original.title,available:true});
    expect(copy.unchangedCopy).toBe(true);
    db.prepare("UPDATE decks SET title='renamed',description='new description' WHERE id=?").run(copy.id);
    let response = await call(`/decks/${copy.id}/visibility`,"PATCH",{visibility:"public"},"bob");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({code:"unchanged_copy",existingDeckId:original.id});
    await call(`/decks/${original.id}/visibility`,"PATCH",{visibility:"private"});
    response = await call(`/decks/${copy.id}/visibility`,"PATCH",{visibility:"public"},"bob");
    expect(await response.json()).not.toHaveProperty("existingDeckId");
    expect((await (await call(`/decks/${copy.id}`,"GET",undefined,"bob")).json() as any).deck.sourceDeck.available).toBe(false);
    await call(`/decks/${original.id}`,"DELETE");
    expect((await call(`/decks/${copy.id}/visibility`,"PATCH",{visibility:"public"},"bob")).status).toBe(409);
  });
  it("rejects equivalent imports with reordered words, typography and tag changes", async () => {
    const original = await published();
    const input = {...sample(), title:"A different title", words:sample().words.reverse().map(w=>({...w,word:w.word.toUpperCase(),example:"  A useful   example.  ",tags:["changed"]}))};
    const {deck} = await (await call("/decks","POST",input,"bob")).json() as any;
    const response = await call(`/decks/${deck.id}/visibility`,"PATCH",{visibility:"public"},"bob");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({code:"duplicate_content",existingDeckId:original.id});
  });
  it("publishes edited copies as variants, groups search, and preserves direct links", async () => {
    const original = await published();
    const {deck:copy} = await (await call(`/decks/${original.id}/save`,"POST",undefined,"bob")).json() as any;
    const edit = await editFirst(copy.id);
    expect(edit.status).toBe(200);
    expect((await edit.json() as any).deck).toMatchObject({unchangedCopy:false,visibility:"private"});
    db.prepare("UPDATE decks SET title='variant search title' WHERE id=?").run(copy.id);
    expect((await call(`/decks/${copy.id}/visibility`,"PATCH",{visibility:"public"},"bob")).status).toBe(200);
    const page = await (await anonymous("/decks")).json() as any;
    expect(page.decks.map((d:any)=>d.id)).toEqual([original.id]);
    expect(page.decks[0].variantCount).toBe(1);
    expect((await (await anonymous("/decks?q=variant")).json() as any).decks[0].id).toBe(original.id);
    expect((await (await anonymous(`/decks/${original.id}/variants`)).json() as any).decks.map((d:any)=>d.id)).toEqual([copy.id]);
    expect((await anonymous(`/decks/${copy.id}`)).status).toBe(200);
    expect((await anonymous(`/decks/${copy.id}/words`)).status).toBe(200);
    await call(`/decks/${original.id}/visibility`,"PATCH",{visibility:"private"});
    expect((await (await anonymous("/decks")).json() as any).decks.map((d:any)=>d.id)).toEqual([copy.id]);
    expect((await anonymous(`/decks/${original.id}/variants`)).status).toBe(404);
    const visible = await (await anonymous(`/decks/${copy.id}`)).json() as any;
    expect(visible.deck.sourceDeck.available).toBe(false);
    await call(`/decks/${original.id}`,"DELETE");
    expect((await (await anonymous("/decks")).json() as any).decks[0].id).toBe(copy.id);
  });
  it("unpublishes edits and prevents reverting to an unchanged copy", async () => {
    const original = await published();
    const {deck:copy} = await (await call(`/decks/${original.id}/save`,"POST",undefined,"bob")).json() as any;
    await editFirst(copy.id);
    await call(`/decks/${copy.id}/visibility`,"PATCH",{visibility:"public"},"bob");
    await editFirst(copy.id,"bob",{example:"A useful example."});
    expect((await anonymous(`/decks/${copy.id}`)).status).toBe(404);
    expect((await call(`/decks/${copy.id}/visibility`,"PATCH",{visibility:"public"},"bob")).status).toBe(409);
  });
  it("validates edits, isolates owners, rejects stale writes, and rolls back on storage limits", async () => {
    const original = await published();
    const {words} = await (await call(`/decks/${original.id}/words`)).json() as any;
    const w=words[0]; const path=`/decks/${original.id}/words/${w.id}`;
    const data={word:w.word,meaning:w.meaning,example:"New.",expectedWord:w.word,expectedMeaning:w.meaning,expectedExample:w.example};
    expect((await call(path,"PATCH",data,"bob")).status).toBe(404);
    expect((await call(path,"PATCH",{...data,meaning:""})).status).toBe(400);
    const before=db.prepare("SELECT * FROM words WHERE id=?").get(w.id);
    db.exec("UPDATE app_usage SET byte_count=104857600");
    expect((await call(path,"PATCH",{...data,example:"Long example. ".repeat(70)})).status).toBe(429);
    expect(db.prepare("SELECT * FROM words WHERE id=?").get(w.id)).toEqual(before);
    db.exec("UPDATE app_usage SET byte_count=(SELECT sum(data_bytes) FROM decks)");
    expect((await call(path,"PATCH",data)).status).toBe(200);
    expect((await call(path,"PATCH",{...data,example:"stale"})).status).toBe(409);
    expect(db.prepare("SELECT byte_count FROM app_usage").get()).toEqual(db.prepare("SELECT sum(data_bytes) AS byte_count FROM decks").get());
  });
  it("serializes identical publication attempts and returns the winner", async () => {
    const a = await (await call("/decks","POST",sample())).json() as any;
    const b = await (await call("/decks","POST",sample(),"bob")).json() as any;
    const responses = await Promise.all([call(`/decks/${a.deck.id}/visibility`,"PATCH",{visibility:"public"}),call(`/decks/${b.deck.id}/visibility`,"PATCH",{visibility:"public"},"bob")]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
    expect((await (await anonymous("/decks")).json() as any).decks).toHaveLength(1);
  });
  it("keeps legacy identical public links while grouping them and paging distinct variants", async () => {
    const original = await published(1);
    const {deck:copy} = await (await call(`/decks/${original.id}/save`, "POST", undefined, "bob")).json() as any;
    // Simulate records published by the previous version, before the guard existed.
    db.exec("DROP TRIGGER prevent_duplicate_publication");
    db.prepare("UPDATE decks SET visibility='public' WHERE id=?").run(copy.id);
    expect((await (await anonymous("/decks")).json() as any).decks.map((d:any)=>d.id)).toEqual([original.id]);
    expect((await anonymous(`/decks/${copy.id}`)).status).toBe(200);
    expect((await (await anonymous(`/decks/${original.id}/variants`)).json() as any).decks).toEqual([]);
    for(let i=0;i<23;i++) {
      const who=i<18 ? "alice" : "bob";
      const {deck:d}=await (await call("/decks","POST",{...sample(1),words:[{word:`variant-${i}`,meaning:"例",tags:[]}]},who)).json() as any;
      db.prepare("UPDATE decks SET root_deck_id=?,source_title='original',source_hash='baseline',visibility='public',created_at='2026-01-01T00:00:00.000Z' WHERE id=?").run(original.id,d.id);
    }
    const first=await (await anonymous(`/decks/${original.id}/variants`)).json() as any;
    expect(first.decks).toHaveLength(20);
    const second=await (await anonymous(`/decks/${original.id}/variants?cursor=${encodeURIComponent(first.nextCursor)}`)).json() as any;
    expect(second.decks).toHaveLength(3);expect(second.nextCursor).toBeNull();
    expect(new Set([...first.decks,...second.decks].map((d:any)=>d.id)).size).toBe(23);
  });
  it("seeds five complete public official books idempotently, preserving user content and quota", async () => {
    const existing = await published();
    const snapshot = await (await anonymous(`/decks/${existing.id}`)).json();
    db.exec(officialSeed);
    const quota = db.prepare("SELECT * FROM app_usage").get();
    const list = await (await anonymous("/decks")).json() as any;
    expect(list.decks).toHaveLength(1);
    expect(list.decks.filter((deck: any) => deck.isOfficial)).toHaveLength(0);
    expect(db.prepare("SELECT word_count,deck_count,daily_words FROM users WHERE id=?").get(OFFICIAL_OWNER_ID))
      .toEqual({ word_count: 2500, deck_count: 5, daily_words: 2500 });
    // Existing rows must be skipped before quota triggers, even at the daily cap.
    db.prepare("UPDATE users SET daily_words=5000 WHERE id=?").run(OFFICIAL_OWNER_ID);
    db.exec(officialSeed);
    expect(db.prepare("SELECT * FROM app_usage").get()).toEqual(quota);
    expect(await (await anonymous(`/decks/${existing.id}`)).json()).toEqual(snapshot);
    vi.spyOn(globalThis,"fetch").mockImplementation(async input => Response.json(JSON.parse(readFileSync(`public${new URL(String(input)).pathname}`,"utf8"))));
    for (const entry of officialManifest.decks) {
      const expected = parseDeck(readFileSync(new URL(`../content/official/${entry.file}`, import.meta.url), "utf8"));
      const { deck } = await (await anonymous(`/decks/${entry.id}`)).json() as any;
      expect(deck).toMatchObject({ isOfficial: true, officialLevel: entry.level, contentSource: "ejdict", visibility: "public", wordCount: 500, title: expected.title });
      expect(deck).not.toHaveProperty("owner_id");
      for (let cursor = 0; cursor < 500; cursor += 50) {
        const page = await (await anonymous(`/decks/${entry.id}/words?cursor=${cursor}`)).json() as any;
        expect(page.nextCursor).toBe(cursor === 450 ? null : cursor + 50);
        expect(page.words.map(({ id: _id, ordinal: _ordinal, ...word }: any) => word))
          .toEqual(expected.words.slice(cursor, cursor + 50).map(word => ({ example: "", ...word })));
      }
      expect((await call(`/decks/${entry.id}`, "DELETE")).status).toBe(404);
      expect((await call(`/decks/${entry.id}/visibility`, "PATCH", { visibility: "private" })).status).toBe(404);
    }
    const travel = await (await anonymous(`/decks?q=${encodeURIComponent("旅行")}`)).json() as any;
    expect(travel.decks.map((deck: any) => deck.id)).not.toContain("azuki-official-travel-v1");
  });
  it("upgrades the first edition in place and preserves the first 50 words and existing saved copies", async () => {
    const existing = await published();
    const userSnapshot = db.prepare("SELECT * FROM decks WHERE id=?").get(existing.id);
    db.exec(originalOfficialSeed);
    const original = officialManifest.decks[0].id;
    const firstWords = db.prepare("SELECT * FROM words WHERE deck_id=? ORDER BY ordinal").all(original);
    const firstDecks = db.prepare("SELECT id,created_at FROM decks WHERE owner_id=? ORDER BY id").all(OFFICIAL_OWNER_ID);
    const { deck: oldCopy } = await (await call(`/decks/${original}/save`, "POST", undefined, "bob")).json() as any;
    const copySnapshot = db.prepare("SELECT * FROM decks WHERE id=?").get(oldCopy.id);
    db.exec("BEGIN");
    db.exec(officialSeed);
    db.exec("COMMIT");
    expect(db.prepare("SELECT id,created_at FROM decks WHERE owner_id=? ORDER BY id").all(OFFICIAL_OWNER_ID)).toEqual(firstDecks);
    expect(db.prepare("SELECT * FROM words WHERE deck_id=? AND ordinal<50 ORDER BY ordinal").all(original)).toEqual(firstWords);
    expect(db.prepare("SELECT * FROM decks WHERE id=?").get(existing.id)).toEqual(userSnapshot);
    expect(db.prepare("SELECT * FROM decks WHERE id=?").get(oldCopy.id)).toEqual(copySnapshot);
    expect(copySnapshot?.word_count).toBe(50);
    expect(db.prepare("SELECT word_count,deck_count,daily_words FROM users WHERE id=?").get(OFFICIAL_OWNER_ID))
      .toEqual({ word_count: 2500, deck_count: 5, daily_words: 2500 });
    const usage = db.prepare("SELECT word_count,byte_count FROM app_usage").get();
    expect(usage).toEqual(db.prepare("SELECT sum(word_count) AS word_count,sum(data_bytes) AS byte_count FROM decks").get());
    expect(usage?.word_count).toBe(2552);
    expect(db.prepare("SELECT count(*) AS count FROM decks WHERE official_revision=3 AND visibility='public'").get()?.count).toBe(5);
    // An already-applied edition remains a no-op even if today's global cap is full.
    db.exec("UPDATE app_usage SET daily_words=10000");
    const snapshot = db.prepare("SELECT * FROM app_usage").get();
    db.exec(officialSeed);
    expect(db.prepare("SELECT * FROM app_usage").get()).toEqual(snapshot);
  });
  it("adds examples to the 500-word edition without changing vocabulary or charging words again", async () => {
    db.exec(previousOfficialSeed);
    const id = officialManifest.decks[0].id;
    const { deck: copy } = await (await call(`/decks/${id}/save`, "POST")).json() as any;
    const snapshot = () => db.prepare("SELECT * FROM words ORDER BY id").all() as any[];
    const before = snapshot();
    const originalDecks = db.prepare("SELECT id,created_at,word_count,official_level FROM decks ORDER BY id").all();
    db.exec("UPDATE app_usage SET daily_words=10000");
    const quota = db.prepare("SELECT word_count,daily_words FROM app_usage").get();
    const oldBytes = db.prepare("SELECT byte_count FROM app_usage").get()?.byte_count as number;
    db.exec("BEGIN");
    db.exec(officialSeed);
    db.exec("COMMIT");
    const after = snapshot();
    expect(after.map(({ example: _example, ...word }) => word)).toEqual(before.map(({ example: _example, ...word }) => word));
    for (let i = 0; i < before.length; i++) {
      if (before[i].example || before[i].deck_id === copy.id) expect(after[i]).toEqual(before[i]);
      else expect(after[i].example.length).toBeGreaterThan(10);
    }
    expect(db.prepare("SELECT id,created_at,word_count,official_level FROM decks ORDER BY id").all()).toEqual(originalDecks);
    expect(db.prepare("SELECT word_count,daily_words FROM app_usage").get()).toEqual(quota);
    expect(db.prepare("SELECT byte_count FROM app_usage").get()?.byte_count).toBeGreaterThan(oldBytes);
    expect(db.prepare("SELECT byte_count FROM app_usage").get()).toEqual(db.prepare("SELECT sum(data_bytes) AS byte_count FROM decks").get());
    expect(db.prepare("SELECT count(*) AS count FROM words w JOIN decks d ON d.id=w.deck_id WHERE d.owner_id=? AND length(trim(w.example))>0").get(OFFICIAL_OWNER_ID)?.count).toBe(2500);
  });
  it("allows editorial updates and content growth beyond the former daily caps while enforcing storage", async () => {
    db.exec(originalOfficialSeed);
    db.exec("UPDATE app_usage SET daily_words=10000");
    expect(()=>db.exec(officialSeed)).not.toThrow();
    db.exec("UPDATE app_usage SET byte_count=104857600");
    const {deck}=await (await call('/decks','POST',sample())).json() as any;
    // Imports are rolled back when storage is exhausted.
    expect(deck).toBeUndefined();
    db.exec("UPDATE app_usage SET byte_count=(SELECT sum(data_bytes) FROM decks)");
    const saved=(await (await call('/decks','POST',sample())).json() as any).deck;
    db.exec("UPDATE users SET daily_words=50000 WHERE id='alice'");
    expect(()=>db.prepare('UPDATE decks SET word_count=3 WHERE id=?').run(saved.id)).not.toThrow();
  });
  it("retains attribution through saved copies and deletion without transferring official status", async () => {
    db.exec(officialSeed);
    const original = "azuki-official-daily-v1";
    const response = await call(`/decks/${original}/save`, "POST");
    expect(response.status).toBe(201);
    const { deck: copy } = await response.json() as any;
    expect(copy).toMatchObject({ isOfficial: false, contentSource: "ejdict", wordCount: 500, visibility: "private" });
    expect(copy).not.toHaveProperty("officialLevel");
    expect(db.prepare("SELECT official_level FROM decks WHERE id=?").get(copy.id)?.official_level).toBe("");
    await editFirst(copy.id, "alice", {example: "A different editorial example."});
    expect((await call(`/decks/${copy.id}/visibility`, "PATCH", { visibility: "public" })).status).toBe(200);
    const { deck: second } = await (await call(`/decks/${copy.id}/save`, "POST", undefined, "bob")).json() as any;
    db.prepare("DELETE FROM decks WHERE id=?").run(original);
    await call(`/decks/${copy.id}`, "DELETE");
    const { deck: remaining } = await (await call(`/decks/${second.id}`, "GET", undefined, "bob")).json() as any;
    expect(remaining).toMatchObject({ isOfficial: false, contentSource: "ejdict", wordCount: 500 });
    expect(remaining).not.toHaveProperty("officialLevel");
    expect((await (await call(`/decks/${second.id}/words`, "GET", undefined, "bob")).json() as any).words).toHaveLength(50);
  });
  it("cannot create an official book by forging imported metadata or signing in as the reserved owner", async () => {
    const { deck } = await (await call("/decks", "POST", {
      ...sample(), owner_id: OFFICIAL_OWNER_ID, isOfficial: true, officialLevel: "advanced", official_level: "advanced", contentSource: "ejdict", content_source: "ejdict",
    })).json() as any;
    const stored = await (await call(`/decks/${deck.id}`)).json() as any;
    expect(stored.deck.isOfficial).toBe(false);
    expect(stored.deck).not.toHaveProperty("contentSource");
    expect(stored.deck).not.toHaveProperty("officialLevel");
    expect(db.prepare("SELECT official_level FROM decks WHERE id=?").get(deck.id)?.official_level).toBe("");
    db.prepare("UPDATE decks SET official_level='advanced' WHERE id=?").run(deck.id);
    expect((await (await call(`/decks/${deck.id}`)).json() as any).deck).not.toHaveProperty("officialLevel");
    const reservedHandle = createHandler(async () => OFFICIAL_OWNER_ID);
    expect((await reservedHandle(new Request("https://api.test/api/decks", { headers: { Authorization: "Bearer reserved" } }), env)).status).toBe(403);
  });
  it("saves every word, example and textbook tag as an independently owned private copy", async () => {
    const original = await published(500);
    const response = await call(`/decks/${original.id}/save`, "POST", undefined, "bob");
    expect(response.status).toBe(201);
    const { deck: saved, alreadySaved } = await response.json() as any;
    expect(alreadySaved).toBe(false);
    expect(saved).toMatchObject({ title: original.title, description: original.description, visibility: "private", wordCount: 500, textbookTags: original.textbookTags });
    expect(saved.id).not.toBe(original.id);
    expect(saved).not.toHaveProperty("source_deck_id");
    expect((await anonymous(`/decks/${saved.id}`)).status).toBe(404);
    expect((await call(`/decks/${saved.id}`)).status).toBe(404);
    for (let cursor = 0; cursor < 500; cursor += 50) {
      const page = await (await call(`/decks/${saved.id}/words?cursor=${cursor}`, "GET", undefined, "bob")).json() as any;
      expect(page.words).toHaveLength(50);
      expect(page.words[0]).toMatchObject({ word: `word-${cursor}`, meaning: `意味 ${cursor}`, example: "A useful example.", tags: ["名詞"], ordinal: cursor });
      expect(page.nextCursor).toBe(cursor === 450 ? null : cursor + 50);
    }
    expect(db.prepare("SELECT count(DISTINCT id) AS count FROM words").get()?.count).toBe(1000);
    expect(db.prepare("SELECT word_count,deck_count,daily_words FROM users WHERE id='bob'").get()).toEqual({ word_count: 500, deck_count: 1, daily_words: 500 });
    const bytes = db.prepare("SELECT data_bytes FROM decks WHERE id=?").get(original.id)?.data_bytes as number;
    expect(db.prepare("SELECT byte_count FROM app_usage").get()?.byte_count).toBe(bytes * 2);
    await call(`/decks/${original.id}/visibility`, "PATCH", { visibility: "private" });
    expect((await call(`/decks/${saved.id}/words`, "GET", undefined, "bob")).status).toBe(200);
    await call(`/decks/${original.id}`, "DELETE");
    const remaining = await (await call(`/decks/${saved.id}`, "GET", undefined, "bob")).json() as any;
    expect(remaining.deck.textbookTags).toEqual(original.textbookTags);
    expect((await call(`/decks/${saved.id}/words?cursor=450`, "GET", undefined, "bob")).status).toBe(200);
  });
  it("makes repeated and concurrent saves idempotent without spending quota twice", async () => {
    const original = await published();
    const path = `/decks/${original.id}/save`;
    const responses = await Promise.all(Array.from({ length: 3 }, () => call(path, "POST", undefined, "bob")));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 201]);
    const bodies = await Promise.all(responses.map((r) => r.json())) as any[];
    expect(new Set(bodies.map((b) => b.deck.id)).size).toBe(1);
    expect(db.prepare("SELECT word_count,deck_count,daily_words FROM users WHERE id='bob'").get()).toEqual({ word_count: 2, deck_count: 1, daily_words: 2 });
    env.ALLOW_IMPORTS = "false";
    expect((await call(path, "POST", undefined, "bob")).status).toBe(200);
    expect((await (await call(path, "POST")).json() as any).deck.id).toBe(original.id);
    env.ALLOW_IMPORTS = "true";
    await call(`/decks/${bodies[0].deck.id}`, "DELETE", undefined, "bob");
    const resaved = await (await call(path, "POST", undefined, "bob")).json() as any;
    expect(resaved.deck.id).not.toBe(bodies[0].deck.id);
    expect(resaved.deck.wordCount).toBe(2);
  });
  it("requires login and public visibility, and honors the import pause", async () => {
    const { deck } = await (await call("/decks", "POST", sample())).json() as any;
    const path = `/decks/${deck.id}/save`;
    expect((await handle(new Request(`https://api.test/api${path}`, { method: "POST" }), env)).status).toBe(401);
    expect((await call(path, "POST", undefined, "bob")).status).toBe(404);
    expect((await call("/decks/missing/save", "POST", undefined, "bob")).status).toBe(404);
    env.ALLOW_IMPORTS = "false";
    await call(`/decks/${deck.id}/visibility`, "PATCH", { visibility: "public" });
    expect((await call(path, "POST", undefined, "bob")).status).toBe(503);
    expect(db.prepare("SELECT count(*) AS count FROM decks").get()?.count).toBe(1);
  });
  it.each([
    "UPDATE users SET deck_count=20 WHERE id='bob'",
    "UPDATE users SET word_count=14999 WHERE id='bob'",
    "UPDATE app_usage SET word_count=99999",
    "UPDATE app_usage SET byte_count=104857600",
  ])("rolls back a save that exceeds quota: %s", async (limit) => {
    const original = await published();
    db.exec("INSERT INTO users(id) VALUES ('bob')");
    db.exec(limit);
    const snapshot = () => JSON.stringify(["users", "app_usage", "decks", "words", "deck_textbook_tags"].map((table) => db.prepare(`SELECT * FROM ${table}`).all()));
    const before = snapshot();
    expect((await call(`/decks/${original.id}/save`, "POST", undefined, "bob")).status).toBe(429);
    expect(snapshot()).toBe(before);
  });
  it("only lets the owner publish and revoke public access without exposing account information", async () => {
    const { deck } = (await (
      await call("/decks", "POST", sample(60))
    ).json()) as any;
    const path = `/decks/${deck.id}`;
    expect((await anonymous(path)).status).toBe(404);
    expect((await anonymous(`${path}/words`)).status).toBe(404);
    expect(((await (await anonymous("/decks")).json()) as any).decks).toEqual(
      [],
    );
    expect(
      (
        await call(
          `${path}/visibility`,
          "PATCH",
          { visibility: "public" },
          "bob",
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handle(
          new Request(`https://api.test/api${path}/visibility`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: '{"visibility":"public"}',
          }),
          env,
        )
      ).status,
    ).toBe(401);
    const published = await call(`${path}/visibility`, "PATCH", {
      visibility: "public",
    });
    expect(published.status).toBe(200);
    expect(((await published.json()) as any).deck.visibility).toBe("public");
    const shared = await anonymous(path);
    expect(shared.headers.get("cache-control")).toBe("no-store");
    const sharedData = (await shared.json()) as any;
    expect(sharedData.deck.title).toBe(sample().title);
    expect(sharedData.deck).not.toHaveProperty("owner_id");
    expect(sharedData.deck).not.toHaveProperty("ownerId");
    expect(JSON.stringify(sharedData)).not.toContain("alice");
    const page = (await (await anonymous(`${path}/words`)).json()) as any;
    expect(page.words).toHaveLength(50);
    expect(page.nextCursor).toBe(50);
    const nextPage = (await (
      await anonymous(`${path}/words?cursor=50`)
    ).json()) as any;
    expect(nextPage.words).toHaveLength(10);
    const search = (await (
      await anonymous(`${path}/words?q=word-59`)
    ).json()) as any;
    expect(search.words).toHaveLength(1);
    expect((await call(path, "DELETE", undefined, "bob")).status).toBe(404);
    expect((await call(`${path}/words`, "GET", undefined, "bob")).status).toBe(
      404,
    );
    expect((await anonymous(path, "DELETE")).status).toBe(405);
    expect(
      (await call(`${path}/visibility`, "PATCH", { visibility: "private" }))
        .status,
    ).toBe(200);
    expect((await anonymous(path)).status).toBe(404);
    const revoked = await anonymous(`${path}/words?cursor=50`);
    expect(revoked.status).toBe(404);
    expect(revoked.headers.get("cache-control")).toBe("no-store");
    expect(((await (await anonymous("/decks")).json()) as any).decks).toEqual(
      [],
    );
    expect((await call(`${path}/words`)).status).toBe(200);
    await call(`${path}/visibility`, "PATCH", { visibility: "public" });
    await call(path, "DELETE");
    expect((await anonymous(path)).status).toBe(404);
  });
  it("searches public titles, descriptions and textbook tags with literal wildcards and stable pages", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      const who = i < 20 ? "alice" : "bob";
      const input = {
        ...sample(1),
        words: [{word:`unique-${i}`,meaning:`意味 ${i}`,tags:[]}],
        title: i === 0 ? "100% English_1" : `公開単語帳 ${i}`,
        description: i === 1 ? "日常の旅の言葉" : "",
        textbookTags: [
          {
            name: i === 2 ? "旅の教科書" : "共有教材",
            edition: "第3版",
            chapter: "Unit 9",
          },
        ],
      };
      const { deck } = (await (
        await call("/decks", "POST", input, who)
      ).json()) as any;
      ids.push(deck.id);
      await call(
        `/decks/${deck.id}/visibility`,
        "PATCH",
        { visibility: "public" },
        who,
      );
    }
    await call(
      "/decks",
      "POST",
      {
        ...sample(1),
        title: "非公開の秘密",
        textbookTags: [{ name: "秘密教材" }],
      },
      "bob",
    );
    // All timestamps equal: id must be the tiebreaker, including the continuation cursor.
    db.prepare("UPDATE decks SET created_at='2026-01-01T00:00:00.000Z'").run();
    const first = (await (await anonymous("/decks")).json()) as any;
    expect(first.decks).toHaveLength(20);
    const second = (await (
      await anonymous(`/decks?cursor=${encodeURIComponent(first.nextCursor)}`)
    ).json()) as any;
    expect(second.decks).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.decks, ...second.decks].map((d) => d.id)).size,
    ).toBe(25);
    for (const query of ["100%", "English_1", "日常の旅", "旅の教科書"]) {
      const page = (await (
        await anonymous(`/decks?q=${encodeURIComponent(query)}`)
      ).json()) as any;
      expect(page.decks).toHaveLength(1);
    }
    expect(
      (
        (await (
          await anonymous(`/decks?q=${encodeURIComponent("秘密")}`)
        ).json()) as any
      ).decks,
    ).toHaveLength(0);
    expect(
      (
        (await (
          await anonymous(`/decks?q=${encodeURIComponent("' OR 1=1 --")}`)
        ).json()) as any
      ).decks,
    ).toHaveLength(0);
    expect(
      ((await (await anonymous("/decks?q=%25")).json()) as any).decks,
    ).toHaveLength(1);
    expect((await anonymous("/decks?cursor=broken")).status).toBe(400);
    expect((await anonymous("/decks?q=" + "a".repeat(101))).status).toBe(400);
  });
  it("rejects invalid visibility payloads and preserves the prior setting", async () => {
    const { deck } = (await (
      await call("/decks", "POST", sample(1))
    ).json()) as any;
    for (const body of [
      { visibility: "unlisted" },
      { visibility: ["public"] },
      { visibility: true },
      {},
      ["public"],
      { visibility: "public", extra: "x".repeat(1100) },
    ]) {
      expect(
        (await call(`/decks/${deck.id}/visibility`, "PATCH", body)).status,
      ).toBe(400);
    }
    const response = await handle(
      new Request(`https://api.test/api/decks/${deck.id}/visibility`, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer alice",
          "Content-Type": "application/json",
        },
        body: "not json",
      }),
      env,
    );
    expect(response.status).toBe(400);
    expect((await anonymous(`/decks/${deck.id}`)).status).toBe(404);
    expect(
      db.prepare("SELECT visibility FROM decks WHERE id=?").get(deck.id)
        ?.visibility,
    ).toBe("private");
  });
  it("imports the largest batch within D1 limits and paginates without losing rows", async () => {
    const response = await call("/decks", "POST", {
      ...sample(500),
      textbookTags: Array.from({ length: 6 }, (_, i) => ({ name: `教材${i}` })),
    });
    expect(response.status).toBe(201);
    const { deck } = (await response.json()) as any;
    let cursor: number | null = 0;
    let ids: string[] = [];
    while (cursor !== null) {
      const page = (await (
        await call(`/decks/${deck.id}/words?cursor=${cursor}`)
      ).json()) as any;
      ids.push(...page.words.map((w: any) => w.id));
      cursor = page.nextCursor;
    }
    expect(ids).toHaveLength(500);
    expect(new Set(ids).size).toBe(500);
    expect((await call(`/decks/${deck.id}/words?cursor=-1`)).status).toBe(400);
    const matched = (await (
      await call(`/decks/${deck.id}/words?q=word-49`)
    ).json()) as any;
    expect(matched.words).toHaveLength(11);
    const wildcard = (await (
      await call(`/decks/${deck.id}/words?q=%25`)
    ).json()) as any;
    expect(wildcard.words).toHaveLength(0);
  });
  it("permits repeated imports and reimports after deletion beyond all former daily caps",async()=>{
    db.exec("INSERT INTO users(id,daily_words,import_day) VALUES ('alice',50000,date('now'))");
    db.exec("UPDATE app_usage SET daily_words=100000,import_day=date('now')");
    for(let i=0;i<4;i++) {
      const response=await call('/decks','POST',sample(5000));expect(response.status).toBe(201);
      const {deck}=await response.json() as any;
      expect((await call(`/decks/${deck.id}`,'DELETE')).status).toBe(200);
    }
    expect(db.prepare('SELECT count(*) n FROM words').get()?.n).toBe(0);
    expect(db.prepare('SELECT count(*) n FROM textbook_tags').get()?.n).toBe(0);
    expect(db.prepare("SELECT word_count,deck_count,daily_words FROM users WHERE id='alice'").get()).toEqual({word_count:0,deck_count:0,daily_words:70000});
    expect(db.prepare('SELECT word_count FROM app_usage').get()?.word_count).toBe(0);
  });
  it("allows another 500-word save after 502 words were registered and deleted, and allows all five 500-word books", async () => {
    db.exec(officialSeed);
    db.exec("INSERT INTO users(id,daily_words,import_day) VALUES ('alice',502,date('now'))");
    db.exec("UPDATE app_usage SET daily_words=daily_words+502");
    for(const item of officialManifest.decks.slice(0,4)) {
      expect((await call(`/decks/${item.id}/save`,"POST")).status).toBe(201);
    }
    expect(db.prepare("SELECT deck_count,word_count,daily_words FROM users WHERE id='alice'").get()).toEqual({deck_count:4,word_count:2000,daily_words:2502});
    expect((await call(`/decks/${officialManifest.decks[4].id}/save`,"POST")).status).toBe(201);
    expect(db.prepare("SELECT word_count FROM users WHERE id='alice'").get()?.word_count).toBe(2500);
  });
  it("explains each user quota separately", async () => {
    await call("/decks","POST",sample(1));
    db.exec("UPDATE users SET daily_words=5000 WHERE id='alice'");
    let response=await call("/decks","POST",sample(1));
    expect(response.status).toBe(201);
    db.exec("UPDATE users SET daily_words=1,word_count=15000 WHERE id='alice'");
    response=await call("/decks","POST",sample(1));
    expect(await response.json()).toMatchObject({code:"AZUKI_WORD_LIMIT",error:expect.stringContaining("合計15,000語")});
    db.exec("UPDATE users SET word_count=1,deck_count=20 WHERE id='alice'");
    response=await call("/decks","POST",sample(1));
    expect(await response.json()).toMatchObject({code:"AZUKI_DECK_LIMIT",error:expect.stringContaining("20冊")});
  });
  it("can stop imports while preserving existing reads", async () => {
    await call("/decks", "POST", sample());
    env.ALLOW_IMPORTS = "false";
    expect((await call("/decks", "POST", sample())).status).toBe(503);
    expect((await call("/decks")).status).toBe(200);
  });
  it("enforces the app storage budget without leaving partial records", async () => {
    db.prepare("UPDATE app_usage SET byte_count=104857600").run();
    expect((await call("/decks", "POST", sample())).status).toBe(429);
    expect(db.prepare("SELECT COUNT(*) AS n FROM decks").get()?.n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM users").get()?.n).toBe(0);
  });
});
describe("Firebase token verification", () => {
  it("validates signature, project, issuer, time and Google provider", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    const keys = createLocalJWKSet({
      keys: [{ ...publicJwk, kid: "test", alg: "RS256" }],
    });
    const sign = (overrides = {}) =>
      new SignJWT({
        sub: "alice",
        auth_time: Math.floor(Date.now() / 1000) - 10,
        firebase: { sign_in_provider: "google.com" },
        ...overrides,
      })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer("https://securetoken.google.com/azuki-test")
        .setAudience("azuki-test")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey);
    const token = await sign();
    expect(await verifyFirebaseToken(token, "azuki-test", keys)).toBe("alice");
    await expect(
      verifyFirebaseToken(token, "another-project", keys),
    ).rejects.toThrow();
    await expect(
      verifyFirebaseToken(
        await sign({ firebase: { sign_in_provider: "password" } }),
        "azuki-test",
        keys,
      ),
    ).rejects.toThrow();
    await expect(
      verifyFirebaseToken(
        await sign({ auth_time: Date.now() / 1000 + 5000 }),
        "azuki-test",
        keys,
      ),
    ).rejects.toThrow();
    const parts = token.split(".");
    parts[1] = Buffer.from(JSON.stringify({ sub: "bob" })).toString(
      "base64url",
    );
    await expect(
      verifyFirebaseToken(parts.join("."), "azuki-test", keys),
    ).rejects.toThrow();
    const expired = await new SignJWT({ sub: "alice", auth_time: 1 })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://securetoken.google.com/azuki-test")
      .setAudience("azuki-test")
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(privateKey);
    await expect(
      verifyFirebaseToken(expired, "azuki-test", keys),
    ).rejects.toThrow();
  });
});

// Runs locally with the existing Wrangler login. Never prints word content or account IDs.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contentHash } from "../shared/content.ts";
const location = process.argv.includes('--remote') ? '--remote' : '--local';
const run = args => { const output=execFileSync('npx', ['wrangler','d1','execute','azuki-db',location,'--config','wrangler.api.jsonc','--json',...args], {encoding:'utf8',maxBuffer:64*1024*1024}); const start=output.search(/\[\s*\{/); if(start<0)throw new Error('D1 returned no JSON result'); return JSON.parse(output.slice(start)); };
const query = sql => run(['--command',sql]).flatMap(r=>r.results || []);
const quote = s => s === null ? 'NULL' : "'"+String(s).replaceAll("'","''")+"'";
const decks = query('SELECT id,owner_id,title,visibility,source_deck_id,source_title,source_hash,content_hash,root_deck_id,created_at,updated_at FROM decks');
const words = query('SELECT deck_id,word,meaning,example FROM words');
const byId = new Map(decks.map(d=>[d.id,d]));
const buckets = new Map();
for(const w of words){if(!buckets.has(w.deck_id))buckets.set(w.deck_id,[]);buckets.get(w.deck_id).push(w);}
for(const d of decks)d.hash = d.content_hash || await contentHash(buckets.get(d.id) || []);
function root(d,seen=new Set()) {
 if(d.root_deck_id)return d.root_deck_id;
 if(!d.source_deck_id || seen.has(d.id))return d.id;
 seen.add(d.id); const source=byId.get(d.source_deck_id);
 return source ? root(source,seen) : d.source_deck_id;
}
const parents=new Map();
function find(id){const p=parents.get(id);if(!p)return id;const r=find(p);parents.set(id,r);return r;}
const ranked=[...decks].filter(d=>d.visibility==='public').sort((a,b)=>Number(b.owner_id==='azuki:official')-Number(a.owner_id==='azuki:official') || Number(Boolean(a.source_deck_id))-Number(Boolean(b.source_deck_id)) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
const hashes=new Map();
for(const d of ranked){const r=find(root(d)); if(hashes.has(d.hash)){const canonical=find(hashes.get(d.hash));if(r!==canonical)parents.set(r,canonical);}else hashes.set(d.hash,r);}
const sql=[];
for(const d of decks){
 const family=find(root(d)); const source=byId.get(d.source_deck_id);
 const title=d.source_title || source?.title || (d.source_deck_id ? 'コピー元の単語帳' : '');
 const baseline=d.source_hash || (d.source_deck_id ? d.hash : '');
 const rootId=family===d.id ? null : family;
 if(d.hash!==d.content_hash || title!==d.source_title || baseline!==d.source_hash || rootId!==d.root_deck_id)
  sql.push(`UPDATE decks SET content_hash=${quote(d.hash)},source_title=${quote(title)},source_hash=${quote(baseline)},root_deck_id=${quote(rootId)} WHERE id=${quote(d.id)} AND updated_at=${quote(d.updated_at)};`);
}
if(sql.length){const dir=mkdtempSync(join(tmpdir(),'azuki-lineage-'));try{const file=join(dir,'backfill.sql');writeFileSync(file,sql.join('\n'));run(['--file',file]);}finally{rmSync(dir,{recursive:true,force:true});}}
console.log(JSON.stringify({decks:decks.length,updated:sql.length,missingHashes:query("SELECT count(*) AS n FROM decks WHERE content_hash=''")[0].n}));

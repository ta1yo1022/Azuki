import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseDeck} from '../shared/model.ts';
import {contentHash} from '../shared/content.ts';
const manifest = JSON.parse(await readFile('content/official/manifest.json','utf8'));
const catalog=[];
await mkdir('public/content/official',{recursive:true});
for (const entry of manifest.decks) {
  if (!/^azuki-official-[a-z-]+-v1$/.test(entry.id) || !/^decks\/[a-z0-9-]+\.json$/.test(entry.file)) throw new Error('Invalid official source path or ID');
  if (!['beginner','intermediate','advanced'].includes(entry.level)) throw new Error('Invalid level');
  const input=parseDeck(await readFile(`content/official/${entry.file}`,'utf8'));
  if (input.words.some(w=>!w.example?.trim())) throw new Error(`${entry.id}: example required`);
  const words=input.words.map((w,ordinal)=>({...w,id:`${entry.id}-${ordinal}`,ordinal}));
  const text=JSON.stringify(words)+'\n';
  const file=`${entry.id}.${createHash('sha256').update(text).digest('hex').slice(0,16)}.json`;
  await writeFile(`public/content/official/${file}`,text);
  const {words:_,...metadata}=input;
  catalog.push({...metadata,id:entry.id,visibility:'public',wordCount:words.length,createdAt:'2026-10-05T00:00:00.000Z',updatedAt:manifest.updatedAt,isOfficial:true,officialLevel:entry.level,contentSource:'ejdict',standard:true,file,contentHash:await contentHash(words)});
}
if(new Set(catalog.map(d=>d.id)).size!==catalog.length)throw new Error('Duplicate official ID');
await writeFile('shared/official-catalog.json',JSON.stringify(catalog,null,2)+'\n');
console.log(`Official: ${catalog.length} books, ${catalog.reduce((n,d)=>n+d.wordCount,0)} words`);

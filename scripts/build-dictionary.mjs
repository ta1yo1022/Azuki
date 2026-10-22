import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../content/dictionary');
const shards=new Map();let entries=0;
for(const file of fs.readdirSync(path.join(root,'source')).filter(name=>name.endsWith('.txt')).sort()){
 for(const line of fs.readFileSync(path.join(root,'source',file),'utf8').split('\n')){
  const [head,...rest]=line.split('\t');if(!head||!rest.length)continue;
  const meanings=[...new Set(rest.join('\t').split(' / ').map(value=>value.replace(/[『』]/g,'').trim()).filter(value=>value.length>0&&value.length<=600))].slice(0,30);
  if(!meanings.length)continue;
  for(const alias of head.split(/,\s*/)){
   const term=alias.normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
   if(!/^[a-z][a-z .'-]{0,99}$/.test(term))continue;
   const shard=term[0];if(!shards.has(shard))shards.set(shard,Object.create(null));
   const map=shards.get(shard);map[term]=[...new Set([...(map[term]??[]),...meanings])].slice(0,30);
  }
 }
}
fs.mkdirSync(path.join(root,'assets'),{recursive:true});
const hashes={};
for(const [key,values] of [...shards].sort(([a],[b])=>a.localeCompare(b))){
 const text=JSON.stringify(Object.fromEntries(Object.entries(values).sort(([a],[b])=>a.localeCompare(b))));
 fs.writeFileSync(path.join(root,'assets',key+'.json'),text+'\n');
 hashes[key]=crypto.createHash('sha256').update(text+'\n').digest('hex');entries+=Object.keys(values).length;
}
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({source:'https://github.com/kujirahand/EJDict',commit:'9663055d59a8cb1a35078a71db7a09ff39305828',license:'CC0-1.0',entries,hashes},null,2)+'\n');
console.log(`Dictionary: ${entries} headwords, ${shards.size} shards`);

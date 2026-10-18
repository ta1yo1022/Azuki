import { contentHash } from '../shared/content.ts';
import { cefrEntryKey, validateCefrEditorial } from '../shared/cefrjEditorial.ts';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const entries = JSON.parse(await readFile('content/cefrj/source-entries.json', 'utf8'));
const edited = (await Promise.all(['a-levels.json', 'b1.json', 'b2.json', 'b2-tail.json'].map(file => readFile(`content/cefrj/editorial/${file}`, 'utf8').then(JSON.parse)))).flat();
const editorial = validateCefrEditorial(entries, edited);
const pos = {noun:'名詞',verb:'動詞',adjective:'形容詞',adverb:'副詞',pronoun:'代名詞',preposition:'前置詞',determiner:'限定詞',conjunction:'接続詞',number:'数詞','modal auxiliary':'助動詞','be-verb':'be動詞',interjection:'間投詞','do-verb':'do動詞','have-verb':'have動詞','infinitive-to':'不定詞のto'};
const counts = { A1:1166, A2:1411, B1:2445, B2:2779 };
const catalog = [];
await mkdir('public/content/cefrj', {recursive:true});
for (const [level,count] of Object.entries(counts)) {
  const rows = entries.filter(e => e.level === level);
  if (rows.length !== count) throw new Error(`Unexpected ${level} count`);
  const middle = Math.ceil(rows.length / 2);
  for (const [part, subset] of [rows.slice(0,middle),rows.slice(middle)].entries()) {
    const id = `azuki-cefrj-${level.toLowerCase()}-${part+1}-v1`;
    const words = subset.map((entry,ordinal) => {
      const {meaning,example,otherMeanings,usagePos,usageNote} = editorial.get(cefrEntryKey(entry));
      const displayPos = usagePos ?? entry.pos;
      if (!pos[displayPos]) throw new Error(`Unknown part of speech: ${entry.pos}`);
      return {id:`${id}-${ordinal}`,ordinal,word:entry.word,meaning,example,otherMeanings,...(usageNote ? {usageNote} : {}),tags:[pos[displayPos],level]};
    });
    const text = JSON.stringify(words)+'\n';
    const hash = createHash('sha256').update(text).digest('hex').slice(0,16);
    const file = `${id}.${hash}.json`;
    await writeFile(`public/content/cefrj/${file}`,text);
    catalog.push({id,schemaVersion:1,title:`CEFR-J ${level} ${part === 0 ? '前編' : '後編'}`,description:`CEFR-J Wordlistの${level}を原典の掲載順で二分した${part === 0 ? '前編' : '後編'}です。代表的な意味・例文付き。`,textbookTags:[{name:'CEFR-J',edition:'Wordlist 1.6'}],visibility:'public',wordCount:words.length,createdAt:'2026-10-18T00:00:00.000Z',updatedAt:'2026-10-18T00:00:00.000Z',isOfficial:true,contentSource:'cefrj',cefrLevel:level,standard:true,contentHash:await contentHash(words),file});
  }
}
await writeFile('shared/cefrj-catalog.json',JSON.stringify(catalog,null,2)+'\n');
console.log(`CEFR-J: ${catalog.length} books, ${catalog.reduce((sum,d)=>sum+d.wordCount,0)} entries`);

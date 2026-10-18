import { standardDeck, standardAssetPath } from '../../shared/standardDecks';
import type { Word, WordPage } from '../../shared/model';
const cache = new Map<string, Word[]>();
export async function standardWords(id:string, query:string, cursor:number, signal?:AbortSignal): Promise<WordPage> {
  const deck = standardDeck(id);
  if (!deck) throw new Error('単語帳が見つかりません。');
  signal?.throwIfAborted();
  let words = cache.get(id);
  if (!words) {
    const response = await fetch(standardAssetPath(deck), {signal});
    if (!response.ok) throw new Error('標準単語帳を読み込めませんでした。もう一度お試しください。');
    const data: unknown = await response.json();
    if (!Array.isArray(data) || data.length !== deck.wordCount || data.some((w,i) => w.ordinal !== i || typeof w.word !== 'string' || typeof w.meaning !== 'string' || (w.usageNote !== undefined && typeof w.usageNote !== 'string') || !Array.isArray(w.tags) || (w.otherMeanings !== undefined && (!Array.isArray(w.otherMeanings) || w.otherMeanings.some((meaning:unknown) => typeof meaning !== 'string'))))) throw new Error('単語帳のデータを確認できませんでした。');
    words = data as Word[];
    cache.set(id,words);
  }
  signal?.throwIfAborted();
  const q = query.trim().toLocaleLowerCase();
  const matches = words.filter(w => w.ordinal >= cursor && `${w.word} ${w.meaning} ${(w.otherMeanings ?? []).join(' ')} ${w.tags.join(' ')}`.toLocaleLowerCase().includes(q));
  return {words:matches.slice(0,50),nextCursor:matches.length > 50 ? matches[50].ordinal : null};
}

import catalog from './cefrj-catalog.json';
import official from './official-catalog.json';
import type { Deck } from './model';
export const standardDecks = [...catalog, ...official] as (Deck & {file:string;contentHash:string})[];
export function standardDeck(id:string) { return standardDecks.find(deck => deck.id === id); }
export function findStandardDecks(query:string) {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return standardDecks.filter(d => tokens.every(token => `${d.title} ${d.description} ${d.textbookTags.map(t=>t.name).join(' ')}`.toLocaleLowerCase().includes(token)));
}

export function standardAssetPath(deck: (typeof standardDecks)[number]) { return `/content/${deck.contentSource === "cefrj" ? "cefrj" : "official"}/${deck.file}`; }

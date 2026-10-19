export type CefrSourceEntry = {word:string;pos:string;level:string};
export type CefrEditedEntry = CefrSourceEntry & {meaning:string;example:string;exampleTranslation:string;otherMeanings:string[];usagePos?:string;usageNote?:string};
export function cefrEntryKey(entry:CefrSourceEntry) {
  return JSON.stringify([entry.word,entry.pos,entry.level]);
}

/** Reject incomplete editorial batches before generating any public assets. */
export function validateCefrEditorial(source:CefrSourceEntry[], edited:unknown[]): Map<string,CefrEditedEntry> {
  const expected = new Set(source.map(cefrEntryKey));
  if (expected.size !== source.length) throw new Error('Source contains duplicate word/POS/level entries');
  const result = new Map<string,CefrEditedEntry>();
  for (const candidate of edited) {
    if (!candidate || typeof candidate !== 'object') throw new Error('Invalid editorial entry');
    const entry = candidate as CefrEditedEntry;
    const key = cefrEntryKey(entry);
    if (!expected.has(key)) throw new Error(`Unknown editorial entry: ${key}`);
    if (result.has(key)) throw new Error(`Duplicate editorial entry: ${key}`);
    if (typeof entry.meaning !== 'string' || !entry.meaning.trim() || entry.meaning.length > 160 || !/[ぁ-んァ-ン一-龥]/.test(entry.meaning)) throw new Error(`Invalid primary meaning: ${key}`);
    if (typeof entry.example !== 'string' || !entry.example.trim() || entry.example.length > 300 || !/[a-zA-Z]/.test(entry.example) || /[ぁ-んァ-ン一-龥]/.test(entry.example)) throw new Error(`Invalid example: ${key}`);
    if (typeof entry.exampleTranslation !== 'string' || !entry.exampleTranslation.trim() || entry.exampleTranslation.length > 1000 || !/[ぁ-んァ-ン一-龥]/.test(entry.exampleTranslation)) throw new Error(`Invalid example translation: ${key}`);
    if (!Array.isArray(entry.otherMeanings) || entry.otherMeanings.length > 5 || entry.otherMeanings.some(m=>typeof m !== 'string' || !m.trim() || m.length > 160 || m.trim() === entry.meaning.trim())) throw new Error(`Invalid other meanings: ${key}`);
    if (new Set(entry.otherMeanings.map(m=>m.trim())).size !== entry.otherMeanings.length) throw new Error(`Duplicate other meanings: ${key}`);
    if (entry.usageNote !== undefined && (typeof entry.usageNote !== 'string' || !entry.usageNote.trim() || entry.usageNote.length > 300)) throw new Error(`Invalid usage note: ${key}`);
    if (entry.usagePos !== undefined && (typeof entry.usagePos !== 'string' || !entry.usagePos.trim() || typeof entry.usageNote !== 'string' || !entry.usageNote.trim() || entry.usageNote.length > 300)) throw new Error(`Missing usage note: ${key}`);
    result.set(key,{...entry,meaning:entry.meaning.trim(),example:entry.example.trim(),exampleTranslation:entry.exampleTranslation.trim(),otherMeanings:entry.otherMeanings.map(m=>m.trim())});
  }
  const missing = source.filter(entry => !result.has(cefrEntryKey(entry)));
  if (missing.length) throw new Error(`Missing ${missing.length} editorial entries; first: ${cefrEntryKey(missing[0])}`);
  return result;
}

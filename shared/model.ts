export const LIMITS = {
  bytes: 512 * 1024,
  importWords: 5000,
  forkWords: 5000,
  userWords: 15000,
  examplesPerWord: 10,
  decks: 20,
};
export type TextbookTag = { name: string; edition?: string; chapter?: string };
export type OfficialLevel = "beginner" | "intermediate" | "advanced";
export type WordExample = { text: string; translation?: string };
export type WordInput = {
  word: string;
  meaning: string;
  example?: string;
  examples?: WordExample[];
  tags: string[];
};
/** The legacy example remains the first sentence for existing clients and static books. */
export function wordExamples(word: Pick<WordInput, 'example' | 'examples'>): WordExample[] {
  return word.examples?.length ? word.examples : word.example ? [{text:word.example}] : [];
}
export function parseWordExamples(value: unknown, label = '例文'): WordExample[] {
  if (!Array.isArray(value) || value.length > LIMITS.examplesPerWord)
    throw new ValidationError(`${label}は${LIMITS.examplesPerWord}件以内にしてください。`);
  const seen = new Set<string>();
  return value.map((item, i) => {
    if (!object(item)) throw new ValidationError(`${label}${i+1}の形式を確認してください。`);
    const text = string(item.text, `${label}${i+1}の英文`, 1000);
    const translation = string(item.translation, `${label}${i+1}の日本語訳`, 1000, true);
    const key = text.normalize('NFKC').replace(/\s+/gu,' ');
    if (seen.has(key)) throw new ValidationError(`${label}に同じ英文が含まれています。`);
    seen.add(key);
    return {text,...(translation ? {translation} : {})};
  });
}
export type DeckInput = {
  schemaVersion: 1;
  title: string;
  description: string;
  textbookTags: TextbookTag[];
  words: WordInput[];
};
export type Deck = Omit<DeckInput, "words"> & {
  id: string;
  visibility: "private" | "public";
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  sourceDeck?: { id: string; title: string; available: boolean };
  unchangedCopy?: boolean;
  variantCount?: number;
  isOfficial?: boolean;
  officialLevel?: OfficialLevel;
  contentSource?: "ejdict" | "cefrj";
  cefrLevel?: "A1" | "A2" | "B1" | "B2";
  standard?: boolean;
};
export type Word = WordInput & {
  id: string;
  ordinal: number;
  /** Additional senses of the same part of speech; meaning is the study prompt. */
  otherMeanings?: string[];
  usageNote?: string;
};
export type WordPage = { words: Word[]; nextCursor: number | null };
export type DeckPage = { decks: Deck[]; nextCursor: string | null };
export class ValidationError extends Error {}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
function string(
  v: unknown,
  label: string,
  max: number,
  optional = false,
): string {
  if (optional && v === undefined) return "";
  if (typeof v !== "string" || (!optional && !v.trim()))
    throw new ValidationError(`${label}を入力してください。`);
  const result = (v as string).trim();
  if (result.length > max)
    throw new ValidationError(`${label}は${max}文字以内にしてください。`);
  return result;
}
export function parseDeck(raw: string, options: { maxWords?: number; allowExampleVariants?: boolean } = {}): DeckInput {
  const maxWords = options.maxWords ?? LIMITS.importWords;
  if (new TextEncoder().encode(raw).length > LIMITS.bytes)
    throw new ValidationError("JSONは512KB以内にしてください。");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ValidationError(
      "JSONの形式を確認してください。ダブルクォートやカンマの抜けがないか確認すると解決できます。",
    );
  }
  if (!object(data))
    throw new ValidationError("titleとwordsを含むJSONを入力してください。");
  if (data.schemaVersion !== undefined && data.schemaVersion !== 1)
    throw new ValidationError("このJSONのバージョンには対応していません。");
  const title = string(data.title, "単語帳の名前", 80);
  const description = string(data.description, "説明", 240, true);
  if (!Array.isArray(data.words) || data.words.length === 0)
    throw new ValidationError("wordsに1語以上の単語を追加してください。");
  if (data.words.length > maxWords)
    throw new ValidationError(
      `一度に登録できるのは${maxWords}語までです。単語帳を分けてください。`,
    );
  const seen = new Set<string>();
  const words = data.words.map((item, i): WordInput => {
    if (!object(item))
      throw new ValidationError(`${i + 1}語目の形式を確認してください。`);
    const word = string(item.word, `${i + 1}語目の英単語`, 120);
    const meaning = string(item.meaning, `${i + 1}語目の意味`, 1000);
    const examples = item.examples === undefined ? undefined : parseWordExamples(item.examples, `${i+1}語目の例文`);
    const example = examples === undefined ? string(item.example, `${i + 1}語目の例文`, 1000, true) : examples[0]?.text ?? '';
    const tags = item.tags ?? [];
    if (!Array.isArray(tags) || tags.length > 5)
      throw new ValidationError(
        `${i + 1}語目のtagsは5個以内の配列にしてください。`,
      );
    const normalizedTags = [
      ...new Set(tags.map((tag) => string(tag, "単語タグ", 32))),
    ];
    const key = JSON.stringify([
      word.normalize("NFKC").toLowerCase(),
      meaning.normalize("NFKC"),
      ...(options.allowExampleVariants ? [example.normalize("NFKC"), JSON.stringify(examples ?? []), normalizedTags.join("\u0000")] : []),
    ]);
    if (seen.has(key))
      throw new ValidationError(
        `${i + 1}語目の「${word}」は同じ意味ですでに含まれています。重複を取り除いてください。`,
      );
    seen.add(key);
    return {
      word,
      meaning,
      ...(example ? { example } : {}),
      ...(examples?.length ? { examples } : {}),
      tags: normalizedTags,
    };
  });
  const inputTags = data.textbookTags ?? [];
  if (!Array.isArray(inputTags) || inputTags.length > 6)
    throw new ValidationError("教材タグは6個以内の配列にしてください。");
  const textbookTags = inputTags
    .map((tag): TextbookTag => {
      if (!object(tag))
        throw new ValidationError("教材タグにはnameを指定してください。");
      const name = string(tag.name, "教材名", 80);
      const edition = string(tag.edition, "教材の版", 40, true);
      const chapter = string(tag.chapter, "教材の章", 40, true);
      return {
        name,
        ...(edition ? { edition } : {}),
        ...(chapter ? { chapter } : {}),
      };
    })
    .filter(
      (tag, i, all) =>
        all.findIndex(
          (other) => JSON.stringify(other) === JSON.stringify(tag),
        ) === i,
    );
  // Ownership, visibility, official status, level, and source metadata are never imported.
  return { schemaVersion: 1, title, description, textbookTags, words };
}
export const EXAMPLE_JSON = JSON.stringify(
  {
    schemaVersion: 1,
    title: "新しい単語帳",
    description: "今日出会った言葉を集めよう。",
    textbookTags: [{ name: "英語の教科書", chapter: "Lesson 1" }],
    words: [
      {
        word: "accomplish",
        meaning: "達成する",
        example: "We accomplished our goal.",
        tags: ["動詞"],
      },
      {
        word: "curious",
        meaning: "好奇心の強い",
        example: "Stay curious about the world.",
        tags: ["形容詞"],
      },
    ],
  },
  null,
  2,
);

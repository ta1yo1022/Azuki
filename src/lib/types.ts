export type Word = {
  id: string;
  en: string;
  ja: string;
};

export type BookFile = {
  name: string;
  description?: string;
  words: Word[];
};

export type Book = BookFile & {
  id: string;
};

export type CardMode = "en-ja" | "ja-en";

export type ListDisplayMode = "both" | "hide-ja" | "hide-en";

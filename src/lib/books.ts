import fs from "node:fs";
import path from "node:path";
import type { Book, BookFile, Word } from "@/lib/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const BOOK_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function fail(fileName: string, message: string): never {
  throw new Error(`[book validation] ${fileName}: ${message}`);
}

function validateWord(
  value: unknown,
  index: number,
  fileName: string,
): Word {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(fileName, `words[${index}] must be an object`);
  }

  const word = value as Record<string, unknown>;
  for (const field of ["id", "en", "ja"] as const) {
    if (typeof word[field] !== "string" || word[field].trim() === "") {
      fail(fileName, `words[${index}].${field} must be a non-empty string`);
    }
  }

  return {
    id: (word.id as string).trim(),
    en: (word.en as string).trim(),
    ja: (word.ja as string).trim(),
  };
}

function validateBook(value: unknown, fileName: string): BookFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(fileName, "root value must be an object");
  }

  const book = value as Record<string, unknown>;
  if (typeof book.name !== "string" || book.name.trim() === "") {
    fail(fileName, "name must be a non-empty string");
  }
  if (
    book.description !== undefined &&
    typeof book.description !== "string"
  ) {
    fail(fileName, "description must be a string when provided");
  }
  if (!Array.isArray(book.words)) {
    fail(fileName, "words must be an array");
  }

  const words = book.words.map((word, index) =>
    validateWord(word, index, fileName),
  );
  const ids = new Set<string>();
  for (const word of words) {
    if (ids.has(word.id)) {
      fail(fileName, `duplicate word id "${word.id}"`);
    }
    ids.add(word.id);
  }

  return {
    name: book.name.trim(),
    description:
      typeof book.description === "string"
        ? book.description.trim()
        : undefined,
    words,
  };
}

function readBookFile(fileName: string): Book {
  const id = path.basename(fileName, ".json");
  if (!BOOK_ID_PATTERN.test(id)) {
    fail(
      fileName,
      "file name must use lowercase letters, numbers, hyphens, or underscores",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      fs.readFileSync(path.join(DATA_DIRECTORY, fileName), "utf8"),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON";
    fail(fileName, `could not parse JSON (${message})`);
  }

  return { id, ...validateBook(parsed, fileName) };
}

export function getAllBooks(): Book[] {
  if (!fs.existsSync(DATA_DIRECTORY)) {
    throw new Error(`[book validation] data directory not found`);
  }

  const fileNames = fs
    .readdirSync(DATA_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  if (fileNames.length === 0) {
    throw new Error(`[book validation] no data/*.json files found`);
  }

  return fileNames.map(readBookFile);
}

export function getBook(bookId: string): Book | undefined {
  return getAllBooks().find((book) => book.id === bookId);
}

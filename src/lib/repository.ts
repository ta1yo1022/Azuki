import { auth } from "./firebase";
import { samples } from "./samples";
import {
  LIMITS,
  type Deck,
  type DeckInput,
  type DeckPage,
  type Word,
  type WordPage,
} from "../../shared/model";
export class PublishConflict extends Error {
  constructor(message: string, public existingDeckId?: string) { super(message); }
}
export interface Repository {
  editWord?(id: string, old: Word, value: {word:string;meaning:string;example:string}): Promise<{deck:Deck;word:Word}>;
  list(): Promise<Deck[]>;
  create(input: DeckInput): Promise<Deck>;
  words(id: string, q: string, cursor: number): Promise<WordPage>;
  remove(id: string): Promise<void>;
  visibility(id: string, visibility: Deck["visibility"]): Promise<Deck>;
}
type LocalStore = {
  version: 1;
  decks: Deck[];
  words: Record<string, Word[]>;
  importDay: string;
  dailyWords: number;
};
const KEY = "azuki.demo.v1";
function save(store: LocalStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    throw new Error(
      "この端末の保存容量が不足しているか、保存が許可されていません。不要な単語帳を削除するか、ブラウザの設定を確認してください。",
    );
  }
}
function local(): LocalStore {
  const value = localStorage.getItem(KEY);
  if (value) {
    try {
      const data = JSON.parse(value) as LocalStore;
      if (data.version !== 1 || !Array.isArray(data.decks) || !data.words)
        throw new Error();
      return data;
    } catch {
      throw new Error(
        "お試しデータを読み込めませんでした。このブラウザのAzukiの保存データを確認してください。",
      );
    }
  }
  const store: LocalStore = {
    version: 1,
    decks: [],
    words: {},
    importDay: "",
    dailyWords: 0,
  };
  samples.forEach((sample, index) => {
    const id = `sample-${index}`;
    const date = new Date(Date.now() - index * 86400000).toISOString();
    const { words, ...data } = sample;
    store.decks.push({
      ...data,
      id,
      wordCount: words.length,
      visibility: "private",
      createdAt: date,
      updatedAt: date,
    });
    store.words[id] = words.map((w, ordinal) => ({
      ...w,
      id: `${id}-${ordinal}`,
      ordinal,
    }));
  });
  save(store);
  return store;
}
export const demoRepository: Repository = {
  async visibility() {
    throw new Error("共有するにはGoogleログイン後に単語帳を登録してください。");
  },
  async list() {
    return local().decks;
  },
  async create(input) {
    const store = local();
    const total = store.decks.reduce((n, d) => n + d.wordCount, 0);
    const day = new Date().toISOString().slice(0, 10);
    if (
      store.decks.length >= LIMITS.decks ||
      total + input.words.length > LIMITS.userWords
    )
      throw new Error("1人20冊・合計5,000語まで登録できます。");
    const today = store.importDay === day ? store.dailyWords : 0;
    if (today + input.words.length > LIMITS.dailyWords)
      throw new Error("1日の登録上限（5,000語）に達しました。削除した分も当日分に含まれます。日本時間9時にリセットされます。");
    const id = crypto.randomUUID();
    const date = new Date().toISOString();
    const { words, ...data } = input;
    const deck: Deck = {
      ...data,
      id,
      wordCount: words.length,
      visibility: "private",
      createdAt: date,
      updatedAt: date,
    };
    store.decks.unshift(deck);
    store.words[id] = words.map((w, ordinal) => ({
      ...w,
      id: crypto.randomUUID(),
      ordinal,
    }));
    store.importDay = day;
    store.dailyWords = today + words.length;
    save(store);
    return deck;
  },
  async words(id, q, cursor) {
    const store = local();
    if (!store.decks.some((d) => d.id === id))
      throw new Error("単語帳が見つかりません。");
    const normalized = q.toLocaleLowerCase();
    const words = (store.words[id] ?? []).filter(
      (w) =>
        w.ordinal >= cursor &&
        `${w.word} ${w.meaning}`.toLocaleLowerCase().includes(normalized),
    );
    return {
      words: words.slice(0, 50),
      nextCursor: words.length > 50 ? words[50].ordinal : null,
    };
  },
  async remove(id) {
    const store = local();
    store.decks = store.decks.filter((d) => d.id !== id);
    delete store.words[id];
    save(store);
  },
};
const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
async function request<T>(
  path: string,
  options: RequestInit = {},
  anonymous = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (!anonymous) {
    const user = auth?.currentUser;
    if (!user) throw new Error("Googleアカウントでログインしてください。");
    headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  }
  let response: Response;
  try {
    response = await fetch(`${base}/api${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "接続できませんでした。インターネット接続を確認して、もう一度お試しください。",
    );
  }
  let result: T & { error?: string; existingDeckId?: string };
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "保存先に接続できませんでした。時間をおいてお試しください。",
    );
  }
  if (!response.ok) throw new PublishConflict(result.error ?? "処理に失敗しました。", result.existingDeckId);
  return result;
}
export const cloudRepository: Repository = {
  editWord: (id, old, value) => request(`/decks/${encodeURIComponent(id)}/words/${encodeURIComponent(old.id)}`, { method: "PATCH", body: JSON.stringify({...value, expectedWord: old.word, expectedMeaning: old.meaning, expectedExample: old.example ?? ""}) }),
  visibility: async (id, visibility) =>
    (
      await request<{ deck: Deck }>(
        `/decks/${encodeURIComponent(id)}/visibility`,
        { method: "PATCH", body: JSON.stringify({ visibility }) },
      )
    ).deck,
  list: async () => (await request<{ decks: Deck[] }>("/decks")).decks,
  create: async (input) =>
    (
      await request<{ deck: Deck }>("/decks", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).deck,
  words: (id, q, cursor) =>
    request<WordPage>(
      `/decks/${encodeURIComponent(id)}/words?q=${encodeURIComponent(q)}&cursor=${cursor}`,
    ),
  remove: async (id) => {
    await request(`/decks/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};

export const publicRepository = {
  variants: (id:string, cursor:string|null = null, signal?:AbortSignal) => request<DeckPage>(`/public/decks/${encodeURIComponent(id)}/variants${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {signal}, true),
  save: async (id: string) => (await request<{ deck: Deck; alreadySaved: boolean }>(
    `/decks/${encodeURIComponent(id)}/save`, { method: "POST" },
  )).deck,
  list: (q: string, cursor: string | null = null, signal?: AbortSignal) =>
    request<DeckPage>(
      `/public/decks?q=${encodeURIComponent(q)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal },
      true,
    ),
  get: async (id: string, signal?: AbortSignal) =>
    (
      await request<{ deck: Deck }>(
        `/public/decks/${encodeURIComponent(id)}`,
        { signal },
        true,
      )
    ).deck,
  words: (id: string, q: string, cursor: number, signal?: AbortSignal) =>
    request<WordPage>(
      `/public/decks/${encodeURIComponent(id)}/words?q=${encodeURIComponent(q)}&cursor=${cursor}`,
      { signal },
      true,
    ),
};
export const sharedDeckUrl = (id: string) =>
  new URL(`/shared/${encodeURIComponent(id)}`, location.origin).href;

export const reportRepository = {
  send: (id: string, reason: string, details: string) => request<{ok:boolean;duplicate?:boolean}>(`/decks/${encodeURIComponent(id)}/report`, {method:"POST",body:JSON.stringify({reason,details})}),
  access: () => request<{isAdmin:boolean}>("/admin/access"),
  list: (status: string, cursor: string | null = null) => request<{reports:import("../../shared/reports").DeckReport[];nextCursor:string|null}>(`/admin/reports?status=${encodeURIComponent(status)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
  update: (id: string, status: string, adminNote: string) => request<{ok:boolean}>(`/admin/reports/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({status,adminNote})}),
};

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { AzukiRoutes } from "../src/routes";

const mocks = vi.hoisted(() => {
  const deck = { schemaVersion: 1, id: "demo-deck", title: "日常のことば", description: "カードで覚える", visibility: "public", wordCount: 1, textbookTags: [{name:"教科書"}], createdAt: "2026-10-05T00:00:00Z", updatedAt:"2026-10-05T00:00:00Z", isOfficial: false, officialLevel: undefined as "beginner" | "intermediate" | "advanced" | undefined };
  const owned = { ...deck, id: "saved-deck", visibility: "private" };
  return {
    deck, owned,
    user: null as any,
    listeners: new Set<(user: any) => void>(),
    login: vi.fn(), save: vi.fn(), list: vi.fn(),
    page: { words: [{ id: "word-1", ordinal: 0, word: "curious", meaning: "好奇心の強い", example: "Stay curious.", tags: [] }], nextCursor: null },
  };
});
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: any) => void) => {
    mocks.listeners.add(callback);
    callback(mocks.user);
    return () => mocks.listeners.delete(callback);
  },
  signOut: async () => { mocks.user = null; mocks.listeners.forEach((cb) => cb(null)); },
}));
vi.mock("../src/lib/firebase", () => ({
  auth: { get currentUser() { return mocks.user; } },
  googleSignIn: mocks.login,
}));
vi.mock("../src/lib/repository", () => ({
  favoritesRepository: { list: async () => [], add: async () => {}, remove: async () => {} },
  emailRepository: { preferences: async () => ({enabled:false,email:"bob@example.com",available:true}) },
  reportRepository: { access: async () => ({isAdmin:false}) },
  demoRepository: { list: async () => [mocks.deck], words: async () => mocks.page },
  cloudRepository: { list: async () => [mocks.owned], words: async () => mocks.page },
  publicRepository: { get: async () => mocks.deck, words: async () => mocks.page, list: mocks.list, save: mocks.save },
  sharedDeckUrl: (id: string) => `https://azuki.test/shared/${id}`,
}));

let root: Root;
let container: HTMLDivElement;
let navigate: NavigateFunction;
let currentURL = "";
function Probe() {
  navigate = useNavigate();
  const { pathname, search } = useLocation();
  currentURL = pathname + search;
  return null;
}
async function settle(ms = 30) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); }); }
async function mount(url: string) {
  await act(async () => { root.render(<MemoryRouter initialEntries={[url]}><Probe /><AzukiRoutes /></MemoryRouter>); });
  await settle();
}
function button(label: string) {
  const found = [...container.querySelectorAll("button")].find((item) => (item.querySelector("strong")?.textContent ?? item.textContent)?.trim() === label);
  expect(found, `button: ${label}`).toBeTruthy();
  return found!;
}
async function click(label: string) { await act(async () => { button(label).click(); }); await settle(); }
async function move(target: string | number) { await act(async () => { if (typeof target === "number") await navigate(target); else await navigate(target); }); await settle(); }
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.user = null;
  mocks.deck.isOfficial = false;
  mocks.deck.officialLevel = undefined;
  mocks.listeners.clear();
  mocks.save.mockReset().mockResolvedValue(mocks.owned);
  mocks.list.mockReset().mockResolvedValue({ decks: [mocks.deck], nextCursor: null });
  mocks.login.mockReset().mockImplementation(async () => {
    mocks.user = { uid: "bob", displayName: "Bob", providerData: [] };
    mocks.listeners.forEach((cb) => cb(mocks.user));
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
describe("URL navigation", () => {
  it("groups public actions and dismisses choices with Escape or an outside click", async()=>{
    await mount('/shared/demo-deck');
    expect(container.querySelectorAll('.public-deck-actions button')).toHaveLength(3);
    await click('学習する');
    expect(button('例文カードで学習')).toBeTruthy();
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(container.querySelector('.deck-action-options')).toBeNull();
    expect(document.activeElement).toBe(button('学習する'));
    await click('その他');
    expect(button('リンクをコピー')).toBeTruthy();
    await act(async()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
    expect(container.querySelector('.deck-action-options')).toBeNull();
    await click('学習する');await click('単語帳で学習');
    expect(currentURL).toBe('/shared/demo-deck/book');
  });
  it("adds a book from its details after login and shows save errors inline",async()=>{
    await mount('/shared/demo-deck');
    mocks.save.mockRejectedValueOnce(new Error('登録上限に達しました。'));
    await click('その他');
    await click('コピーして編集');
    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('登録上限');
    expect(currentURL).toBe('/shared/demo-deck');
    await click('その他');
    await click('コピーして編集');
    expect(currentURL).toBe('/library/decks/saved-deck');
    expect(mocks.login).toHaveBeenCalledTimes(1);
  });

  it("closes and reopens the public fork dialog with X, Cancel, and Escape", async () => {
    await mount("/shared/demo-deck");
    for (const action of ["close", "cancel", "escape"]) {
      await click("その他");
      await click("JSONを編集してフォーク");
      expect(container.querySelectorAll(".fork-dialog")).toHaveLength(1);
      await act(async () => {
        const dialog = container.querySelector<HTMLDialogElement>(".fork-dialog")!;
        if (action === "close") dialog.querySelector<HTMLButtonElement>('[aria-label="閉じる"]')!.click();
        else if (action === "cancel") button("キャンセル").click();
        else dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
      });
      expect(container.querySelector(".fork-dialog")).toBeNull();
      expect(container.querySelector("h1")?.textContent).toBe("日常のことば");
    }
  });
  it("opens example cards from both personal and public decks", async () => {
    for (const path of ["/demo/decks/demo-deck", "/shared/demo-deck"]) {
      await act(async () => root.unmount());
      root = createRoot(container);
      await mount(path);
      if(path.startsWith("/shared/"))await click("学習する");
      await click("例文カードで学習");
      expect(currentURL).toBe(`${path}/study?mode=examples`);
      expect(container.textContent).toContain("例文カード学習");
      expect((container.querySelector('[aria-label="カードの向き"]') as unknown as {value:string})?.value).toBe("en-ja");
    }
  });
  it("opens a study deep link directly, and restores details through Back and Forward", async () => {
    await mount("/demo/decks/demo-deck/?q=curious");
    await settle(280);
    expect(container.querySelector("h1")?.textContent).toBe("日常のことば");
    expect(container.querySelector<HTMLInputElement>('[aria-label="単語・意味を検索"]')?.value).toBe("curious");
    await click("カードで学習");
    expect(currentURL).toBe("/demo/decks/demo-deck/study?q=curious&mode=words");
    expect(container.querySelector(".study-page")).toBeTruthy();
    expect(container.querySelector(".sidebar")).toBeNull();
    await move(-1);
    expect(currentURL).toBe("/demo/decks/demo-deck?q=curious");
    expect(container.querySelector(".study-page")).toBeNull();
    await move(1);
    expect(container.querySelector(".study-page")).toBeTruthy();
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(currentURL);
    expect(container.querySelector(".study-page")).toBeTruthy();
    await click("学習をはじめる");
    expect(container.querySelector(".study-card")?.textContent).toContain("好奇心の強い");
    expect(container.querySelector(".study-card")?.textContent).not.toContain("curious");
  });
  it("restores public search from URL and history, and opens public study directly", async () => {
    await mount("/explore?q=教科書");
    await settle(400);
    expect(mocks.list).toHaveBeenLastCalledWith("教科書", null, expect.any(AbortSignal));
    await move("/shared/demo-deck/study");
    expect(container.querySelector(".study-page")).toBeTruthy();
    await move(-1);
    expect(container.querySelector<HTMLInputElement>('[aria-label="公開単語帳を検索"]')?.value).toBe("教科書");
    await move("/demo?tag=教科書&sort=name&q=ことば");
    expect(container.querySelector<HTMLInputElement>('[aria-label="単語帳を検索"]')?.value).toBe("ことば");
    expect(container.querySelector("select")?.value).toBe("name");
    expect([...container.querySelectorAll("a.deck-card")].filter(card => !card.closest(".standard-library"))).toHaveLength(1);
  });
  it("routes import and share settings, redirects legacy demo links, and handles missing pages", async () => {
    await mount("/?demo=1");
    expect(currentURL).toBe("/demo");
    await move("/demo/import");
    expect(container.querySelector("dialog[open]")?.textContent).toContain("単語帳を追加");
    await click("キャンセル");
    expect(currentURL).toBe("/demo");
    await move("/demo/decks/demo-deck/share");
    expect(container.querySelector("dialog[open]")).toBeTruthy();
    await move("/demo/decks/missing");
    expect(container.textContent).toContain("単語帳が見つかりません");
    await move("/not-a-page");
    expect(container.textContent).toContain("ページが見つかりません");
  });
  it("resumes a private study deep link after Google login", async () => {
    await mount("/library/decks/saved-deck/study");
    expect(button("Googleでログイン")).toBeTruthy();
    await click("Googleでログイン");
    expect(currentURL).toBe("/library/decks/saved-deck/study");
    expect(container.querySelector(".study-page")).toBeTruthy();
  });
});
describe("saving a public deck", () => {
  it("signs in once, saves once, and opens the saved private deck", async () => {
    await mount("/shared/demo-deck");
    await click("その他");
    await click("コピーして編集");
    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith("demo-deck");
    expect(currentURL).toBe("/library/decks/saved-deck");
    expect(container.querySelector(".private-badge")?.textContent).toContain("非公開");
  });
  it("ignores duplicate clicks and does not redirect after the user leaves a pending save", async () => {
    let finish!: (value: unknown) => void;
    mocks.save.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await mount("/shared/demo-deck");
    await click("その他");
    await act(async () => {
      const control = button("コピーして編集");
      control.click();
      control.click();
    });
    await settle();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await move("/shared/demo-deck/study");
    await act(async () => finish(mocks.owned));
    await settle();
    expect(currentURL).toBe("/shared/demo-deck/study");
  });
  it("keeps the public page available after login cancellation or a failed save", async () => {
    await mount("/shared/demo-deck");
    mocks.login.mockRejectedValueOnce({ code: "auth/popup-closed-by-user" });
    await click("その他");
    await click("コピーして編集");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    mocks.save.mockRejectedValueOnce(new Error("登録上限に達しました。"));
    await click("その他");
    await click("コピーして編集");
    expect(currentURL).toBe("/shared/demo-deck");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("登録上限");
  });
});

describe("official publisher and deck-level difficulty", () => {
  it("shows official identity and level on the cover and details, but not on a saved copy", async () => {
    mocks.deck.isOfficial = true;
    mocks.deck.officialLevel = "intermediate";
    await mount("/explore");
    await settle(280);
    expect(container.querySelector(".cover-top .official-badge")?.textContent).toBe("Azuki運営 発行");
    expect(container.querySelector('[aria-label="学習レベルの目安：中級"]')).toBeTruthy();
    await move("/shared/demo-deck");
    expect(container.querySelector(".official-publisher")?.textContent).toContain("Azukiが編集した単語帳です。");
    expect(container.querySelector(".level-guide")?.textContent).toContain("Azuki独自の目安");
    expect(container.querySelectorAll(".level-guide dt")).toHaveLength(3);
    await click("その他");
    await click("コピーして編集");
    expect(currentURL).toBe("/library/decks/saved-deck");
    expect(container.querySelector(".public-family-card .official-badge")).toBeNull();
    expect(container.querySelector(".official-level")).toBeNull();
    expect(container.querySelector(".official-publisher")).toBeNull();
  });
  it("hides publisher and level for an ordinary book, even with an untrusted level value", async () => {
    mocks.deck.officialLevel = "advanced";
    await mount("/explore");
    await settle(280);
    expect(container.querySelector(".public-family-card .official-badge")).toBeNull();
    expect(container.querySelector(".public-family-card .official-level")).toBeNull();
    await move("/shared/demo-deck");
    expect(container.querySelector(".official-publisher")).toBeNull();
    expect(container.querySelector(".official-level")).toBeNull();
  });
});

it("opens the public creation guide and returns to the demo JSON paste tab", async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  await mount('/demo/import');
  const guide = container.querySelector<HTMLAnchorElement>('a[href="/guide/create?mode=demo"]')!;
  expect(guide).toBeTruthy();
  await act(async () => guide.click()); await settle();
  expect(container.querySelector('h1')?.textContent).toBe('オリジナル英単語帳の作り方');
  const copy = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText: copy } });
  await click('プロンプトをコピー');
  expect(copy).toHaveBeenCalledWith(expect.stringContaining('"words": ['));
  expect(container.querySelector('#own-examples-title')?.textContent).toBe('オリジナルの単語と例文を登録する');
  await click('例文付きJSONをコピー');
  const sample = JSON.parse(copy.mock.calls.at(-1)![0]);
  expect(sample.words).toHaveLength(2);
  expect(sample.words.every((word: any) => word.word && word.meaning && word.example)).toBe(true);
  const paste = container.querySelector<HTMLAnchorElement>('a[href="/demo/import?tab=paste"]')!;
  await act(async () => paste.click()); await settle();
  expect(currentURL).toBe('/demo/import?tab=paste');
  expect(container.querySelector('#json-input')).toBeTruthy();
});

it('shows the tutorial after login, remembers dismissal, and replays it from settings', async () => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  mocks.user = { uid:'tutorial-user', displayName:'Tutorial', providerData:[] };
  await mount('/library');
  expect(container.querySelector('#tutorial-title')?.textContent).toBe('Azukiへようこそ');
  await click('次へ');
  expect(container.querySelector('#tutorial-title')?.textContent).toBe('単語帳を追加する');
  await click('戻る');
  expect(container.querySelector('#tutorial-title')?.textContent).toBe('Azukiへようこそ');
  await click('スキップ');
  expect(container.querySelector('.tutorial-overlay')).toBeNull();
  await move('/library/settings');
  await click('ライブラリに戻る');
  expect(container.querySelector('.tutorial-overlay')).toBeNull();
  await move('/library/settings');
  await click('チュートリアルを見る');
  expect(container.querySelector('#tutorial-title')?.textContent).toBe('Azukiへようこそ');
  await click('次へ');
  await click('次へ');
  expect(container.querySelector('#tutorial-title')?.textContent).toBe('自分の例文も登録できます');
  for (let i=0;i<3;i++) await click('次へ');
  await click('はじめる');
  expect(container.querySelector('.tutorial-overlay')).toBeNull();
  expect(currentURL).toBe('/library');
});

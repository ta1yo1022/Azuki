"use client";

import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ArrowLeftIcon, CardsIcon } from "@/components/Icons";
import type { Book, CardMode, Word } from "@/lib/types";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function validMode(value: string | null): CardMode {
  return value === "ja-en" ? "ja-en" : "en-ja";
}

function subscribeToHydration() {
  return () => {};
}

export function CardStudy({ book }: { book: Book }) {
  const searchParams = useSearchParams();
  const mode = validMode(searchParams.get("mode"));
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  if (!hydrated) {
    return <CardLoading />;
  }

  return <CardSession book={book} mode={mode} />;
}

function CardSession({ book, mode }: { book: Book; mode: CardMode }) {
  const [deck, setDeck] = useState<Word[]>(() => shuffle(book.words));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const currentWord = deck[index];
  const finished = deck.length > 0 && index >= deck.length;

  function nextCard() {
    setFlipped(false);
    setIndex((current) => current + 1);
  }

  function restart() {
    setDeck(shuffle(book.words));
    setIndex(0);
    setFlipped(false);
  }

  if (deck.length === 0) {
    return (
      <StudyMessage
        bookId={book.id}
        title="単語がありません"
        text="この単語帳には単語が登録されていません。"
      />
    );
  }

  if (finished) {
    return (
      <main className="app-shell flex min-h-[100svh] flex-col justify-center py-10">
        <div className="mx-auto w-full max-w-md text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f5ece2] text-azuki">
            <CardsIcon className="h-10 w-10" />
          </span>
          <p className="section-label mt-7">Session complete</p>
          <h1 className="mt-2 font-display text-4xl font-black tracking-[-0.04em] text-ink">
            一周しました
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {book.name} の全{deck.length}語を確認しました。
          </p>

          <div className="mt-8 grid gap-3">
            <button type="button" onClick={restart} className="primary-button">
              もう一周する
            </button>
            <a href={`/books/${book.id}/`} className="secondary-button">
              詳細に戻る
            </a>
          </div>
        </div>
      </main>
    );
  }

  const front = mode === "en-ja" ? currentWord.en : currentWord.ja;
  const back = mode === "en-ja" ? currentWord.ja : currentWord.en;
  const position = index + 1;

  return (
    <main className="app-shell flex min-h-[100svh] flex-col py-5">
      <header className="flex items-center gap-3">
        <a
          href={`/books/${book.id}/`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-sm"
          aria-label="学習を中断して戻る"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-xs font-black text-muted">
            <span className="truncate">{book.name}</span>
            <span>
              {position} / {deck.length}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2d6c9]">
            <div
              className="h-full rounded-full bg-azuki transition-[width] duration-300"
              style={{ width: `${(position / deck.length) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <section className="flex flex-1 flex-col justify-center py-7">
        <p className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.18em] text-muted">
          {flipped ? "Answer" : mode === "en-ja" ? "English" : "Japanese"}
        </p>
        <button
          type="button"
          className={`flip-card mx-auto aspect-[4/5] w-full max-w-sm ${
            flipped ? "is-flipped" : ""
          }`}
          onClick={() => setFlipped((value) => !value)}
          aria-label={flipped ? "カードの表を見る" : "答えを見る"}
        >
          <span className="flip-card-inner">
            <span className="flip-card-face">
              <span className="font-display text-4xl font-black leading-tight tracking-[-0.03em] text-ink sm:text-5xl">
                {front}
              </span>
              <span className="absolute bottom-7 text-xs font-bold text-[#b3a08e]">
                タップして答えを見る
              </span>
            </span>
            <span className="flip-card-face flip-card-back">
              <span className="font-display text-4xl font-black leading-tight tracking-[-0.03em] text-white sm:text-5xl">
                {back}
              </span>
              <span className="absolute bottom-7 text-xs font-bold text-white/60">
                タップして戻す
              </span>
            </span>
          </span>
        </button>
      </section>

      <div className="pb-[max(4px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={nextCard} className="primary-button">
          次の単語へ
        </button>
      </div>
    </main>
  );
}

function CardLoading() {
  return (
    <main className="app-shell flex min-h-[100svh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d8c9b9] border-t-azuki" />
    </main>
  );
}

function StudyMessage({
  bookId,
  title,
  text,
}: {
  bookId: string;
  title: string;
  text: string;
}) {
  return (
    <main className="app-shell flex min-h-[100svh] items-center justify-center py-10">
      <div className="w-full max-w-md rounded-[30px] bg-white p-7 text-center shadow-sm">
        <h1 className="font-display text-2xl font-black text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
        <a href={`/books/${bookId}/`} className="secondary-button mt-6">
          詳細に戻る
        </a>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeftIcon } from "@/components/Icons";
import type { Book, ListDisplayMode } from "@/lib/types";

const modes: { value: ListDisplayMode; label: string }[] = [
  { value: "both", label: "両方" },
  { value: "hide-ja", label: "日本語を隠す" },
  { value: "hide-en", label: "英語を隠す" },
];

export function ListStudy({ book }: { book: Book }) {
  const [mode, setMode] = useState<ListDisplayMode>("both");
  const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set());

  function changeMode(nextMode: ListDisplayMode) {
    setMode(nextMode);
    setRevealedCells(new Set());
  }

  function toggleCell(cellId: string) {
    setRevealedCells((current) => {
      const next = new Set(current);
      if (next.has(cellId)) {
        next.delete(cellId);
      } else {
        next.add(cellId);
      }
      return next;
    });
  }

  return (
    <main className="app-shell min-h-[100svh] py-5 pb-[max(28px,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3">
        <Link
          href={`/books/${book.id}/`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-sm"
          aria-label="詳細に戻る"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <p className="section-label">Word list</p>
          <h1 className="font-display text-xl font-black text-ink">{book.name}</h1>
        </div>
      </header>

      <div className="sticky top-0 z-10 -mx-4 mt-5 bg-cream/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="grid grid-cols-3 rounded-2xl bg-[#e5d9cc] p-1">
          {modes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => changeMode(item.value)}
              className={`min-h-11 rounded-xl px-1 text-[11px] font-bold transition ${
                mode === item.value ? "bg-white text-ink shadow-sm" : "text-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-[24px] border border-[#e9ded2] bg-white">
        <div className="grid grid-cols-2 border-b border-[#e9ded2] bg-[#f8f3ed] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-muted">
          <span>English</span>
          <span>Japanese</span>
        </div>
        {book.words.map((word, index) => {
          const hideEn = mode === "hide-en" && !revealedCells.has(`${word.id}-en`);
          const hideJa = mode === "hide-ja" && !revealedCells.has(`${word.id}-ja`);

          return (
            <div
              key={word.id}
              className={`grid min-h-[68px] grid-cols-2 items-stretch ${
                index > 0 ? "border-t border-[#f0e8df]" : ""
              }`}
            >
              <WordCell
                value={word.en}
                hidden={hideEn}
                onClick={() => mode === "hide-en" && toggleCell(`${word.id}-en`)}
                strong
              />
              <WordCell
                value={word.ja}
                hidden={hideJa}
                onClick={() => mode === "hide-ja" && toggleCell(`${word.id}-ja`)}
              />
            </div>
          );
        })}
      </div>
    </main>
  );
}

function WordCell({
  value,
  hidden,
  onClick,
  strong = false,
}: {
  value: string;
  hidden: boolean;
  onClick: () => void;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-w-0 px-3 py-4 text-left text-sm ${
        strong ? "font-display font-bold text-ink" : "text-muted"
      }`}
    >
      <span className={hidden ? "select-none blur-[7px]" : ""}>{value}</span>
    </button>
  );
}

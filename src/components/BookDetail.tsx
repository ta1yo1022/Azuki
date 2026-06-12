import Link from "next/link";
import {
  CardsIcon,
  ChevronRightIcon,
  ListIcon,
} from "@/components/Icons";
import type { Book } from "@/lib/types";

export function BookDetail({ book }: { book: Book }) {
  return (
    <>
      <section className="rounded-[30px] bg-ink p-6 text-white shadow-[0_16px_50px_rgba(50,34,22,0.16)] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d8c9b9]">
          Vocabulary book
        </p>
        <h1 className="mt-3 font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          {book.name}
        </h1>
        {book.description && (
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#e7ddd3]">
            {book.description}
          </p>
        )}
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#d8c9b9]">
          {book.words.length} words
        </p>
      </section>

      <section className="mt-8 grid gap-3">
        <StudyLink
          href={`/books/${book.id}/cards/?mode=en-ja`}
          icon={<CardsIcon className="h-6 w-6" />}
          eyebrow="FLASH CARDS"
          title="英語 → 日本語"
          accent
        />
        <StudyLink
          href={`/books/${book.id}/cards/?mode=ja-en`}
          icon={<CardsIcon className="h-6 w-6" />}
          eyebrow="FLASH CARDS"
          title="日本語 → 英語"
        />
        <StudyLink
          href={`/books/${book.id}/list/`}
          icon={<ListIcon className="h-6 w-6" />}
          eyebrow="WORD LIST"
          title="リストで学習"
        />
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="section-label">収録単語</p>
            <h2 className="mt-1 font-display text-2xl font-black text-ink">
              All words
            </h2>
          </div>
          <span className="text-sm font-bold text-muted">
            {book.words.length}語
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-[24px] border border-[#e9ded2] bg-white">
          {book.words.map((word, index) => (
            <div
              key={word.id}
              className={`grid grid-cols-2 items-center gap-3 px-4 py-4 ${
                index > 0 ? "border-t border-[#f0e8df]" : ""
              }`}
            >
              <span className="font-display font-bold text-ink">{word.en}</span>
              <span className="text-sm text-muted">{word.ja}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function StudyLink({
  href,
  icon,
  eyebrow,
  title,
  accent = false,
}: {
  href: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-20 items-center gap-4 rounded-[22px] border p-4 transition active:scale-[0.985] ${
        accent
          ? "border-azuki bg-azuki text-white shadow-[0_10px_30px_rgba(151,45,49,0.2)]"
          : "border-[#e9ded2] bg-white text-ink"
      }`}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          accent ? "bg-white/15" : "bg-[#f5ece2] text-azuki"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[10px] font-black tracking-[0.18em] ${
            accent ? "text-white/70" : "text-muted"
          }`}
        >
          {eyebrow}
        </span>
        <span className="mt-0.5 block font-display text-lg font-black">
          {title}
        </span>
      </span>
      <ChevronRightIcon className="h-6 w-6" />
    </Link>
  );
}

import Link from "next/link";
import { ChevronRightIcon } from "@/components/Icons";
import type { Book } from "@/lib/types";

export function BookCard({ book, index }: { book: Book; index: number }) {
  return (
    <Link
      href={`/books/${book.id}/`}
      className="group block rounded-[28px] border border-[#e9ded2] bg-white p-5 shadow-[0_10px_35px_rgba(59,42,25,0.06)] transition active:scale-[0.985] sm:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f5ece2] font-display text-xl font-black text-azuki">
          {String(index + 1).padStart(2, "0")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl font-black leading-tight tracking-[-0.02em] text-ink">
              {book.name}
            </h2>
            <ChevronRightIcon className="mt-0.5 h-6 w-6 shrink-0 text-[#baa897] transition-transform group-hover:translate-x-1" />
          </div>
          {book.description && (
            <p className="mt-1.5 text-sm leading-6 text-muted">
              {book.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-[#f0e8df] pt-4">
        <span className="text-xs font-bold tracking-wide text-muted">
          {book.words.length} WORDS
        </span>
      </div>
    </Link>
  );
}

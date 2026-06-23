import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@/components/Icons";
import { BookDetail } from "@/components/BookDetail";
import { getAllBooks, getBook } from "@/lib/books";

type PageProps = {
  params: Promise<{ bookId: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBooks().map((book) => ({ bookId: book.id }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { bookId } = await params;
  const book = getBook(bookId);
  return { title: book?.name ?? "単語帳" };
}

export default async function BookPage({ params }: PageProps) {
  const { bookId } = await params;
  const book = getBook(bookId);
  if (!book) {
    notFound();
  }

  return (
    <main className="app-shell min-h-[100svh] py-5 pb-[max(36px,env(safe-area-inset-bottom))]">
      <a
        href="/"
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full pr-4 text-sm font-bold text-muted"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <ArrowLeftIcon className="h-5 w-5" />
        </span>
        単語帳一覧
      </a>
      <BookDetail book={book} />
    </main>
  );
}

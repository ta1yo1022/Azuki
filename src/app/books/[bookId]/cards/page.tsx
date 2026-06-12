import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CardStudy } from "@/components/CardStudy";
import { getAllBooks, getBook } from "@/lib/books";

type PageProps = {
  params: Promise<{ bookId: string }>;
};

export const metadata: Metadata = {
  title: "カード学習",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBooks().map((book) => ({ bookId: book.id }));
}

export default async function CardsPage({ params }: PageProps) {
  const { bookId } = await params;
  const book = getBook(bookId);
  if (!book) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <CardStudy book={book} />
    </Suspense>
  );
}

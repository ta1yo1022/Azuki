import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListStudy } from "@/components/ListStudy";
import { getAllBooks, getBook } from "@/lib/books";

type PageProps = {
  params: Promise<{ bookId: string }>;
};

export const metadata: Metadata = {
  title: "リスト学習",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBooks().map((book) => ({ bookId: book.id }));
}

export default async function ListPage({ params }: PageProps) {
  const { bookId } = await params;
  const book = getBook(bookId);
  if (!book) {
    notFound();
  }

  return <ListStudy book={book} />;
}

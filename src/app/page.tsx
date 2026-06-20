import { BookCard } from "@/components/BookCard";
import { Logo } from "@/components/Logo";
import { getAllBooks } from "@/lib/books";

export default function Home() {
  const books = getAllBooks();

  return (
    <main className="app-shell min-h-[100svh] py-6 pb-[max(32px,env(safe-area-inset-bottom))]">
      <header>
        <Logo />
      </header>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="section-label">Your books</p>
            <h2 className="mt-1 font-display text-2xl font-black text-ink">
              単語帳
            </h2>
          </div>
          <span className="text-sm font-bold text-muted">{books.length}冊</span>
        </div>
        <div className="grid gap-4">
          {books.map((book, index) => (
            <BookCard key={book.id} book={book} index={index} />
          ))}
        </div>
      </section>
    </main>
  );
}

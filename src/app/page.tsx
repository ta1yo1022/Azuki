import { BookCard } from "@/components/BookCard";
import { Logo } from "@/components/Logo";
import { getAllBooks } from "@/lib/books";

export default function Home() {
  const books = getAllBooks();
  const totalWords = books.reduce((total, book) => total + book.words.length, 0);

  return (
    <main className="app-shell min-h-[100svh] py-6 pb-[max(32px,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <Logo />
        <span className="rounded-full border border-[#dfd2c5] bg-white px-3 py-2 text-[10px] font-black tracking-[0.12em] text-muted">
          {totalWords} WORDS
        </span>
      </header>

      <section className="pb-8 pt-14">
        <p className="section-label">Build your vocabulary</p>
        <h1 className="mt-3 max-w-md font-display text-[42px] font-black leading-[1.04] tracking-[-0.05em] text-ink sm:text-5xl">
          小さく積んで、
          <br />
          <span className="text-azuki">じっくり学ぶ。</span>
        </h1>
        <p className="mt-5 max-w-md text-sm leading-7 text-muted">
          今日の一歩を選んで、あなたのペースで英単語を身につけましょう。
        </p>
      </section>

      <section>
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

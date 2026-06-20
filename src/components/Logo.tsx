import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Azuki ホーム">
      <h1 className="font-display text-[25px] font-black tracking-[-0.04em] text-ink">
        Azuki
      </h1>
    </Link>
  );
}

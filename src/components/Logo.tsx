import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Azuki ホーム">
      <span className="font-display text-[25px] font-black tracking-[-0.04em] text-ink">
        Azuki
      </span>
    </Link>
  );
}

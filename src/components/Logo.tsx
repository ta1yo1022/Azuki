import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2" aria-label="Azuki ホーム">
      <span className="azuki-mark" aria-hidden="true">
        A
      </span>
      <span className="font-display text-[25px] font-black tracking-[-0.04em] text-ink">
        Azuki
      </span>
    </Link>
  );
}

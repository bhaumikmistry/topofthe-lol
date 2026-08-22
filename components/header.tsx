import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export function Header() {
  return (
    <header className="brut border-x-0 border-t-0">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-extrabold uppercase tracking-[-0.03em] no-underline sm:text-xl"
        >
          topofthe<span className="mark">.lol</span>
        </Link>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/bhaumikmistry/topofthe-lol"
            target="_blank"
            rel="noopener noreferrer"
            className="brut-btn hidden bg-background px-3 py-1.5 text-[11px] transition-none sm:inline-block"
          >
            Source
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export function Header() {
  return (
    <header className="py-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4">
        <Link href="/" className="font-mono text-lg font-bold tracking-tight">
          topofthe.lol
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <a
            href="https://github.com/shadcn-labs/outbid-template"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Build one
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

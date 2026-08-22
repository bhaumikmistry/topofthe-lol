import { ArrowUpRight } from 'lucide-react';
import { formatMoney, type Listing } from '@/lib/site-data';
import { cn } from '@/lib/utils';

function rankStyle(rank: number) {
  if (rank === 1) return 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/40';
  if (rank === 2) return 'bg-zinc-400/15 text-zinc-500 ring-1 ring-zinc-400/40';
  if (rank === 3) return 'bg-orange-600/15 text-orange-700 ring-1 ring-orange-600/40';
  return 'bg-muted text-muted-foreground';
}

export function SiteRow({ listing }: { listing: Listing }) {
  const { rank, domain, url, tagline, topBid, topEntry } = listing;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 border-b border-border px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/50 sm:gap-4 sm:px-4"
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold',
          rankStyle(rank)
        )}
      >
        {rank}
      </span>

      {/* Favicons come straight from the listed site; no proxy, no layout shift. */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt=""
        width={28}
        height={28}
        loading="lazy"
        className="hidden h-7 w-7 shrink-0 rounded bg-muted sm:block"
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium">{domain}</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {topEntry ? `#1: ${topEntry}` : tagline || 'No description'}
          </span>
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block font-mono text-base font-semibold tabular-nums sm:text-lg">
          {formatMoney(topBid)}
        </span>
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          top bid
        </span>
      </span>
    </a>
  );
}

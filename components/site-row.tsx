import { formatMoney, type Listing } from '@/lib/site-data';
import { cn } from '@/lib/utils';

export function SiteRow({ listing }: { listing: Listing }) {
  const { rank, domain, url, tagline, topBid, topEntry } = listing;
  const leader = rank === 1;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex items-stretch gap-0 border-b-[3px] border-border no-underline last:border-b-0',
        'hover:bg-[var(--orange)] hover:text-black',
        leader && 'bg-[var(--orange)] text-black'
      )}
    >
      <span
        className={cn(
          'flex w-12 shrink-0 items-center justify-center border-r-[3px] border-border text-lg font-extrabold tabular-nums sm:w-16 sm:text-2xl',
          leader ? 'bg-black text-[var(--orange)]' : 'group-hover:border-black'
        )}
      >
        {rank}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-3 sm:px-4">
        <span className="truncate text-sm font-extrabold uppercase tracking-[-0.01em] sm:text-base">
          {domain}
        </span>
        <span
          className={cn(
            'truncate text-[11.5px] leading-snug',
            leader ? 'text-black/70' : 'text-muted-foreground group-hover:text-black/70'
          )}
        >
          {topEntry ? `#1 ${topEntry}` : tagline || 'No description'}
        </span>
      </span>

      <span
        className={cn(
          'flex w-[104px] shrink-0 flex-col items-end justify-center border-l-[3px] border-border px-3 py-3 text-right sm:w-[132px] sm:px-4',
          !leader && 'group-hover:border-black'
        )}
      >
        <span className="text-base font-extrabold tabular-nums sm:text-lg">
          {formatMoney(topBid)}
        </span>
        <span
          className={cn(
            'text-[10px] uppercase tracking-[0.06em]',
            leader ? 'text-black/70' : 'text-muted-foreground group-hover:text-black/70'
          )}
        >
          top bid
        </span>
      </span>
    </a>
  );
}

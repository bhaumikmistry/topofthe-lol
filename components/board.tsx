'use client';

import { useMemo, useState } from 'react';
import { SiteRow } from '@/components/site-row';
import type { Listing } from '@/lib/site-data';
import { cn } from '@/lib/utils';

type Sort = 'bid' | 'name';

export function Board({ listings }: { listings: Listing[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('bid');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? listings.filter((listing) =>
          `${listing.domain} ${listing.tagline} ${listing.topEntry ?? ''}`
            .toLowerCase()
            .includes(needle)
        )
      : listings;
    return sort === 'name'
      ? [...filtered].sort((a, b) => a.domain.localeCompare(b.domain))
      : filtered;
  }, [listings, query, sort]);

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-stretch gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="SEARCH"
          aria-label="Search sites"
          className="brut brut-shadow min-w-0 flex-1 bg-card px-3 py-2.5 text-sm uppercase tracking-[0.04em] outline-none placeholder:text-muted-foreground focus:bg-[color-mix(in_srgb,var(--orange)_12%,var(--card))]"
        />
        <div className="brut brut-shadow flex shrink-0 bg-card">
          {(['bid', 'name'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSort(option)}
              className={cn(
                'px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em]',
                option === 'bid' && 'border-r-[3px] border-border',
                sort === option
                  ? 'bg-foreground text-background'
                  : 'hover:bg-[var(--orange)] hover:text-black'
              )}
            >
              {option === 'bid' ? 'By bid' : 'A–Z'}
            </button>
          ))}
        </div>
      </div>

      <div className="brut brut-shadow bg-card">
        {visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm font-bold uppercase">
            Nothing matches “{query}”
          </p>
        ) : (
          visible.map((listing) => <SiteRow key={listing.domain} listing={listing} />)
        )}
      </div>
    </section>
  );
}

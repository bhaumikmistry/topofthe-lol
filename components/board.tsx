'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { SiteRow } from '@/components/site-row';
import { Input } from '@/components/ui/input';
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
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sites"
            aria-label="Search sites"
            className="pl-9"
          />
        </div>
        <div className="flex shrink-0 rounded-md border border-border p-0.5 text-xs">
          {(['bid', 'name'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSort(option)}
              className={cn(
                'rounded px-2.5 py-1.5 transition-colors',
                sort === option
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option === 'bid' ? 'Top bid' : 'A–Z'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nothing matches “{query}”.
          </p>
        ) : (
          visible.map((listing) => <SiteRow key={listing.domain} listing={listing} />)
        )}
      </div>
    </section>
  );
}

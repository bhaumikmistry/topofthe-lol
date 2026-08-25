import bids from '@/data/bids.json';
import candidatesFile from '@/data/candidates.json';
import sites from '@/data/sites.json';

export interface SiteConfig {
  domain: string;
  tagline?: string;
  endpoint?: string;
  listPath?: string;
  valuePath?: string;
  bidKey?: string;
  nameKey?: string;
  nameValuePath?: string;
  htmlFallback?: boolean;
  manualBid?: number;
  manualEntry?: string;
}

export interface BidResult {
  domain: string;
  topBid: number | null;
  topEntry: string | null;
  previousBid?: number | null;
  source: 'api' | 'embedded' | 'claim' | 'html' | 'manual' | null;
  currency?: 'USD' | 'GBP' | 'EUR';
  exact?: boolean;
  ok: boolean;
  stale?: boolean;
  skipped?: boolean;
  error: string | null;
  checkedAt: string;
  meta?: { title?: string | null; description?: string | null };
}

export interface Listing {
  rank: number;
  domain: string;
  url: string;
  title: string;
  tagline: string;
  topBid: number | null;
  topEntry: string | null;
  previousBid: number | null;
  source: BidResult['source'];
  currency: NonNullable<BidResult['currency']>;
  exact: boolean;
  stale: boolean;
  checkedAt: string | null;
}

// Contributions land here as hand-edited JSON, so treat both files as untrusted:
// a malformed entry gets dropped, it never takes the build down.
const configs = ((sites as { sites?: SiteConfig[] }).sites ?? []).filter(
  (site): site is SiteConfig =>
    Boolean(site) && typeof site === 'object' && typeof site.domain === 'string' && site.domain.includes('.')
);
const results = (bids as { updatedAt?: string; results?: Record<string, BidResult> }).results ?? {};

/** .lol boards we know of that publish no readable number, kept in the repo. */
export const candidateCount: number = Object.keys(
  (candidatesFile as { candidates?: Record<string, unknown> }).candidates ?? {}
).length;

export const updatedAt: string = (bids as { updatedAt: string }).updatedAt ?? '';

/** Every listed site, highest top-bid first. Unpriced sites sort last. */
export function getListings(): Listing[] {
  return configs
    .map((site) => {
      const result = results[site.domain];
      const bid = typeof result?.topBid === 'number' && Number.isFinite(result.topBid) ? result.topBid : null;
      return {
        domain: site.domain,
        url: `https://${site.domain}`,
        title: result?.meta?.title?.split(/[—|·]/)[0]?.trim() || site.domain,
        tagline: site.tagline || result?.meta?.description || '',
        topBid: bid,
        topEntry: result?.topEntry ?? null,
        previousBid: result?.previousBid ?? null,
        source: result?.source ?? null,
        currency: result?.currency ?? 'USD',
        exact: result?.exact !== false,
        stale: Boolean(result?.stale),
        checkedAt: result?.checkedAt ?? null,
      };
    })
    .sort((a, b) => (b.topBid ?? -1) - (a.topBid ?? -1))
    .map((listing, index) => ({ ...listing, rank: index + 1 }));
}

export function getStats(listings: Listing[]) {
  const priced = listings.filter((listing) => typeof listing.topBid === 'number');
  const total = priced.reduce((sum, listing) => sum + (listing.topBid ?? 0), 0);
  return {
    count: listings.length,
    priced: priced.length,
    total,
    highest: priced[0]?.topBid ?? 0,
    // Boards sitting at $0 are empty rather than cheap, and quoting $0 as the
    // going rate for #1 is misleading.
    cheapest: priced.filter((listing) => (listing.topBid ?? 0) > 0).at(-1)?.topBid ?? 0,
    empty: priced.filter((listing) => listing.topBid === 0).length,
  };
}

const SYMBOLS = { USD: '$', GBP: '£', EUR: '€' } as const;

// Not every board charges in dollars, so the symbol comes from the board.
export function formatMoney(amount: number | null, currency: keyof typeof SYMBOLS = 'USD'): string {
  if (amount === null) return '—';
  const symbol = SYMBOLS[currency] ?? '$';
  return amount % 1 === 0
    ? `${symbol}${amount.toLocaleString('en-US')}`
    : `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

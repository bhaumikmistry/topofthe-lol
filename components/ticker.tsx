import { formatMoney, type Listing } from '@/lib/site-data';

/**
 * The live board as a marquee. The list is rendered twice so the CSS animation
 * can loop on a -50% shift without a visible seam — no JavaScript involved.
 */
export function Ticker({ listings }: { listings: Listing[] }) {
  const items = listings
    .filter((listing) => listing.topBid !== null)
    .slice(0, 12)
    .map((listing) => `${listing.domain} ${formatMoney(listing.topBid)}`);

  if (!items.length) return null;

  return (
    <div className="ticker py-2 text-[12px] font-bold uppercase tracking-[0.08em]">
      <div className="ticker__track">
        {[0, 1].map((copy) => (
          <div key={copy} className="inline-flex shrink-0" aria-hidden={copy === 1}>
            {items.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

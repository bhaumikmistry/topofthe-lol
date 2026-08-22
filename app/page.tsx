import { Board } from '@/components/board';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { formatMoney, getListings, getStats, updatedAt } from '@/lib/site-data';

// Rebuilt on every deploy and every bid refresh commit — no request-time work.
export const dynamic = 'force-static';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export default function Home() {
  const listings = getListings();
  const stats = getStats(listings);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-8">
          <section className="py-6">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Every .lol bid site, ranked by its own top bid.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Pay-to-rank leaderboards took over the timeline. This is the index: which board is
              real money, which one you can still top for the price of a coffee.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="sites" value={String(stats.count)} />
              <Stat label="highest bid" value={formatMoney(stats.highest)} />
              <Stat label="all top bids" value={formatMoney(Math.round(stats.total))} />
              <Stat
                label="updated"
                value={
                  updatedAt
                    ? new Date(updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'
                }
              />
            </div>
          </section>

          <Board listings={listings} />
        </div>
      </main>
      <Footer count={stats.count} />
    </div>
  );
}

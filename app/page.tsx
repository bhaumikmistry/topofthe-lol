import { Board } from '@/components/board';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { Ticker } from '@/components/ticker';
import { formatMoney, getListings, getStats, updatedAt } from '@/lib/site-data';

// Rebuilt on every deploy and every bid refresh commit — no request-time work.
export const dynamic = 'force-static';

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div
      className={`border-b-[3px] border-r-[3px] border-border px-4 py-4 last:border-r-0 sm:border-b-0 ${
        hot ? 'bg-[var(--orange)] text-black' : ''
      }`}
    >
      <span className="block text-2xl font-extrabold tracking-[-0.04em] tabular-nums sm:text-3xl">
        {value}
      </span>
      <span className="text-[11px] uppercase leading-tight tracking-[0.04em]">{label}</span>
    </div>
  );
}

export default function Home() {
  const listings = getListings();
  const stats = getStats(listings);
  const leader = listings[0];

  return (
    <div className="flex min-h-screen flex-col">
      <Ticker listings={listings} />
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4">
          <section className="border-b-[3px] border-border py-10">
            <h1 className="text-[clamp(32px,7.6vw,62px)] font-extrabold uppercase leading-[0.94] tracking-[-0.04em]">
              Every .lol bid site,
              <br />
              <span className="mark box-decoration-clone">ranked by bid</span>
            </h1>

            <p className="mt-5 max-w-[46ch] text-sm font-medium leading-relaxed">
              Pay-to-rank boards took over the timeline. This is the index:{' '}
              {leader?.domain ? (
                <>
                  <strong className="font-extrabold">{leader.domain}</strong> is holding{' '}
                  <strong className="font-extrabold">{formatMoney(leader.topBid)}</strong>, and the
                  cheapest board on this page can still be topped for pocket change.
                </>
              ) : (
                'which board is real money and which one you can still top for pocket change.'
              )}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://github.com/bhaumikmistry/topofthe-lol/issues/new?template=add-site.yml"
                target="_blank"
                rel="noopener noreferrer"
                className="brut-btn bg-foreground px-5 py-3 text-[13px] text-background no-underline"
              >
                Add a site
              </a>
              <a
                href="https://github.com/shadcn-labs/outbid-template"
                target="_blank"
                rel="noopener noreferrer"
                className="brut-btn bg-card px-5 py-3 text-[13px] no-underline"
              >
                Build your own
              </a>
            </div>

            <div className="brut brut-shadow mt-8 grid grid-cols-2 bg-card sm:grid-cols-4">
              <Stat label="sites tracked" value={String(stats.count)} />
              <Stat label="highest bid" value={formatMoney(stats.highest)} hot />
              <Stat label="all top bids" value={formatMoney(Math.round(stats.total))} />
              <Stat
                label="last refresh"
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

          <section className="py-8">
            <h2 className="mb-4 text-[13px] font-extrabold uppercase tracking-[0.08em]">
              <span className="text-[var(--orange)]">01 /</span> The board
            </h2>
            <Board listings={listings} />
            <p className="mt-4 text-[11.5px] uppercase tracking-[0.04em] text-muted-foreground">
              A dash means the site renders its board in JavaScript and hasn&rsquo;t published a
              number we can read yet.
            </p>
          </section>
        </div>
      </main>

      <Footer count={stats.count} />
    </div>
  );
}

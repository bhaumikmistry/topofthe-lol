import { Board } from '@/components/board';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { ShareButton } from '@/components/share-button';
import { Ticker } from '@/components/ticker';
import { formatMoney, getListings, getStats, updatedAt } from '@/lib/site-data';

// Rebuilt on every deploy and every bid refresh commit — no request-time work.
export const dynamic = 'force-static';

const SITE_URL = 'https://topofthe.lol';

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
            <h1 className="text-[clamp(32px,7.6vw,62px)] font-extrabold uppercase leading-[1.12] tracking-[-0.04em]">
              Every .lol bid site,
              <br />
              <span className="mark box-decoration-clone">ranked by bid</span>
            </h1>

            <p className="mt-5 text-sm font-medium leading-relaxed">
              A market map for the .lol bidding boom. Every .lol board in one place, what the top
              spot costs on each, and who is already holding it — so you can pick the room your
              audience is actually in and buy attention where it is still cheap.
              {leader?.domain ? (
                <>
                  {' '}
                  Owning #1 runs from{' '}
                  <strong className="font-extrabold">{formatMoney(stats.cheapest)}</strong> to{' '}
                  <strong className="font-extrabold">{formatMoney(stats.highest)}</strong>, and the
                  gap between those two numbers is the whole opportunity.
                </>
              ) : null}
            </p>

            <p className="brut mt-5 border-l-[14px] border-l-[var(--orange)] bg-card px-4 py-3 text-[12px] font-bold uppercase leading-relaxed tracking-[0.02em]">
              No paid placement. You cannot buy a spot on this page, boost one, or bid your way up
              it. The only money here is the money already sitting on someone else&rsquo;s board.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://github.com/bhaumikmistry/topofthe-lol/issues/new?template=add-site.yml"
                target="_blank"
                rel="noopener noreferrer"
                className="brut-btn bg-foreground px-5 py-3 text-[13px] text-background no-underline"
              >
                Add yours
              </a>
              <ShareButton url={SITE_URL} />
              <a
                href="https://github.com/bhaumikmistry/topofthe-lol"
                target="_blank"
                rel="noopener noreferrer"
                className="brut-btn bg-card px-5 py-3 text-[13px] no-underline"
              >
                Star the repo
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
              <Stat label="cheapest #1" value={formatMoney(stats.cheapest)} />
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
            <p className="mt-4 text-[11.5px] uppercase leading-relaxed tracking-[0.04em] text-muted-foreground">
              &ldquo;Top bid&rdquo; is read from the site&rsquo;s own data. A tilde means the number
              was read off the page instead, where the figure on offer is usually the price to take
              #1 rather than the bid already sitting there. A dash means the board renders in
              JavaScript and publishes nothing we can read.
            </p>
          </section>
        </div>
      </main>

      <Footer count={stats.count} />
    </div>
  );
}

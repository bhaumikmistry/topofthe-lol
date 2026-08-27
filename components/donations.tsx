import donationsFile from '@/data/donations.json';
import { formatMoney } from '@/lib/site-data';

interface Donation {
  id: number;
  name: string;
  handle: string | null;
  amount: number;
  currency: string;
  at: string;
  position: number;
}

interface DonationData {
  url: string;
  updatedAt?: string;
  goal: number;
  raised: number;
  count: number;
  top: Donation[];
  recent: Donation[];
}

const data = donationsFile as DonationData;

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Row({ donation, rank }: { donation: Donation; rank?: number }) {
  const label = donation.handle ? `@${donation.handle}` : donation.name;
  return (
    <li className="flex items-center gap-3 border-b-[3px] border-border px-3 py-2.5 last:border-b-0">
      {rank ? (
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center text-[13px] font-extrabold tabular-nums ${
            rank === 1 ? 'bg-black text-[var(--orange)]' : 'text-muted-foreground'
          }`}
        >
          {rank}
        </span>
      ) : (
        <span className="w-6 shrink-0 text-[10px] uppercase text-muted-foreground">
          {ago(donation.at)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-bold">
        {donation.handle ? (
          <a
            href={`https://x.com/${donation.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline hover:bg-[var(--orange)] hover:text-black"
          >
            {label}
          </a>
        ) : (
          label
        )}
      </span>
      <span className="shrink-0 font-extrabold tabular-nums">{formatMoney(donation.amount)}</span>
    </li>
  );
}

/**
 * The other board. Same rules as the rest of the page — pay more, rank higher —
 * except the money buys school meals instead of a listing.
 */
export function Donations() {
  const percent = Math.min(100, Math.round((data.raised / data.goal) * 100));
  const top = data.top.slice(0, 5);
  const recent = data.recent.slice(0, 5);

  return (
    <section className="border-b-[3px] border-border pb-10">
      <h2 className="mb-4 text-[13px] font-extrabold uppercase tracking-[0.08em]">
        <span className="text-[var(--orange)]">00 /</span> The board that feeds people
      </h2>

      <div className="brut brut-shadow bg-card">
        <div className="border-b-[3px] border-border bg-[var(--orange)] px-4 py-4 text-black">
          <p className="text-[13px] font-extrabold uppercase leading-snug tracking-[0.02em]">
            Same game, different scoreboard. Outbid each other into school meals for children in
            India through Akshaya Patra.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-1">
            <span className="text-3xl font-extrabold tabular-nums">{formatMoney(data.raised)}</span>
            <span className="text-[12px] font-bold uppercase">
              of {formatMoney(data.goal)} · {data.count} {data.count === 1 ? 'donor' : 'donors'}
            </span>
          </div>
          <div className="mt-2 h-3 w-full border-[3px] border-black bg-white">
            <div className="h-full bg-black" style={{ width: `${Math.max(percent, 2)}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="border-b-[3px] border-border sm:border-b-0 sm:border-r-[3px]">
            <h3 className="border-b-[3px] border-border px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.06em]">
              Biggest donors
            </h3>
            {top.length ? (
              <ul>
                {top.map((donation, index) => (
                  <Row key={donation.id} donation={donation} rank={index + 1} />
                ))}
              </ul>
            ) : (
              <p className="px-3 py-6 text-center text-[12px] uppercase text-muted-foreground">
                Nobody yet. #1 is free.
              </p>
            )}
          </div>

          <div>
            <h3 className="border-b-[3px] border-border px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.06em]">
              Latest donors
            </h3>
            {recent.length ? (
              <ul>
                {recent.map((donation) => (
                  <Row key={donation.id} donation={donation} />
                ))}
              </ul>
            ) : (
              <p className="px-3 py-6 text-center text-[12px] uppercase text-muted-foreground">
                Nothing yet.
              </p>
            )}
          </div>
        </div>

        <div className="border-t-[3px] border-border p-3">
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="brut-btn block bg-foreground px-5 py-3 text-center text-[13px] text-background no-underline"
          >
            Take #1 on this board
          </a>
        </div>
      </div>
    </section>
  );
}

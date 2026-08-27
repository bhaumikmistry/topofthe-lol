# .lol index

A directory of pay-to-rank `.lol` bid sites, sorted by the highest bid currently sitting on each
board. Static Next.js — the whole page is prerendered, so it loads with no request-time work.

Built on top of [shadcn-labs/outbid-template](https://github.com/shadcn-labs/outbid-template)
(design system + shadcn/ui components), with the Supabase/Polar/Redis backend replaced by two
JSON files and a scraper.

## How it works

```
data/sites.json      # the list you edit — one object per site
data/candidates.json # known boards that publish no readable number, with reasons
data/excluded.json   # boards that rank by something other than money
data/owners.json     # who built each board, for credit
data/donations.json  # the school meals fundraiser, read from its public feed
scripts/refresh.mjs  # visits each site, works out its current top bid
data/bids.json    # generated output, committed to git, read at build time
app/page.tsx      # renders data/bids.json as a static page
```

`scripts/refresh.mjs` resolves each site in this order:

1. `manualBid` in `data/sites.json` — always wins.
2. The site's own JSON endpoint (`endpoint`, e.g. `/api/leaderboard`). It reads the entry list
   and picks the most bid-like numeric field (`totalCents`, `bid_cents`, `amount`, …), dividing
   by 100 for any key containing `cents`.
3. What the page says in words that #1 costs: "claim #1 for $26.00", "#1 costs $2 right now".
4. A bid-shaped key in the JSON the page ships with, as a last resort.

There is no "largest dollar figure on the page" step. It was wrong more often than right: these
layouts are full of bid-increment buttons ($5 / $25 / $100), prices quoted inside listing copy and
board-wide totals, and any of them outranks the actual bid. A board that resolves to nothing is
not listed at all.

A site that fails to resolve keeps its last known good number and is flagged `stale`, so one
bad scrape never blanks a row.

## Adding a site

Two conditions: star or fork the repo, and the board has to publish a number that can be read.
Listings are free, permanent and link back to the site.

```bash
npm run add outbid.lol
```

That appends it to `data/sites.json`, pulls its title/description, resolves the bid, and writes
`data/bids.json`. Extra flags when auto-detection needs help:

```bash
npm run add -- somesite.lol --endpoint /api/board --list listings --key bid_cents
npm run add -- somesite.lol --bid 4200        # hardcode it
```

## Refreshing bids

```bash
npm run refresh              # all sites, ~5s
npm run refresh outbid.lol   # just one
```

`.github/workflows/refresh.yml` runs the same command every 30 minutes and commits
`data/bids.json` when a number moves — which triggers a redeploy, which rebuilds the static page.
No database, no cron function, no runtime fetching.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # refreshes bids, then builds
npm run typecheck
```

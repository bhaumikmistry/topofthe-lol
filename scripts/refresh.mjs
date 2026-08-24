#!/usr/bin/env node
// Refresh every listed site's current top bid: node scripts/refresh.mjs [domain ...]
import { BIDS_FILE, SITES_FILE, mapWithConcurrency, probeSite, readJson, writeJson } from './lib.mjs';

// How long a number survives without being re-read. The refresh runs every 30
// minutes, so anything this old has been failing for a day's worth of attempts.
const STALE_LIMIT_MS = 12 * 60 * 60 * 1000;

const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));

const { sites } = await readJson(SITES_FILE, { sites: [] });
const previous = await readJson(BIDS_FILE, { results: {} });
const targets = only.length ? sites.filter((site) => only.includes(site.domain)) : sites;

if (!targets.length) {
  console.error(only.length ? `No matching sites: ${only.join(', ')}` : 'No sites in data/sites.json');
  process.exit(1);
}

const started = Date.now();
const probed = await mapWithConcurrency(targets, 8, async (site) => {
  const result = await probeSite(site);
  const before = previous.results?.[site.domain];
  // Keep the last known good number visible instead of blanking the row — but
  // only for transient failures, and only for a while. A board that has not
  // been readable for half a day has usually changed underneath us, and a
  // number nobody can re-verify is worse than no number.
  if (!result.ok && before?.ok && !result.skipped) {
    const readAt = Date.parse(before.verifiedAt ?? before.checkedAt ?? '');
    const expired = Number.isFinite(readAt) && Date.now() - readAt > STALE_LIMIT_MS;
    if (!expired) {
      return {
        ...before,
        error: result.error,
        stale: true,
        checkedAt: result.checkedAt,
        // Keep the time of the last successful read, or the clock never starts.
        verifiedAt: before.verifiedAt ?? before.checkedAt ?? result.checkedAt,
      };
    }
    return {
      ...result,
      topBid: null,
      topEntry: null,
      source: null,
      stale: false,
      error: `${result.error} (last read ${new Date(readAt).toISOString()}, dropped)`,
    };
  }
  if (result.ok && before?.ok && typeof before.topBid === 'number' && before.topBid !== result.topBid) {
    result.previousBid = before.topBid;
    result.changedAt = result.checkedAt;
  } else if (result.ok) {
    result.previousBid = before?.previousBid ?? null;
    result.changedAt = before?.changedAt ?? null;
  }
  if (result.ok) result.verifiedAt = result.checkedAt;
  return { ...result, stale: false };
});

const results = { ...(previous.results ?? {}) };
for (const result of probed) results[result.domain] = result;

// Drop readings for sites that are no longer listed, so a delisted domain
// cannot linger in the data file.
const listed = new Set(sites.map((site) => site.domain));
for (const domain of Object.keys(results)) {
  if (!listed.has(domain)) delete results[domain];
}

await writeJson(BIDS_FILE, { updatedAt: new Date().toISOString(), results });

const rows = probed
  .slice()
  .sort((a, b) => (b.topBid ?? -1) - (a.topBid ?? -1))
  .map((result) => ({
    site: result.domain,
    bid: result.topBid === null ? '—' : `$${result.topBid.toLocaleString()}`,
    holder: result.topEntry ?? '',
    via: result.stale ? 'stale' : (result.source ?? '—'),
    note: result.error ?? '',
  }));

console.table(rows);
const failed = probed.filter((result) => !result.ok || result.stale);
console.log(
  `${probed.length - failed.length}/${probed.length} refreshed in ${((Date.now() - started) / 1000).toFixed(1)}s`
);
if (failed.length) console.log(`needs attention: ${failed.map((r) => r.domain).join(', ')}`);

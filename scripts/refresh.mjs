#!/usr/bin/env node
// Refresh every listed site's current top bid: node scripts/refresh.mjs [domain ...]
import { BIDS_FILE, SITES_FILE, mapWithConcurrency, probeSite, readJson, writeJson } from './lib.mjs';

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
  // Keep the last known good number visible instead of blanking the row.
  if (!result.ok && before?.ok) {
    return { ...before, error: result.error, stale: true, checkedAt: result.checkedAt };
  }
  if (result.ok && before?.ok && typeof before.topBid === 'number' && before.topBid !== result.topBid) {
    result.previousBid = before.topBid;
    result.changedAt = result.checkedAt;
  } else if (result.ok) {
    result.previousBid = before?.previousBid ?? null;
    result.changedAt = before?.changedAt ?? null;
  }
  return { ...result, stale: false };
});

const results = { ...(previous.results ?? {}) };
for (const result of probed) results[result.domain] = result;

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

#!/usr/bin/env node
// Vet a dump of candidate domains: node scripts/discover.mjs domains.txt
//
// Keeps .lol only, drops anything already listed, and adds a site only when a
// number can actually be read off it. Everything else lands in
// data/candidates.json so a rejected domain is remembered rather than rechecked
// from scratch next time.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BIDS_FILE,
  ROOT,
  SITES_FILE,
  fetchWithTimeout,
  findEntryArray,
  getPath,
  mapWithConcurrency,
  pickBidFromEntry,
  probeSite,
  readJson,
  writeJson,
} from './lib.mjs';

const CANDIDATES_FILE = path.join(ROOT, 'data', 'candidates.json');
const ENDPOINTS = ['/api/leaderboard', '/api/board', '/api/listings', '/api/state'];

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/discover.mjs <file with one domain per line>');
  process.exit(1);
}

const raw = (await readFile(input, 'utf8'))
  .split(/[\s,]+/)
  .map((line) => line.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
  .filter(Boolean);

const sitesFile = await readJson(SITES_FILE, { sites: [] });
const listed = new Set(sitesFile.sites.map((site) => site.domain));
const excludedFile = await readJson(path.join(ROOT, 'data', 'excluded.json'), { excluded: {} });
const excluded = new Set(Object.keys(excludedFile.excluded ?? {}));

const lol = [...new Set(raw.filter((domain) => /^[a-z0-9-]+\.lol$/.test(domain)))];
const fresh = lol.filter((domain) => !listed.has(domain) && !excluded.has(domain));

console.log(
  `${raw.length} in, ${lol.length} are .lol, ${lol.length - fresh.length} already listed, ${fresh.length} to check`
);

/** Does this endpoint return a board with a bid on it? */
async function tryEndpoint(domain, endpoint) {
  const response = await fetchWithTimeout(`https://${domain}${endpoint}`, 8000);
  if (!response.ok) return null;
  if (!(response.headers?.get?.('content-type') ?? '').includes('json')) return null;
  const payload = await response.json().catch(() => null);
  if (!payload) return null;
  const list = findEntryArray(payload);
  if (!Array.isArray(list)) return null;
  if (list.length === 0) return { endpoint, empty: true };
  return list.some((entry) => pickBidFromEntry(entry) !== null) ? { endpoint } : null;
}

const checked = await mapWithConcurrency(fresh, 8, async (domain) => {
  // The page on its own first: it is one request and it settles most of them.
  const fromPage = await probeSite({ domain });
  if (fromPage.ok) return { domain, add: { domain }, result: fromPage };

  const dead = /unreachable|fetch failed|abort/i.test(fromPage.error ?? '');
  if (dead) return { domain, reason: fromPage.error ?? 'unreachable' };

  for (const endpoint of ENDPOINTS) {
    const hit = await tryEndpoint(domain, endpoint).catch(() => null);
    if (!hit) continue;
    const site = { domain, endpoint };
    const result = await probeSite(site);
    if (result.ok) return { domain, add: site, result };
  }

  return { domain, reason: fromPage.error ?? 'no readable bid' };
});

const added = checked.filter((row) => row.add);
const rejected = checked.filter((row) => !row.add);

const bids = await readJson(BIDS_FILE, { results: {} });
for (const row of added) {
  const entry = { ...row.add };
  if (row.result.meta?.description) entry.tagline = row.result.meta.description.slice(0, 160);
  sitesFile.sites.push(entry);
  bids.results[row.domain] = { ...row.result, stale: false };
}
bids.updatedAt = new Date().toISOString();

await writeJson(SITES_FILE, sitesFile);
await writeJson(BIDS_FILE, bids);

// Keep the misses. Most are parked, unbuilt, or render their board in
// JavaScript, and any of them can become listable later.
const candidates = await readJson(CANDIDATES_FILE, { candidates: {} });
const checkedAt = new Date().toISOString();
for (const row of rejected) {
  candidates.candidates[row.domain] = {
    reason: row.reason,
    checkedAt,
    checks: (candidates.candidates[row.domain]?.checks ?? 0) + 1,
  };
}
candidates.updatedAt = checkedAt;
await writeJson(CANDIDATES_FILE, candidates);

console.log(`\nadded ${added.length}:`);
for (const row of added.sort((a, b) => (b.result.topBid ?? 0) - (a.result.topBid ?? 0))) {
  console.log(`  ${row.domain} $${row.result.topBid} (${row.result.source})`);
}
console.log(`\nheld back ${rejected.length} in data/candidates.json`);

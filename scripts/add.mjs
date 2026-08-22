#!/usr/bin/env node
// Add a site and fetch its bid in one step: node scripts/add.mjs <domain> [--endpoint /api/board] [--bid 1234]
import { BIDS_FILE, SITES_FILE, probeSite, readJson, writeJson } from './lib.mjs';

const argv = process.argv.slice(2);
const domain = argv
  .find((arg) => !arg.startsWith('-') && arg.includes('.'))
  ?.replace(/^https?:\/\//, '')
  .replace(/\/.*$/, '')
  .toLowerCase();

if (!domain) {
  console.error('Usage: npm run add <domain> [-- --endpoint /api/board] [-- --bid 1234]');
  process.exit(1);
}

function flag(name) {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
}

const file = await readJson(SITES_FILE, { sites: [] });
if (file.sites.some((site) => site.domain === domain)) {
  console.error(`${domain} is already listed.`);
  process.exit(1);
}

const site = { domain };
if (flag('endpoint')) site.endpoint = flag('endpoint');
if (flag('list')) site.listPath = flag('list');
if (flag('key')) site.bidKey = flag('key');
if (flag('tagline')) site.tagline = flag('tagline');
if (flag('bid')) site.manualBid = Number(flag('bid'));

const result = await probeSite(site);
if (!site.tagline && result.meta?.description) site.tagline = result.meta.description;

file.sites.push(site);
await writeJson(SITES_FILE, file);

const bids = await readJson(BIDS_FILE, { results: {} });
bids.results[domain] = { ...result, stale: false };
bids.updatedAt = new Date().toISOString();
await writeJson(BIDS_FILE, bids);

console.log(
  result.ok
    ? `Added ${domain} — top bid $${result.topBid.toLocaleString()} (via ${result.source})`
    : `Added ${domain} — no bid found (${result.error}). Set one with: npm run add -- ${domain} --bid 100`
);

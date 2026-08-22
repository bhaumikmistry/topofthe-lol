#!/usr/bin/env node
// Add a site and fetch its bid in one step: node scripts/add.mjs <domain> [--endpoint /api/board] [--bid 1234]
import { addSite } from './lib.mjs';

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

const site = { domain };
if (flag('endpoint')) site.endpoint = flag('endpoint');
if (flag('list')) site.listPath = flag('list');
if (flag('key')) site.bidKey = flag('key');
if (flag('tagline')) site.tagline = flag('tagline');
if (flag('bid')) site.manualBid = Number(flag('bid'));

try {
  const { result } = await addSite(site);
  console.log(
    result.ok
      ? `Added ${domain} — top bid $${result.topBid.toLocaleString()} (via ${result.source})`
      : `Added ${domain} — no bid found (${result.error}). Set one with: npm run add -- ${domain} --bid 100`
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

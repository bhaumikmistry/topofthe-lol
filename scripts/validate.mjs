#!/usr/bin/env node
// Guards data/sites.json so a bad contribution fails CI instead of the build.
// Usage: node scripts/validate.mjs [--base <path-to-previous-sites.json>]
import { SITES_FILE, readJson } from './lib.mjs';

const KNOWN_KEYS = new Set([
  'domain',
  'tagline',
  'endpoint',
  'listPath',
  'valuePath',
  'bidKey',
  'nameKey',
  'nameValuePath',
  'manualBid',
  'manualEntry',
  'htmlFallback',
  'htmlKey',
  'htmlKeyCents',
  'htmlKeyIsAsk',
]);

const DOMAIN = /^(?!-)[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})*\.[a-z]{2,24}$/;

const errors = [];
const warnings = [];

const file = await readJson(SITES_FILE, null);
if (file === null) {
  console.error(`data/sites.json is missing or is not valid JSON.`);
  process.exit(1);
}
if (!Array.isArray(file.sites)) {
  console.error('data/sites.json must have a top-level "sites" array.');
  process.exit(1);
}

const seen = new Map();

file.sites.forEach((site, index) => {
  const where = `sites[${index}]`;
  if (!site || typeof site !== 'object' || Array.isArray(site)) {
    errors.push(`${where}: must be an object.`);
    return;
  }

  const domain = site.domain;
  if (typeof domain !== 'string' || !DOMAIN.test(domain)) {
    errors.push(`${where}: "domain" must be a bare lowercase hostname, e.g. "outbid.lol" (got ${JSON.stringify(domain)}).`);
    return;
  }
  if (seen.has(domain)) {
    errors.push(`${where}: duplicate of sites[${seen.get(domain)}] — ${domain} is already listed.`);
    return;
  }
  seen.set(domain, index);

  for (const key of Object.keys(site)) {
    if (!KNOWN_KEYS.has(key)) {
      errors.push(`${domain}: unknown field "${key}". Allowed: ${[...KNOWN_KEYS].join(', ')}.`);
    }
  }

  for (const key of ['tagline', 'endpoint', 'listPath', 'valuePath', 'bidKey', 'nameKey', 'nameValuePath', 'manualEntry', 'htmlKey']) {
    if (key in site && typeof site[key] !== 'string') {
      errors.push(`${domain}: "${key}" must be a string.`);
    }
  }

  if ('endpoint' in site && typeof site.endpoint === 'string' && !site.endpoint.startsWith('/')) {
    errors.push(`${domain}: "endpoint" must be a path on the site, starting with "/" (got "${site.endpoint}").`);
  }

  for (const key of ['htmlFallback', 'htmlKeyCents', 'htmlKeyIsAsk']) {
    if (key in site && typeof site[key] !== 'boolean') {
      errors.push(`${domain}: "${key}" must be true or false.`);
    }
  }

  if ('manualBid' in site) {
    const value = site.manualBid;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      errors.push(`${domain}: "manualBid" must be a non-negative number.`);
    } else if (value > 5_000_000) {
      errors.push(`${domain}: "manualBid" of ${value} is implausible — cap is 5,000,000.`);
    }
  }

  if ('tagline' in site && typeof site.tagline === 'string' && site.tagline.length > 200) {
    warnings.push(`${domain}: tagline is ${site.tagline.length} chars and will be truncated in the UI.`);
  }

  if (site.valuePath && site.listPath) {
    warnings.push(`${domain}: both "valuePath" and "listPath" set — "valuePath" wins.`);
  }
  if ((site.listPath || site.bidKey || site.valuePath) && !site.endpoint) {
    warnings.push(`${domain}: "listPath"/"bidKey"/"valuePath" do nothing without "endpoint".`);
  }
});

for (const warning of warnings) console.log(`warn  ${warning}`);
for (const error of errors) console.error(`error ${error}`);

if (errors.length) {
  console.error(`\n${errors.length} problem(s) in data/sites.json. Nothing was changed.`);
  process.exit(1);
}
console.log(`ok — ${file.sites.length} sites, no problems.`);

// --base lets CI report which domains a pull request adds.
const baseIndex = process.argv.indexOf('--base');
if (baseIndex !== -1 && process.argv[baseIndex + 1]) {
  const base = await readJson(process.argv[baseIndex + 1], { sites: [] });
  const before = new Set((base.sites ?? []).map((site) => site.domain));
  const added = [...seen.keys()].filter((domain) => !before.has(domain));
  console.log(`added:${added.join(',')}`);
}

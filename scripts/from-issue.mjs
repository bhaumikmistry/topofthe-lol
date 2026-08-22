#!/usr/bin/env node
// Turns an "Add a site" issue-form body (env ISSUE_BODY) into a data/sites.json
// entry. Every field is treated as hostile input: the domain must match a strict
// pattern and the optional fields are clamped before they are written anywhere.
import { SITES_FILE, addSite, readJson } from './lib.mjs';

const body = process.env.ISSUE_BODY ?? '';

/** Issue forms render as "### Label\n\nvalue" blocks. */
const blocks = new Map(
  body
    .split(/^###[ \t]+/m)
    .slice(1)
    .map((block) => {
      const newline = block.indexOf('\n');
      const label = (newline === -1 ? block : block.slice(0, newline)).trim().toLowerCase();
      const value = newline === -1 ? '' : block.slice(newline + 1).trim();
      return [label, value];
    })
);

function field(label) {
  const raw = blocks.get(label.toLowerCase());
  if (!raw || /^_no response_$/i.test(raw)) return null;
  return raw.split('\n')[0].trim();
}

const DOMAIN = /^(?!-)[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})*\.[a-z]{2,24}$/;

const domain = (field('Domain') ?? '')
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .replace(/\/.*$/, '')
  .trim();

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!DOMAIN.test(domain)) {
  fail(`"${domain || '(empty)'}" is not a valid bare hostname. Example: outbid.lol`);
}

const { sites } = await readJson(SITES_FILE, { sites: [] });
if (sites.some((site) => site.domain === domain)) {
  fail(`${domain} is already listed.`);
}

const site = { domain };

const endpoint = field('JSON endpoint (optional)');
if (endpoint) {
  if (!/^\/[a-z0-9/_.-]{0,120}$/i.test(endpoint)) {
    fail(`"${endpoint}" is not a valid path. It must start with "/", e.g. /api/leaderboard`);
  }
  site.endpoint = endpoint;
}

const tagline = field('One-line description (optional)');
if (tagline) site.tagline = tagline.replace(/[\r\n<>]+/g, ' ').slice(0, 160);

const { result } = await addSite(site).catch((error) => fail(error.message));

// Read by the workflow to name the branch and write the pull request body.
const summary = result.ok
  ? `resolved a top bid of $${result.topBid.toLocaleString()} via ${result.source}`
  : `could not resolve a bid automatically (${result.error}) — it will show as \u2014 until someone sets one`;

console.log(`domain=${domain}`);
console.log(`summary=${summary}`);

#!/usr/bin/env node
// outbidstory.lol keeps a public roll call of the wave: each board card links to
// the site and then to whoever built it. This reads those pairs and fills in
// owners we could not learn from a board's own pages.
import path from 'node:path';
import { ROOT, SITES_FILE, fetchWithTimeout, readJson, writeJson } from './lib.mjs';

const OWNERS_FILE = path.join(ROOT, 'data', 'owners.json');
const SOURCE = 'https://outbidstory.lol';
const SKIP = new Set(['outbidstory.lol', 'pixelcave.com', 'x.com', 'twitter.com', 'github.com', 'vercel.com']);

const response = await fetchWithTimeout(SOURCE, 20000);
if (!response.ok) {
  console.error(`Could not read ${SOURCE}: HTTP ${response.status}`);
  process.exit(1);
}
const html = await response.text();

// Walk outbound links in document order. A site link followed closely by a
// profile link is one card, so the two belong together.
const pairs = new Map();
let pending = null;
for (const match of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
  const url = match[1];
  const profile = url.match(/^https?:\/\/(?:www\.)?x\.com\/([A-Za-z0-9_]{1,15})\/?$/);
  if (profile) {
    if (pending && match.index - pending.at < 3000 && !pairs.has(pending.domain)) {
      pairs.set(pending.domain, profile[1]);
    }
    continue;
  }
  const site = url.match(/^https?:\/\/(?:www\.)?([a-z0-9.-]+\.[a-z]{2,10})/i);
  if (site && !SKIP.has(site[1].toLowerCase())) {
    pending = { at: match.index, domain: site[1].toLowerCase() };
  }
}

const { sites } = await readJson(SITES_FILE, { sites: [] });
const listed = new Set(sites.map((site) => site.domain));
const owners = await readJson(OWNERS_FILE, { owners: {} });

let added = 0;
for (const [domain, handle] of pairs) {
  if (!listed.has(domain)) continue;
  const existing = owners.owners[domain] ?? {};
  if (existing.handle) continue;
  owners.owners[domain] = { ...existing, handle, via: 'outbidstory.lol roll call' };
  added += 1;
}
owners.updatedAt = new Date().toISOString();
await writeJson(OWNERS_FILE, owners);

const known = Object.values(owners.owners).filter((owner) => owner.handle).length;
console.log(`${pairs.size} pairs on the roll call, ${added} new for boards we list, ${known} of ${listed.size} known.`);

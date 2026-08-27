#!/usr/bin/env node
// Enrich data/owners.json from each board's own /about and /rules pages: the
// handle it credits, what the board is for, and what it charges. Everything
// here is published on the site itself.
import path from 'node:path';
import {
  ROOT,
  SITES_FILE,
  extractMeta,
  fetchWithTimeout,
  mapWithConcurrency,
  readJson,
  toText,
  writeJson,
} from './lib.mjs';

const OWNERS_FILE = path.join(ROOT, 'data', 'owners.json');
const PAGES = ['/about', '/rules', '/'];

const IGNORE = new Set([
  'x', 'twitter', 'intent', 'share', 'home', 'i', 'search', 'hashtag', 'compose',
  'explore', 'notifications', 'messages', 'settings', 'login', 'signup', 'privacy',
  'tos', 'about', 'vercel', 'nextjs', 'shadcn', 'stripe', 'polar_sh', 'supabase',
  'you', 'yourhandle', 'username', 'handle', 'jonathan_wilke',
]);

function cleanHandle(value) {
  const handle = String(value ?? '').replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
  if (!handle || handle.length > 15 || IGNORE.has(handle.toLowerCase())) return null;
  return handle;
}

const { sites } = await readJson(SITES_FILE, { sites: [] });
const owners = await readJson(OWNERS_FILE, { owners: {} });
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const targets = only.length ? sites.filter((site) => only.includes(site.domain)) : sites;

const found = await mapWithConcurrency(targets, 8, async (site) => {
  const details = { domain: site.domain, handle: null, email: null, about: null, credit: null };

  for (const page of PAGES) {
    let html;
    try {
      const response = await fetchWithTimeout(`https://${site.domain}${page}`, 10000);
      if (!response.ok) continue;
      html = await response.text();
    } catch {
      continue;
    }
    const text = toText(html);

    if (!details.handle) {
      details.handle =
        cleanHandle(html.match(/<meta[^>]+name=["']twitter:creator["'][^>]+content=["']@?([A-Za-z0-9_]{1,15})["']/i)?.[1]) ??
        cleanHandle(text.match(/\b(?:built|made|created|shipped|designed|run)\s+by\s+@([A-Za-z0-9_]{1,15})/i)?.[1]);
    }

    // A contact address the site publishes for people to write to.
    if (!details.email) {
      const address = html.match(/mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i)?.[1];
      if (address && !/example\.|sentry|@2x|\.png|\.jpg/i.test(address)) details.email = address.toLowerCase();
    }

    // What the board says it is, in its own words. Useful for writing to them.
    if (!details.about && (page === '/about' || page === '/rules')) {
      const body = text.replace(/^\s*[^.]{0,60}?(?=[A-Z])/, '').trim();
      if (body.length > 60) details.about = body.slice(0, 400);
    }
    if (!details.credit) {
      const credit = text.match(/\b(?:built|made|created)\s+by\s+([A-Za-z][A-Za-z .'-]{2,30})/i)?.[1];
      if (credit) details.credit = credit.trim();
    }
    if (page === '/' && !details.about) {
      const meta = extractMeta(html);
      if (meta.description) details.about = meta.description;
    }
  }

  return details;
});

let touched = 0;
for (const row of found) {
  const existing = owners.owners[row.domain] ?? {};
  const merged = { ...existing };
  if (row.handle && !merged.handle) {
    merged.handle = row.handle;
    merged.via = 'about page';
  }
  if (row.email && !merged.email) merged.email = row.email;
  if (row.about && !merged.about) merged.about = row.about;
  if (row.credit && !merged.name) merged.name = row.credit;
  if (Object.keys(merged).length) {
    if (JSON.stringify(merged) !== JSON.stringify(existing)) touched += 1;
    owners.owners[row.domain] = merged;
  }
}
owners.updatedAt = new Date().toISOString();
await writeJson(OWNERS_FILE, owners);

const withHandle = Object.values(owners.owners).filter((o) => o.handle).length;
const withEmail = Object.values(owners.owners).filter((o) => o.email).length;
console.log(`${touched} entries updated. ${withHandle} boards have a handle, ${withEmail} publish an address.`);

#!/usr/bin/env node
// Find who built each listed board, from what the board itself publishes:
// a twitter:creator tag, a link to x.com, or a "built by @someone" line.
// Writes data/owners.json. Nothing here is guessed — a handle is recorded only
// when it appears on that site's own page.
import path from 'node:path';
import { ROOT, SITES_FILE, fetchWithTimeout, mapWithConcurrency, readJson, toText, writeJson } from './lib.mjs';

const OWNERS_FILE = path.join(ROOT, 'data', 'owners.json');

// Handles that belong to the platform or to a shared template, not an owner.
const IGNORE = new Set([
  'x', 'twitter', 'intent', 'share', 'home', 'i', 'search', 'hashtag', 'compose',
  'explore', 'notifications', 'messages', 'settings', 'login', 'signup', 'privacy',
  'tos', 'about', 'vercel', 'nextjs', 'shadcn', 'stripe', 'polar_sh', 'supabase',
  'you', 'yourhandle', 'username', 'handle',
]);

const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const { sites } = await readJson(SITES_FILE, { sites: [] });
const targets = only.length ? sites.filter((site) => only.includes(site.domain)) : sites;

function clean(handle) {
  const value = handle.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
  if (!value || value.length > 15 || IGNORE.has(value.toLowerCase())) return null;
  return value;
}

const found = await mapWithConcurrency(targets, 8, async (site) => {
  try {
    const response = await fetchWithTimeout(`https://${site.domain}`, 12000);
    const html = await response.text();
    const text = toText(html);

    // Strongest first: the site declaring its own author.
    const creator =
      html.match(/<meta[^>]+name=["']twitter:creator["'][^>]+content=["']@?([A-Za-z0-9_]{1,15})["']/i)?.[1] ??
      html.match(/<meta[^>]+name=["']author["'][^>]+content=["']@([A-Za-z0-9_]{1,15})["']/i)?.[1];
    if (creator && clean(creator)) return { domain: site.domain, handle: clean(creator), via: 'twitter:creator' };

    // "Built by @someone", "made by @someone", "a thing by @someone".
    const credit = text.match(/\b(?:built|made|created|shipped|designed)\s+by\s+@([A-Za-z0-9_]{1,15})/i)?.[1];
    if (credit && clean(credit)) return { domain: site.domain, handle: clean(credit), via: 'credit line' };

    // A link to a profile, provided the page links to exactly one.
    const profiles = new Set(
      [...html.matchAll(/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:[/?"']|$)/gi)]
        .map((match) => clean(match[1]))
        .filter(Boolean)
    );
    if (profiles.size === 1) return { domain: site.domain, handle: [...profiles][0], via: 'profile link' };
    if (profiles.size > 1) {
      // A credit line near the end of the page is usually the builder.
      const footer = text.slice(-1200);
      const inFooter = [...profiles].filter((handle) => footer.includes(handle));
      if (inFooter.length === 1) return { domain: site.domain, handle: inFooter[0], via: 'footer link' };
    }
    return { domain: site.domain, handle: null, via: null };
  } catch (error) {
    return { domain: site.domain, handle: null, via: null, error: error.message };
  }
});

// A handle linked from several different boards is the template's author being
// credited ("inspired by outbid.lol"), not the owner of each one. Only keep
// those where the site names them as its own author.
const linkCounts = new Map();
for (const row of found) {
  if (!row.handle || row.via === 'twitter:creator' || row.via === 'credit line') continue;
  linkCounts.set(row.handle, (linkCounts.get(row.handle) ?? 0) + 1);
}
for (const row of found) {
  if (row.handle && (linkCounts.get(row.handle) ?? 0) > 2) {
    row.handle = null;
    row.via = null;
  }
}

const owners = await readJson(OWNERS_FILE, { owners: {} });
let added = 0;
for (const row of found) {
  if (!row.handle) continue;
  if (owners.owners[row.domain]?.handle !== row.handle) added += 1;
  owners.owners[row.domain] = { handle: row.handle, via: row.via };
}
owners.updatedAt = new Date().toISOString();
await writeJson(OWNERS_FILE, owners);

const hits = found.filter((row) => row.handle);
console.log(`${hits.length} of ${found.length} boards name someone (${added} new)`);
for (const row of hits.sort((a, b) => a.domain.localeCompare(b.domain))) {
  console.log(`  ${row.domain} @${row.handle} (${row.via})`);
}

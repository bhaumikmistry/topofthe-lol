import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SITES_FILE = path.join(ROOT, 'data', 'sites.json');
export const BIDS_FILE = path.join(ROOT, 'data', 'bids.json');

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 lol-index/1.0';

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJson(file, value) {
  await writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

export async function fetchWithTimeout(url, ms = 12000, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      redirect: 'follow',
      ...init,
      headers: { 'user-agent': UA, accept: '*/*', ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function getPath(object, dotted) {
  return dotted
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), object);
}

const BID_KEY_PATTERN = /(cents|bid|amount|price|total|value|paid|banked|alltime|all_time)/i;
const BID_KEY_DENYLIST =
  /(rank|position|clicks?|count|id$|_id|createdat|updatedat|created_at|updated_at|hours|week$|timestamp|_ms$|floor)/i;

function isCentsKey(key) {
  return /cents/i.test(key);
}

/** Pick the most bid-like numeric field from a leaderboard entry. */
export function pickBidFromEntry(entry, explicitKey) {
  if (explicitKey) {
    const raw = entry?.[explicitKey];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return isCentsKey(explicitKey) ? raw / 100 : raw;
    }
    return null;
  }
  let best = null;
  for (const [key, raw] of Object.entries(entry ?? {})) {
    const value = typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
    if (BID_KEY_DENYLIST.test(key) || !BID_KEY_PATTERN.test(key)) continue;
    const dollars = isCentsKey(key) ? value / 100 : value;
    if (best === null || dollars > best) best = dollars;
  }
  return best;
}

const NAME_KEYS = [
  'displayName',
  'display_name',
  'title',
  'name',
  'company',
  'owner_name',
  'host',
  'domain',
  'url',
  'key',
  'identifier',
  'username',
  'slug',
];

export function pickNameFromEntry(entry, explicitKey) {
  const keys = explicitKey ? [explicitKey, ...NAME_KEYS] : NAME_KEYS;
  for (const key of keys) {
    const value = entry?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 80);
  }
  return null;
}

/** Find the first array of objects in a JSON payload — used when listPath is absent. */
export function findEntryArray(payload) {
  if (Array.isArray(payload)) return payload;
  const queue = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object') continue;
    for (const value of Object.values(node)) {
      if (Array.isArray(value) && value.length && typeof value[0] === 'object') return value;
      if (value && typeof value === 'object') queue.push(value);
    }
  }
  return null;
}

const MONEY = /\$\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.([0-9]{2}))?/g;
const MAX_PLAUSIBLE_BID = 5_000_000;

/**
 * Fallback for sites with no JSON API. Returns every plausible dollar amount in
 * document order, so callers can use both the largest (the #1 bid) and the
 * first (the top row, since these boards render highest-first).
 */
export function dollarAmounts(html) {
  const amounts = [];
  for (const match of html.matchAll(MONEY)) {
    const value = Number(`${match[1].replace(/,/g, '')}.${match[2] ?? '0'}`);
    if (!Number.isFinite(value) || value > MAX_PLAUSIBLE_BID) continue;
    amounts.push(value);
  }
  return amounts;
}

// "Claim this listing for $14,019", "Take the top spot — $250", "Outbid for $12".
const CLAIM = /\b(claim|take[\s-]?(?:the|this|over)?|outbid|overbid|beat|dethrone|steal|buy|own|bid)\b[^$<]{0,60}\$\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.([0-9]{2}))?/gi;

/** The price the site is asking to take the #1 spot, when it advertises one. */
export function claimPrice(html) {
  let best = null;
  for (const match of html.matchAll(CLAIM)) {
    const value = Number(`${match[2].replace(/,/g, '')}.${match[3] ?? '0'}`);
    if (!Number.isFinite(value) || value > MAX_PLAUSIBLE_BID) continue;
    if (best === null || value > best) best = value;
  }
  return best;
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ');
}

export function extractMeta(html) {
  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ??
    null;
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    null;
  return {
    title: title ? decodeEntities(title).trim().slice(0, 120) : null,
    description: description ? decodeEntities(description).trim().slice(0, 200) : null,
  };
}

/** Resolve one site to { topBid, topEntry, meta, ... }. Never throws. */
export async function probeSite(site) {
  const base = `https://${site.domain}`;
  const result = {
    domain: site.domain,
    topBid: null,
    topEntry: null,
    source: null,
    claimPrice: null,
    nextBid: null,
    ok: false,
    error: null,
    meta: {},
    checkedAt: new Date().toISOString(),
  };

  if (typeof site.manualBid === 'number') {
    result.topBid = site.manualBid;
    result.topEntry = site.manualEntry ?? null;
    result.source = 'manual';
    result.ok = true;
  }

  if (!result.ok && site.endpoint) {
    try {
      const response = await fetchWithTimeout(base + site.endpoint);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();

      if (site.valuePath) {
        const raw = getPath(payload, site.valuePath);
        if (typeof raw === 'number') {
          result.topBid = /cents/i.test(site.valuePath) ? raw / 100 : raw;
          result.topEntry = site.nameValuePath
            ? (getPath(payload, site.nameValuePath) ?? null)
            : null;
          result.source = 'api';
          result.ok = true;
        }
      } else {
        const list = site.listPath ? getPath(payload, site.listPath) : findEntryArray(payload);
        if (Array.isArray(list) && list.length) {
          let top = null;
          for (const entry of list) {
            const bid = pickBidFromEntry(entry, site.bidKey);
            if (bid === null) continue;
            if (!top || bid > top.bid) top = { bid, entry };
          }
          if (top) {
            result.topBid = top.bid;
            result.topEntry = pickNameFromEntry(top.entry, site.nameKey);
            result.source = 'api';
            result.ok = true;
          }
        }
      }
      if (!result.ok) result.error = 'api returned no bid-like value';
    } catch (error) {
      result.error = `api: ${error.message}`;
    }
  }

  // Always load the homepage: it supplies title/description, and the $-scan
  // fallback for sites that render their board without a JSON endpoint.
  try {
    const response = await fetchWithTimeout(base);
    const html = await response.text();
    result.meta = extractMeta(html);
    result.claimPrice = claimPrice(html);
    if (!result.ok) {
      const amounts = dollarAmounts(html);
      if (amounts.length) {
        // These boards render highest-first, so the first amount is normally the
        // #1 bid; fall back to the largest when the markup order says otherwise.
        const largest = Math.max(...amounts);
        result.topBid = amounts[0] === largest ? amounts[0] : largest;
        result.source = 'html';
        result.ok = true;
        result.error = null;
      } else if (!result.error) {
        result.error = 'no dollar amount found in html';
      }
    }
    // A "claim for $X" price above the parsed bid means the board is asking more
    // than the number we scraped — surface it rather than silently disagreeing.
    if (result.ok && result.claimPrice !== null && result.topBid !== null) {
      result.nextBid = result.claimPrice > result.topBid ? result.claimPrice : null;
    }
  } catch (error) {
    if (!result.error) result.error = `html: ${error.message}`;
  }

  return result;
}

export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Append a site and resolve its bid in one step. Shared by `npm run add` and the
 * issue-to-pull-request bot so both take exactly the same path.
 */
export async function addSite(site) {
  const file = await readJson(SITES_FILE, { sites: [] });
  if (file.sites.some((existing) => existing.domain === site.domain)) {
    throw new Error(`${site.domain} is already listed.`);
  }

  const result = await probeSite(site);
  const entry = { ...site };
  if (!entry.tagline && result.meta?.description) entry.tagline = result.meta.description;

  file.sites.push(entry);
  await writeJson(SITES_FILE, file);

  const bids = await readJson(BIDS_FILE, { results: {} });
  bids.results[site.domain] = { ...result, stale: false };
  bids.updatedAt = new Date().toISOString();
  await writeJson(BIDS_FILE, bids);

  return { entry, result };
}

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

// Nothing on these boards is a seven-figure bid; anything larger is a
// timestamp, a click total or a number of satoshis.
const MAX_PLAUSIBLE_BID = 100_000;

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
      const value = isCentsKey(explicitKey) ? raw / 100 : raw;
      return value > MAX_PLAUSIBLE_BID ? null : value;
    }
    return null;
  }
  let best = null;
  for (const [key, raw] of Object.entries(entry ?? {})) {
    const value = typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
    if (BID_KEY_DENYLIST.test(key) || !BID_KEY_PATTERN.test(key)) continue;
    const dollars = isCentsKey(key) ? value / 100 : value;
    // Epoch timestamps and click totals sail through key matching; nothing on
    // these boards is a seven-figure bid.
    if (dollars > MAX_PLAUSIBLE_BID) continue;
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

/**
 * Many of these boards ship their data inside the page as escaped JSON (a
 * Next.js flight payload, a hydration blob). Reading a known key out of it is
 * exact, unlike scanning for dollar signs.
 */
export function embeddedKeyValue(html, key, cents) {
  const unescaped = html.replace(/\\"/g, '"');
  const pattern = new RegExp(`"${key}"\\s*:\\s*"?(\\d+(?:\\.\\d+)?)"?`, 'g');
  let best = null;
  for (const match of unescaped.matchAll(pattern)) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    if (best === null || value > best) best = value;
  }
  if (best === null) return null;
  return cents ?? /cents/i.test(key) ? best / 100 : best;
}

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

// Anchored to the top spot on purpose: "claim #1 for $26.00", "Take #1 · $22",
// "#1 costs $16". A looser pattern matches the bid-increment buttons these
// boards are covered in (+$5 / +$25 / +$100) and reports the biggest button.
// One pattern, deliberately strict: an explicit call to take the top spot,
// with the price right there. Looser variants matched listing rows ("at #1 ·
// $3,600") and every bid-increment button on the page.
const CLAIM_PATTERNS = [
  /(?:claim|take|beat|outbid|overbid|dethrone|steal|own)\s+(?:the\s+)?#\s?1\s*(?:spot\s*)?(?:for|at|costs?|·|-|—)?\s*\$\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.([0-9]{2}))?/gi,
  // "#1 costs $2 right now", "#1 is $16"
  /#\s?1\s+(?:costs?|is|for|at)\s+\$\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.([0-9]{2}))?/gi,
];

/** Markup between words breaks the anchored patterns, so match on text. */
export function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

/** The price the site is asking for #1, when it says so in as many words. */
export function claimPrice(html) {
  for (const pattern of CLAIM_PATTERNS) {
    let best = null;
    for (const match of html.matchAll(pattern)) {
      const value = Number(`${match[1].replace(/,/g, '')}.${match[2] ?? '0'}`);
      if (!Number.isFinite(value) || value > MAX_PLAUSIBLE_BID) continue;
      if (best === null || value > best) best = value;
    }
    if (best !== null) return best;
  }
  return null;
}

// Keys specific enough to be a bid. Deliberately narrow: "total", "paid" and
// "price" all show up as board-wide aggregates or shop prices.
const EMBEDDED_BID_KEY = /^(bid|bid_?amount|bid_?cents|amount|amount_?cents|current_?bid|top_?bid|highest_?bid|highest_?bid_?cents|bidAmount|bidCents|amountCents|currentBid|topBid|highestBid)$/i;

/** Is this dollar figure actually printed on the page? */
export function shownOnPage(text, value) {
  const whole = Math.round(value);
  const forms = new Set([
    `$${value}`,
    `$${whole}`,
    `$${whole.toLocaleString('en-US')}`,
    `$${value.toFixed(2)}`,
    `$${whole.toLocaleString('en-US')}.00`,
  ]);
  return [...forms].some((form) => text.includes(form));
}

/** Largest bid-shaped number in the JSON embedded in the page. */
export function embeddedBid(html) {
  const unescaped = html.replace(/\\"/g, '"');
  let best = null;
  for (const match of unescaped.matchAll(/"([A-Za-z_]{2,24})"\s*:\s*"?(\d+(?:\.\d+)?)"?/g)) {
    const key = match[1];
    if (!EMBEDDED_BID_KEY.test(key)) continue;
    const raw = Number(match[2]);
    if (!Number.isFinite(raw)) continue;
    const value = /cents/i.test(key) ? raw / 100 : raw;
    if (value > MAX_PLAUSIBLE_BID) continue;
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
    skipped: false,
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
        const scaled = typeof raw === 'number' ? (/cents/i.test(site.valuePath) ? raw / 100 : raw) : null;
        if (scaled !== null && scaled <= MAX_PLAUSIBLE_BID) {
          result.topBid = scaled;
          result.topEntry = site.nameValuePath
            ? (getPath(payload, site.nameValuePath) ?? null)
            : null;
          result.source = 'api';
          result.ok = true;
        }
      } else {
        const list = site.listPath ? getPath(payload, site.listPath) : findEntryArray(payload);
        // A working endpoint returning no entries means the board is empty, not
        // that the read failed. Without this the HTML fallback picks up the
        // site's minimum-bid copy and reports it as a standing bid.
        if (Array.isArray(list) && list.length === 0) {
          result.topBid = 0;
          result.topEntry = null;
          result.source = 'api';
          result.ok = true;
        } else if (Array.isArray(list) && list.length) {
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
    // A site that is down or paused is a transient failure: keep whatever was
    // last read rather than dropping the row to a dash.
    const reachable = response.ok !== false && response.status < 400 && !/DEPLOYMENT_PAUSED|DEPLOYMENT_NOT_FOUND/i.test(html);
    result.meta = extractMeta(html);
    const text = toText(html);
    result.claimPrice = claimPrice(text);

    // Resolution order for a page, most trustworthy first.
    // 1. A key this site was configured with.
    if (!result.ok && site.htmlKey) {
      const value = embeddedKeyValue(html, site.htmlKey, site.htmlKeyCents);
      if (value !== null) {
        result.topBid = value;
        result.source = 'embedded';
        result.ok = true;
        result.error = null;
      }
    }

    if (site.htmlFallback === false) {
      if (!result.ok) {
        // Deliberate, not a hiccup — so the previous number must not be kept.
        result.skipped = true;
        result.error = result.error ?? 'reading this page is switched off';
      }
    } else {
      // 2. What the board says, in words, that #1 costs. A sentence beats a
      // key guessed out of the page's JSON, which is as likely to be a running
      // total or a fundraising goal as a bid.
      if (!result.ok && result.claimPrice !== null) {
        result.topBid = result.claimPrice;
        result.source = 'claim';
        result.ok = true;
        result.error = null;
      }

      // 3. Failing that, a bid-shaped key in the JSON the page ships with.
      if (!result.ok) {
        let embedded = embeddedBid(html);
        // A key called "amount" or "bid" may hold cents or dollars and the name
        // does not say which. The page itself settles it: whichever reading is
        // printed on it is the right one.
        if (embedded !== null && embedded >= 100 && !shownOnPage(text, embedded) && shownOnPage(text, embedded / 100)) {
          embedded = embedded / 100;
        }
        if (embedded !== null) {
          result.topBid = embedded;
          result.source = 'embedded';
          result.ok = true;
          result.error = null;
        }
      }

      // There is no "largest dollar figure on the page" step any more. It was
      // wrong more often than right: bid-increment buttons, prices quoted in
      // listing copy and board-wide totals all outrank the actual bid. A board
      // that gets this far shows no number until someone wires its endpoint.
      if (!result.ok) {
        result.skipped = reachable;
        result.error = reachable
          ? 'nothing readable: no endpoint, no bid key, no "claim #1 for $X"'
          : `site unreachable (HTTP ${response.status})`;
      }
    }

    // The board saying "#1 costs $2" while the number we read is $100 means the
    // read is wrong: it found a running total, a goal, or a row that is not the
    // top one. Trust the sentence.
    if (result.ok && result.claimPrice !== null && result.topBid !== null && result.topBid > result.claimPrice * 5) {
      result.topBid = result.claimPrice;
      result.source = 'claim';
    }

    // A claim price above the number we read is normal: it is the bid plus the
    // increment. Keep it alongside rather than overwriting.
    if (result.ok && result.claimPrice !== null && result.topBid !== null) {
      result.nextBid = result.claimPrice > result.topBid ? result.claimPrice : null;
    }

    // Scraped dollar signs cannot tell a bid apart from the price to beat it,
    // and on these boards the largest number on the page is usually the latter.
    // Say so rather than presenting a guess as a reading.
    result.exact =
      (result.source === 'api' || result.source === 'embedded' || result.source === 'manual') &&
      // Some pages only publish the ask. It is exact, but it is not the bid.
      site.htmlKeyIsAsk !== true;
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

#!/usr/bin/env node
// Read the charity fundraiser's public donation feed and write data/donations.json.
// Two orderings are kept: the largest gifts, and the most recent ones.
import path from 'node:path';
import { ROOT, fetchWithTimeout, readJson, writeJson } from './lib.mjs';

const DONATIONS_FILE = path.join(ROOT, 'data', 'donations.json');
const SLUG = 'outbidlol-but-for-donation-to-akshaya-patras-mission';
const FEED = `https://gateway.gofundme.com/web-gateway/v1/feed/${SLUG}/donations`;
const GOAL = 5000;

async function feed(sort) {
  const response = await fetchWithTimeout(`${FEED}?limit=100&offset=0&sort=${sort}`, 15000);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return payload?.references?.donations ?? [];
}

/** Donors often sign with their handle, e.g. "@someone Name". */
function handleFrom(name) {
  const match = String(name ?? '').match(/@([A-Za-z0-9_]{1,15})\b/);
  return match ? match[1] : null;
}

function tidy(donation, index) {
  const name = donation.is_anonymous ? 'Anonymous' : (donation.name ?? 'Anonymous').trim();
  return {
    id: donation.donation_id,
    name: name.replace(/^@[A-Za-z0-9_]{1,15}\s*/, '').trim() || name,
    handle: donation.is_anonymous ? null : handleFrom(donation.name),
    amount: Number(donation.amount) || 0,
    currency: donation.currencycode ?? 'USD',
    at: donation.created_at,
    position: index + 1,
  };
}

const previous = await readJson(DONATIONS_FILE, { donations: {} });

try {
  const [top, recent] = await Promise.all([feed('top'), feed('recent')]);
  const all = new Map();
  for (const donation of [...top, ...recent]) all.set(donation.donation_id, donation);

  const raised = [...all.values()].reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  await writeJson(DONATIONS_FILE, {
    $comment: 'Public donation feed for the Akshaya Patra fundraiser. Rewritten by scripts/donations.mjs.',
    url: `https://www.gofundme.com/f/${SLUG}`,
    updatedAt: new Date().toISOString(),
    goal: GOAL,
    raised,
    count: all.size,
    top: top.map(tidy),
    recent: recent.map(tidy),
  });

  console.log(`$${raised} from ${all.size} donors, ${Math.round((raised / GOAL) * 100)}% of $${GOAL}`);
  for (const donation of top.slice(0, 5).map(tidy)) {
    console.log(`  ${donation.position}. ${donation.name}${donation.handle ? ` @${donation.handle}` : ''} $${donation.amount}`);
  }
} catch (error) {
  // The board should never go blank because the fundraiser feed hiccuped.
  console.error(`Could not read the donation feed: ${error.message}`);
  if (previous.updatedAt) {
    console.error('Keeping the previous figures.');
    process.exit(0);
  }
  process.exit(1);
}

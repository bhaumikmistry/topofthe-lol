# Adding a site

Three ways, easiest first. All of them end in the same place: one object in `data/sites.json`.

## 1. Open an issue (no git needed)

[Add a site →](https://github.com/bhaumikmistry/topofthe-lol/issues/new?template=add-site.yml)

Type the domain, submit. A bot reads the site's current top bid and opens the pull request for
you. If it can't read a bid, it says so in a comment instead of failing silently.

## 2. Edit the file in the browser

[Edit `data/sites.json` →](https://github.com/bhaumikmistry/topofthe-lol/edit/main/data/sites.json)

Add one line to the `sites` array and GitHub walks you through opening the pull request:

```json
{ "domain": "yoursite.lol", "tagline": "What it is" }
```

That's the whole minimum entry. CI resolves the bid and reports the number it found on your
pull request's summary.

## 3. Locally

```bash
npm install
npm run add yoursite.lol    # appends to data/sites.json and resolves the bid
npm run validate            # same check CI runs
```

## Optional fields

Only needed when the automatic detection gets it wrong.

| Field | What it does |
| --- | --- |
| `endpoint` | Path to the site's own JSON board, e.g. `/api/leaderboard`. Faster and exact. |
| `listPath` | Dotted path to the entry array inside that JSON, e.g. `listings`. |
| `bidKey` | Which field on an entry is the bid, e.g. `bid_cents`. Keys containing `cents` are divided by 100. |
| `nameKey` | Which field holds the #1 holder's name, e.g. `displayName`. |
| `valuePath` | Dotted path to a single number, for sites that expose one price rather than a list. |
| `manualBid` | Hardcode the number. Wins over everything — use it for sites that render their board in JavaScript. |

## What CI checks

`scripts/validate.mjs` runs on every pull request and rejects: malformed JSON, a missing or
malformed `domain`, duplicates, unknown fields, wrong types, an `endpoint` that isn't a path, and
an implausible `manualBid`. It also runs before every build, so a bad entry can never reach the
deployed site.

A site whose bid can't be resolved is not an error — it lists with `—` and sorts last until
someone supplies a `manualBid` or the right `endpoint`.

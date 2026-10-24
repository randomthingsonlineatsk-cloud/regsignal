# RegSignal

RegSignal checks 17 drug regulators every Monday and lists every new or changed official document, each with its official link and date. That covers guidelines, draft guidance and consultations, laws and gazette notifications, circulars, safety communications, recalls, approvals and news. It reads each regulator in every language it publishes in, and anyone can get the weekly digest by email.

It is free to run and free to use: a weekly GitHub Actions job does the checking, Cloudflare hosts the site, and Kit's free plan sends the emails.

Created by **Khan Gulrez Shagufa Fazal Ahmed** ([ORCID 0009-0009-6195-0329](https://orcid.org/0009-0009-6195-0329)).

## Authorities and languages

| Authority | Region | Read in | How |
|---|---|---|---|
| FDA | United States | English | 5 RSS feeds |
| EMA | European Union | English | 11 RSS feeds |
| MHRA | United Kingdom | English | 3 GOV.UK Atom feeds |
| Swissmedic | Switzerland | German, French, English | Safety feed and communications in 3 languages |
| Health Canada | Canada | English, French | Recalls, compliance and enforcement, MedEffect feeds |
| TGA | Australia | English | 8 RSS feeds (not readable from cloud servers, see below) |
| WHO Prequalification | Global | English | RSS feed |
| CDSCO | India | English | Circulars, gazette notifications, public notices, alerts |
| PMDA | Japan | Japanese, English | 新着情報 (includes public comments); 6 English RSS feeds |
| NMPA | China | Chinese, English | English list; Chinese pages listed but blocked by an anti-bot check |
| MFDS | South Korea | Korean, English | 7 Korean boards, 5 English boards |
| SFDA | Saudi Arabia | Arabic, English | News, regulations, guidelines, warnings, circulars |
| HSA | Singapore | English | Announcements |
| SAHPRA | South Africa | English | WordPress feeds |
| ANVISA | Brazil | Portuguese | Latest news from the home page (undated) |
| COFEPRIS | Mexico | Spanish | Press and documents |
| ICH | Global | English | Press releases and news (site's JSON API) |

The exact addresses are in [`engine/sources.mjs`](engine/sources.mjs). The live status of every source is on the site's **Source health** page.

## How it works

1. Every Monday at 03:00 UTC (08:30 IST), [`.github/workflows/weekly.yml`](.github/workflows/weekly.yml) runs `node engine/run.mjs`.
2. Each source is read politely: at most one request every 2 seconds per site, robots.txt respected, and a user-agent that names RegSignal.
3. Each item is normalised and classified by document type and product area, using keywords in nine languages.
4. The run compares this week's items with the archive and labels each one as new, revised (title or date changed), unchanged or no longer listed (missing for two healthy runs).
5. The job commits `data/` and `feed.xml`. Cloudflare redeploys the site automatically.
6. The digest is sent to subscribers as a Kit broadcast.

**Safeguards**

- The first run only records the starting point, so it reports nothing as new and sends no email.
- A failed source, or one that suddenly shows fewer than half its usual items, is flagged and never causes removals.
- Items that simply scroll off a listing page are not reported as removed.

## Data files (public)

| File | Contents |
|---|---|
| `data/documents.json` | Every document ever seen, with history |
| `data/documents.csv` | The same as a spreadsheet (UTF-8, opens in Excel) |
| `data/latest.json` | This week's digest |
| `data/digests/YYYY-MM-DD.json` | One digest per run, plus `index.json` |
| `data/sources.json` | Authorities, sources and their health |
| `data/runs.json` | Log of the last 104 runs |
| `feed.xml` | RSS feed of weekly digests |

## Set up (one time)

1. **GitHub:** create a public repository `regsignal` under your account and upload everything in this folder, including the hidden `.github` folder, `.assetsignore` and `.gitignore`.
2. **Email:** in Kit, create a V4 API key. In the repository go to **Settings → Secrets and variables → Actions → New repository secret**, name it `KIT_API_KEY` and paste the key. The sign-up form (`f6a0e082ad` on regsignal.kit.com) is already in `index.html`.
3. **Cloudflare:** go to **Workers & Pages → Create → Import a repository** and pick `regsignal`. Leave the build command empty and keep the deploy command `npx wrangler deploy`. The site appears at `https://regsignal.<your-subdomain>.workers.dev`.
4. **First run:** in the repository open **Actions → Weekly RegSignal run → Run workflow**. This builds the starting point and sends no email. The run page's summary lists every source as ok, EMPTY or FAIL.
5. If the site address differs from `https://regsignal.randomthingsonlineatsk.workers.dev`, add a repository *variable* (not a secret) named `SITE_URL` with the real address, and update the `og:` lines in `index.html`.

## Fixing a source

Regulator websites change without warning. When a source shows **Failed** or **Check** on the Source health page:

- Open its address in a browser. If it moved, update `url` in `engine/sources.mjs` (or add the new address to `alts`).
- If the page loads but no items are found, the listing layout changed. Add a `rows` CSS selector for one row of the list to that channel.
- To test a few sources without saving anything, run `node engine/run.mjs --only=PMDA,NMPA`.
- Run `npm test` before committing.

## Limits

- RegSignal tracks listing entries, not the text inside PDFs. A file silently replaced behind the same link and title is not caught.
- Types and product areas come from title keywords and can be wrong.
- Some government sites refuse requests from cloud servers (TGA) or answer with an anti-bot check (NMPA's Chinese site and CDE). RegSignal does not get around these. Such sources are marked "Not readable" on the Source health page, with a link to check them directly.
- A source read successfully for the first time sets its own starting point, so adding or repairing a source never floods the digest with old documents.
- Title translation on the site uses the visitor's own browser (Chrome's built-in Translator) and is labelled as machine translation. It is never stored in the data.
- RegSignal never interprets documents or gives regulatory advice. The official text always prevails.

## Develop

```bash
npm install
npm test                                  # offline tests with saved sample feeds and pages
node engine/run.mjs --only=FDA,EMA        # live test of some sources, saves nothing
npx serve .                               # view the site locally
```

## License

Copyright 2026 Khan Gulrez Shagufa Fazal Ahmed. Licensed under the [Apache License 2.0](LICENSE). If you reuse or adapt this code, keep the [NOTICE](NOTICE) file so the original author stays credited.

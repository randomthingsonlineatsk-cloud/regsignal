#!/usr/bin/env node
/*!
 * RegSignal weekly run: read all sources, update the archive, write the digest, email subscribers.
 * Copyright 2026 Khan Gulrez Shagufa Fazal Ahmed. Licensed under the Apache License 2.0.
 *
 * Usage:  node engine/run.mjs [--only=FDA,EMA] [--no-email]
 * Env:    KIT_API_KEY (GitHub secret), SITE_URL (optional), SEND_EMAIL=false to skip mail
 */
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTHORITIES } from './sources.mjs';
import { toCandidate, applyRun, buildDigest, digestEmailHtml, digestSubject, digestRss, toCsv, TYPES, AREA_NAMES, LANGUAGE_NAMES } from './core.mjs';
import { parseAny, looksLikeFeed } from './parse.mjs';
import { politeGet } from './fetch.mjs';
import { sendBroadcast } from './kit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_SITE = 'https://regsignal.randomthingsonlineatsk.workers.dev';

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, data, pretty = false) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, pretty ? 1 : 0) + '\n');
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

/** Reads one channel, trying its alternative addresses in turn. */
export async function readChannel(authority, channel, getter) {
  const sourceId = `${authority.code}/${channel.id}`;
  if (channel.blocked) return { sourceId, ok: false, blocked: true, error: channel.blocked, items: [] };
  const urls = [channel.url, ...(channel.alts || [])];
  const errors = [];
  let emptyOk = null;
  for (const url of urls) {
    try {
      const res = await getter(url);
      const raw = parseAny(res.text, res.url || url, channel);
      const items = raw.map((r) => toCandidate(r, authority, channel)).filter(Boolean);
      if (items.length) return { sourceId, ok: true, items, urlUsed: url };
      if (channel.kind === 'feed' && looksLikeFeed(res.text)) return { sourceId, ok: true, items: [], urlUsed: url, emptyFeed: true };
      emptyOk = emptyOk || { sourceId, ok: true, items: [], urlUsed: url };
      errors.push(`${urls.length > 1 ? `${url}: ` : ''}read, but no dated items found`);
    } catch (e) {
      errors.push(`${urls.length > 1 ? `${url}: ` : ''}${e.message}`);
    }
  }
  if (emptyOk) return emptyOk;
  return { sourceId, ok: false, error: errors.join(' | '), items: [] };
}

export async function runAll({ dataDir, getter = politeGet, authorities = AUTHORITIES, now = new Date(), log = console.log, dryRun = false }) {
  const today = now.toISOString().slice(0, 10);
  const docsFile = path.join(dataDir, 'documents.json');
  const srcFile = path.join(dataDir, 'sources.json');
  const runsFile = path.join(dataDir, 'runs.json');
  const docList = await readJson(docsFile, { documents: [] });
  const srcMeta = await readJson(srcFile, { sources: {} });
  const archive = {
    documents: Object.fromEntries(docList.documents.map((d) => [d.id, d])),
    sources: Object.fromEntries(Object.entries(srcMeta.sources || {}).map(([k, v]) => [k, v.state || {}])),
  };

  const jobs = authorities.map((a) => async () => {
    const results = [];
    for (const ch of a.channels) {
      const r = await readChannel(a, ch, getter);
      log(`${r.blocked ? 'SKIP' : r.ok ? (r.items.length || r.emptyFeed ? 'ok  ' : 'EMPTY') : 'FAIL'} ${r.sourceId}: ${r.ok ? `${r.items.length} items` : r.error}`);
      results.push(r);
    }
    return results;
  });
  const results = (await pool(jobs, 6, (job) => job())).flat();

  const { archive: next, changes, baseline } = applyRun(archive, results, today);
  const digest = buildDigest(next, changes, { runDate: now.toISOString(), today, baseline });

  // Per-source counts for the health page and the run record.
  const perSource = {};
  for (const r of results) perSource[r.sourceId] = { new: 0, revised: 0 };
  for (const id of changes.new) { const s = next.documents[id].source; if (perSource[s]) perSource[s].new++; }
  for (const r of changes.revised) { const s = next.documents[r.id].source; if (perSource[s]) perSource[s].revised++; }

  const sourcesOut = {};
  for (const a of AUTHORITIES) {
    for (const ch of a.channels) {
      const id = `${a.code}/${ch.id}`;
      sourcesOut[id] = {
        authority: a.code, label: ch.label, kind: ch.kind, lang: ch.lang, url: ch.url, alts: ch.alts || [],
        state: next.sources[id] || {}, this_run: perSource[id] || null,
      };
    }
  }

  if (dryRun) return { digest, run: null, results, baseline, dryRun: true };
  const documents = Object.values(next.documents).sort((x, y) => String(y.published || y.first_seen).localeCompare(String(x.published || x.first_seen)) || x.id.localeCompare(y.id));
  await writeJson(docsFile, { updated: now.toISOString(), count: documents.length, documents });
  await writeJson(srcFile, {
    updated: now.toISOString(),
    authorities: AUTHORITIES.map((a) => ({ code: a.code, name: a.name, region: a.region, home: a.home })),
    types: TYPES, areas: AREA_NAMES, languages: LANGUAGE_NAMES,
    sources: sourcesOut,
  }, true);
  await writeJson(path.join(dataDir, 'digests', `${today}.json`), digest, true);
  await writeJson(path.join(dataDir, 'latest.json'), digest, true);

  const index = await readJson(path.join(dataDir, 'digests', 'index.json'), { digests: [] });
  index.digests = [{ date: today, baseline, totals: digest.totals }, ...index.digests.filter((d) => d.date !== today)].slice(0, 520);
  await writeJson(path.join(dataDir, 'digests', 'index.json'), index, true);

  const runs = await readJson(runsFile, { runs: [] });
  const run = {
    run_date: now.toISOString(), baseline,
    totals: digest.totals,
    sources: Object.fromEntries(results.map((r) => [r.sourceId, {
      status: r.blocked ? 'blocked' : r.ok ? next.sources[r.sourceId]?.status : 'failed', items: r.items.length, ...(perSource[r.sourceId] || {}),
      error: r.ok ? next.sources[r.sourceId]?.last_error || null : r.error, url: r.urlUsed || null,
    }])),
    digest: `data/digests/${today}.json`,
    email: null,
  };
  runs.runs = [run, ...runs.runs.filter((r) => r.run_date.slice(0, 10) !== today)].slice(0, 104);
  await writeJson(runsFile, runs, true);

  await writeFile(path.join(dataDir, 'documents.csv'), toCsv(documents));
  return { digest, run, runsFile, runs, baseline, results, dataDir };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
  const only = args.only ? String(args.only).split(',').map((s) => s.trim().toUpperCase()) : null;
  const authorities = only ? AUTHORITIES.filter((a) => only.includes(a.code.toUpperCase())) : AUTHORITIES;
  const site = (process.env.SITE_URL || DEFAULT_SITE).replace(/\/$/, '');
  const dataDir = path.join(ROOT, 'data');

  if (only) {
    // A test run of a few sources: report what would be found, change nothing.
    const out = await runAll({ dataDir, authorities, dryRun: true });
    const t = out.digest.totals;
    console.log(`Test run only (nothing saved): ${out.results.length} channels, ${out.results.filter((r) => r.ok && r.items.length).length} read with items.`);
    for (const r of out.results) for (const it of r.items.slice(0, 3)) console.log(`  ${r.sourceId} | ${it.published || '----------'} | ${it.type} | ${it.title.slice(0, 90)}`);
    return t;
  }
  const out = await runAll({ dataDir, authorities });
  const { digest, run, runs, runsFile } = out;

  // Digest feed for feed readers (last 52 weeks).
  const index = await readJson(path.join(dataDir, 'digests', 'index.json'), { digests: [] });
  const recent = [];
  for (const d of index.digests.slice(0, 52)) {
    const full = await readJson(path.join(dataDir, 'digests', `${d.date}.json`), null);
    if (full) recent.push(full);
  }
  await writeFile(path.join(ROOT, 'feed.xml'), digestRss(recent, site));

  // Email.
  const wantEmail = !args['no-email'] && process.env.SEND_EMAIL !== 'false';
  if (digest.baseline) {
    run.email = { ok: false, skipped: true, error: 'First run builds the starting point; no email is sent.' };
  } else if (!wantEmail) {
    run.email = { ok: false, skipped: true, error: 'Email switched off for this run.' };
  } else {
    run.email = await sendBroadcast({
      apiKey: process.env.KIT_API_KEY,
      subject: digestSubject(digest),
      html: digestEmailHtml(digest, site),
      previewText: `${digest.totals.new} new and ${digest.totals.revised} revised documents from 17 regulators`,
    });
  }
  runs.runs[0] = run;
  await writeJson(runsFile, runs, true);
  console.log(`Email: ${run.email.ok ? `scheduled (broadcast ${run.email.id})` : run.email.error}`);

  // Summary for the GitHub Actions page.
  const t = digest.totals;
  const lines = [
    `## RegSignal run ${digest.date}${digest.baseline ? ' (first run: starting point)' : ''}`,
    `${t.documents} documents tracked · ${t.new} new · ${t.revised} revised · ${t.removed} no longer listed · ${t.failed} sources failed · ${t.suspect} sources suspect`,
    `Email: ${run.email.ok ? 'scheduled' : run.email.error}`,
    '', '| Source | Status | Items | Note |', '| --- | --- | --- | --- |',
    ...Object.entries(run.sources).map(([id, s]) => `| ${id} | ${s.status} | ${s.items} | ${(s.error || '').replace(/\|/g, '/').slice(0, 300)} |`),
  ];
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `new_count=${t.new}\nrevised_count=${t.revised}\n`);
  console.log(lines.slice(0, 3).join('\n'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}


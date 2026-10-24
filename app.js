/*!
 * RegSignal website. Copyright 2026 Khan Gulrez Shagufa Fazal Ahmed. Licensed under the Apache License 2.0.
 * A static page: it reads the JSON files the weekly run commits to the repository. Nothing is sent anywhere,
 * except the optional title translation, which runs inside the visitor's own browser.
 */
const VERSION = '1.0.0';
// Link each document to the Pathway Explorer page for its authority once that app has a public address.
const PATHWAY_EXPLORER_URL = '';

const FALLBACK = {
  types: { guideline: 'Guideline (final)', draft: 'Draft guidance or consultation', law: 'Law, rule or gazette notification', circular: 'Circular, notice or order', safety: 'Safety communication', recall: 'Recall or shortage', approval: 'Approval or product decision', news: 'News or press release', other: 'Other' },
  languages: { en: 'English', ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ar: 'Arabic', pt: 'Portuguese', es: 'Spanish', de: 'German', fr: 'French' },
  areas: {},
};
const PAGE = 50;
const S = { latest: null, meta: null, index: null, docs: null, docsPromise: null, translate: false, tcache: {}, page: 1, weekCache: {} };
const store = {
  get(k, d) { try { const v = localStorage.getItem(`regsignal:${k}`); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`regsignal:${k}`, JSON.stringify(v)); } catch { /* private mode: ignore */ } },
};
S.translate = store.get('translate', false);
try { S.tcache = JSON.parse(sessionStorage.getItem('regsignal:tcache') || '{}'); } catch { S.tcache = {}; }

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (d) => { if (!d) return ''; const [y, m, dd] = d.slice(0, 10).split('-').map(Number); return `${dd} ${MON[m - 1]} ${y}`; };
const types = () => S.meta?.types || FALLBACK.types;
const langs = () => S.meta?.languages || FALLBACK.languages;
const areas = () => S.meta?.areas || FALLBACK.areas;
const auths = () => S.meta?.authorities || [];
const authName = (c) => auths().find((a) => a.code === c)?.name || c;
const region = (c) => auths().find((a) => a.code === c)?.region || '';

async function getJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
function loadDocs() {
  if (!S.docsPromise) S.docsPromise = getJson('data/documents.json').then((d) => (S.docs = d.documents || [])).catch(() => (S.docs = []));
  return S.docsPromise;
}

// ------------------------------------------------------------ translation (browser built-in, labelled)

const translators = {};
function hasTranslator() { return 'Translator' in self; }
async function translatorFor(lang) {
  if (!hasTranslator() || lang === 'en') return null;
  if (translators[lang]) return translators[lang];
  translators[lang] = (async () => {
    const opts = { sourceLanguage: lang, targetLanguage: 'en' };
    const a = await self.Translator.availability(opts);
    if (a === 'unavailable') return null;
    return self.Translator.create({ ...opts, monitor(m) { m.addEventListener('downloadprogress', (e) => setStatus(`Downloading the ${langs()[lang] || lang} translation model in your browser: ${Math.round(e.loaded * 100)}%`)); } });
  })().catch(() => null);
  return translators[lang];
}
let statusTimer;
function setStatus(msg) {
  const el = $('#tstatus');
  if (!el) return;
  el.textContent = msg;
  clearTimeout(statusTimer);
  if (msg) statusTimer = setTimeout(() => { el.textContent = ''; }, 8000);
}
async function translateVisible() {
  if (!S.translate) return;
  const nodes = [...document.querySelectorAll('.doc[data-lang]:not([data-lang="en"])')];
  for (const n of nodes) {
    const lang = n.dataset.lang;
    const title = n.dataset.title;
    const key = `${lang}|${title}`;
    let out = S.tcache[key];
    if (!out) {
      const t = await translatorFor(lang);
      if (!t) continue;
      try { out = await t.translate(title); } catch { continue; }
      S.tcache[key] = out;
      try { sessionStorage.setItem('regsignal:tcache', JSON.stringify(S.tcache)); } catch { /* ignore */ }
    }
    if (!n.querySelector('.mt') && out) n.querySelector('.t').insertAdjacentHTML('afterend', `<div class="mt"><small>Machine translation (your browser)</small>${esc(out)}</div>`);
  }
}
function translateButton() {
  if (!hasTranslator()) {
    return `<span class="muted" style="font-size:.84rem">Titles are in the original language. Use "Translate page" on any item, or Chrome on a computer for built-in title translation.</span>`;
  }
  return `<button class="btn sm" id="tbtn" aria-pressed="${S.translate}">Translate titles to English</button><span id="tstatus" class="muted" style="font-size:.82rem"></span>`;
}
function wireTranslate() {
  const b = $('#tbtn');
  if (!b) return;
  b.onclick = async () => {
    S.translate = !S.translate;
    store.set('translate', S.translate);
    b.setAttribute('aria-pressed', S.translate);
    if (S.translate) { setStatus('Translating titles in your browser…'); await translateVisible(); setStatus(''); } else document.querySelectorAll('.doc .mt').forEach((e) => e.remove());
  };
  if (S.translate) translateVisible();
}

// ------------------------------------------------------------ document card

function docCard(d, opts = {}) {
  const label = opts.label || (d.status === 'new' ? 'new' : d.status === 'revised' ? 'revised' : d.status === 'no longer listed' ? 'gone' : '');
  const pill = label === 'new' ? '<span class="pill new">New</span>' : label === 'revised' ? '<span class="pill revised">Revised</span>' : label === 'gone' ? '<span class="pill gone">No longer listed</span>' : '';
  const ln = d.language && d.language !== 'en' ? `<span class="pill" title="Original language">${esc(langs()[d.language] || d.language)}</span>` : '';
  const ar = (d.areas || []).map((a) => `<span class="tag">#${esc(areas()[a] || a)}</span>`).join(' ');
  const changes = (opts.changes || []).map((c) => c.field === 'title' ? `Title was: “${esc(c.from)}”` : c.field === 'published' ? `Date changed from ${fmt(c.from)} to ${fmt(c.to)}` : '').filter(Boolean).join(' · ');
  const tr = d.language && d.language !== 'en' ? ` · <a href="https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(d.url)}" target="_blank" rel="noopener">Translate page ↗</a>` : '';
  const isAr = d.language === 'ar';
  return `<article class="doc ${label}" data-lang="${esc(d.language || 'en')}" data-title="${esc(d.title)}">
    <div class="t"${isAr ? ' dir="rtl" lang="ar"' : d.language ? ` lang="${esc(d.language)}"` : ''}><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a></div>
    ${d.title_en ? `<div class="en">${esc(d.title_en)}</div>` : ''}
    ${changes ? `<div class="change">${changes}</div>` : ''}
    <div class="meta">${pill}${opts.showAuth ? `<strong>${esc(d.authority)}</strong>` : ''}<span>${esc(types()[d.type] || d.type)}</span>${d.published ? `<span>${fmt(d.published)}</span>` : `<span class="muted" title="The regulator gives no date; this is when RegSignal first saw it">first seen ${fmt(d.first_seen)}</span>`}${ln}
      <a href="${esc(d.url)}" target="_blank" rel="noopener">Official page ↗</a>${tr} · <a href="#doc=${encodeURIComponent(d.id)}">Details</a></div>
    ${ar ? `<div>${ar}</div>` : ''}
  </article>`;
}

function grouped(list, opts) {
  const g = new Map();
  for (const d of list) { if (!g.has(d.authority)) g.set(d.authority, []); g.get(d.authority).push(d); }
  return [...g.entries()].map(([code, items]) => `<section class="group"><h2>${esc(code)} <small>${esc(authName(code))} · ${esc(region(code))} · ${items.length}</small></h2><div class="docs">${items.map((d) => docCard(d, { ...opts, changes: d.changes })).join('')}</div></section>`).join('');
}

// ------------------------------------------------------------ filters and watchlists

function blankFilters() { return { q: '', auth: '', region: '', type: '', area: '', status: '', lang: '', from: '', to: '' }; }
function matches(d, f) {
  if (f.auth && d.authority !== f.auth) return false;
  if (f.region && region(d.authority) !== f.region) return false;
  if (f.type && d.type !== f.type) return false;
  if (f.area && !(d.areas || []).includes(f.area)) return false;
  if (f.lang && d.language !== f.lang) return false;
  if (f.status && (d.status || '') !== f.status) return false;
  const date = d.published || d.first_seen || '';
  if (f.from && date < f.from) return false;
  if (f.to && date > f.to) return false;
  if (f.q) {
    const hay = `${d.title} ${d.title_en || ''} ${d.summary || ''} ${S.tcache[`${d.language}|${d.title}`] || ''}`.toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  return true;
}
function describeFilters(f) {
  const parts = [];
  if (f.auth) parts.push(f.auth);
  if (f.region) parts.push(f.region);
  if (f.type) parts.push(types()[f.type]);
  if (f.area) parts.push(areas()[f.area] || f.area);
  if (f.lang) parts.push(langs()[f.lang]);
  if (f.q) parts.push(`“${f.q}”`);
  return parts.join(' + ') || 'everything';
}
const watchlists = () => store.get('watchlists', []);

// ------------------------------------------------------------ views

function setNav(v) {
  document.querySelectorAll('nav.views a').forEach((a) => a.setAttribute('aria-current', a.dataset.v === v ? 'page' : 'false'));
}

function notReady() {
  return `<div class="head"><span class="kicker">Not started yet</span><h1>The first weekly run has not happened yet</h1><p>RegSignal checks 17 drug regulators every Monday at 08:30 IST. Once the first run finishes, this page shows what it found. The first run records the starting point; from the following Monday, new and revised documents appear here.</p></div>`;
}

async function viewWeek(date) {
  setNav(date ? 'digests' : 'week');
  let d = S.latest;
  if (date && (!d || d.date !== date)) {
    d = S.weekCache[date] || (S.weekCache[date] = await getJson(`data/digests/${date}.json`).catch(() => null));
  }
  if (!d) return notReady();
  const t = d.totals;
  const wl = watchlists();
  const onlyMine = store.get('onlyMine', false) && wl.length > 0;
  const keep = (x) => !onlyMine || wl.some((w) => matches(x, w.filters));
  const nw = d.new.filter(keep), rv = d.revised.filter(keep), gone = (d.removed || []).filter(keep);
  let body = '';
  if (d.baseline) {
    body = `<p class="note">This was RegSignal's first run. It recorded ${t.documents.toLocaleString()} documents currently listed by the 17 regulators as its starting point, so nothing is marked new this week. From the next Monday, this page shows only what changed. You can browse everything under <a href="#all">All documents</a>.</p>`;
  } else if (!nw.length && !rv.length && !gone.length) {
    body = `<div class="panel empty">${onlyMine ? 'Nothing this week matches your watchlists.' : 'No new or revised documents this week.'}</div>`;
  } else {
    if (nw.length) body += `<h2>New documents</h2>${grouped(nw, { label: 'new' })}`;
    if (rv.length) body += `<h2 style="margin-top:8px">Revised documents</h2>${grouped(rv, { label: 'revised' })}`;
    if (gone.length) body += `<h2 style="margin-top:8px">No longer listed</h2><p class="muted" style="margin:0">These disappeared from the regulator's listing. The records stay here for reference.</p>${grouped(gone, { label: 'gone' })}`;
  }
  const problems = (d.failed || []).length + (d.suspect || []).length;
  return `<div class="head"><span class="kicker">${date && S.latest && date !== S.latest.date ? 'Past week' : 'This week'} · run of ${fmt(d.date)}</span>
    <h1>${d.baseline ? 'RegSignal started tracking' : `${t.new} new and ${t.revised} revised documents`}</h1>
    <p>Official documents from 17 drug regulators, checked every Monday. Titles appear exactly as the regulator published them, in the original language.</p></div>
    <div class="counts"><a class="new" href="#all"><b>${t.new}</b><span>New</span></a><div class="rev"><b>${t.revised}</b><span>Revised</span></div><div><b>${t.removed}</b><span>No longer listed</span></div><a href="#all"><b>${t.documents.toLocaleString()}</b><span>Tracked</span></a><a class="${problems ? 'bad' : ''}" href="#health"><b>${problems}</b><span>Source problems</span></a></div>
    ${problems ? `<p class="note warn">${problems} of the sources could not be read fully on this run, so changes there may be missing. See <a href="#health">source health</a>.</p>` : ''}
    <div class="toolbar">${translateButton()}<span class="grow"></span>${wl.length ? `<label class="chip" style="padding:3px 10px;gap:6px"><input type="checkbox" id="onlyMine" ${onlyMine ? 'checked' : ''}> Only my watchlists</label>` : `<a class="btn sm" href="#all">Make a watchlist</a>`}</div>
    ${body}`;
}

function options(map, sel, blank) { return `<option value="">${blank}</option>` + Object.entries(map).map(([k, v]) => `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join(''); }

async function viewAll() {
  setNav('all');
  const app = $('#view');
  app.innerHTML = `<div class="head"><span class="kicker">Archive</span><h1>All documents</h1></div><div class="skel"></div>`;
  await loadDocs();
  if (!S.docs.length) return notReady();
  const f = { ...blankFilters(), ...store.get('filters', {}) };
  const authMap = Object.fromEntries(auths().map((a) => [a.code, `${a.code} · ${a.region}`]));
  const regionMap = Object.fromEntries([...new Set(auths().map((a) => a.region))].sort().map((r) => [r, r]));
  const statusMap = { new: 'New this week', revised: 'Revised', unchanged: 'Unchanged', 'no longer listed': 'No longer listed' };
  return `<div class="head"><span class="kicker">Archive</span><h1>All documents</h1><p>Every document RegSignal has seen, newest first. Records are never deleted, so documents a regulator removed stay visible with that label.</p></div>
  <div class="panel">
    <div class="filters">
      <label class="field" style="grid-column:1/-1"><span>Search titles</span><input type="search" id="f-q" value="${esc(f.q)}" placeholder="e.g. nitrosamine, biosimilar, 指导原则, 가이드라인"></label>
      <label class="field"><span>Authority</span><select id="f-auth">${options(authMap, f.auth, 'All 17')}</select></label>
      <label class="field"><span>Region</span><select id="f-region">${options(regionMap, f.region, 'All regions')}</select></label>
      <label class="field"><span>Document type</span><select id="f-type">${options(types(), f.type, 'All types')}</select></label>
      <label class="field"><span>Product area</span><select id="f-area">${options(areas(), f.area, 'All areas')}</select></label>
      <label class="field"><span>Label</span><select id="f-status">${options(statusMap, f.status, 'Any')}</select></label>
      <label class="field"><span>Language</span><select id="f-lang">${options(langs(), f.lang, 'Any language')}</select></label>
      <label class="field"><span>From</span><input type="date" id="f-from" value="${esc(f.from)}"></label>
      <label class="field"><span>To</span><input type="date" id="f-to" value="${esc(f.to)}"></label>
    </div>
    <div class="toolbar"><button class="btn sm" id="f-clear">Clear filters</button><button class="btn sm" id="f-save">Save as watchlist</button><button class="btn sm" id="f-csv">Download CSV</button><span class="grow"></span>${translateButton()}</div>
    <div class="chips" id="wl"></div>
  </div>
  <div id="results"></div>`;
}

function readFilters() {
  const f = blankFilters();
  for (const k of Object.keys(f)) { const el = $(`#f-${k}`); if (el) f[k] = el.value.trim(); }
  return f;
}
function renderWatchlists() {
  const el = $('#wl');
  if (!el) return;
  const wl = watchlists();
  el.innerHTML = wl.length ? `<span class="muted" style="font-size:.82rem">Watchlists (saved in this browser only):</span>` + wl.map((w, i) => `<span class="chip"><button data-i="${i}" title="${esc(describeFilters(w.filters))}">${esc(w.name)}</button><button class="x" data-del="${i}" aria-label="Delete watchlist ${esc(w.name)}">×</button></span>`).join('') : '';
  el.querySelectorAll('button[data-i]').forEach((b) => b.onclick = () => { store.set('filters', wl[b.dataset.i].filters); route(); });
  el.querySelectorAll('button[data-del]').forEach((b) => b.onclick = () => { const next = watchlists(); next.splice(Number(b.dataset.del), 1); store.set('watchlists', next); renderWatchlists(); });
}
function renderResults() {
  const f = readFilters();
  store.set('filters', f);
  const list = S.docs.filter((d) => matches(d, f));
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  S.page = Math.min(S.page, pages);
  const slice = list.slice((S.page - 1) * PAGE, S.page * PAGE);
  const pager = pages > 1 ? `<div class="pager"><button class="btn sm" data-p="${S.page - 1}" ${S.page <= 1 ? 'disabled' : ''}>Previous</button><span class="muted">Page ${S.page} of ${pages}</span><button class="btn sm" data-p="${S.page + 1}" ${S.page >= pages ? 'disabled' : ''}>Next</button></div>` : '';
  $('#results').innerHTML = `<p class="muted" style="margin:0 0 8px">${list.length.toLocaleString()} of ${S.docs.length.toLocaleString()} documents</p><div class="docs">${slice.map((d) => docCard(d, { showAuth: true })).join('') || '<div class="panel empty">No documents match these filters.</div>'}</div>${pager}`;
  $('#results').querySelectorAll('button[data-p]').forEach((b) => b.onclick = () => { S.page = Number(b.dataset.p); renderResults(); $('#results').scrollIntoView({ block: 'start' }); });
  translateVisible();
  return list;
}
function wireAll() {
  if (!$('#results')) return;
  let timer;
  const again = () => { clearTimeout(timer); timer = setTimeout(() => { S.page = 1; renderResults(); }, 150); };
  document.querySelectorAll('.filters input, .filters select').forEach((el) => { el.oninput = again; el.onchange = again; });
  $('#f-clear').onclick = () => { store.set('filters', blankFilters()); route(); };
  $('#f-save').onclick = () => {
    const f = readFilters();
    const name = prompt('Name this watchlist', describeFilters(f));
    if (!name) return;
    store.set('watchlists', [...watchlists(), { name: name.slice(0, 60), filters: f }]);
    renderWatchlists();
  };
  $('#f-csv').onclick = () => {
    const list = S.docs.filter((d) => matches(d, readFilters()));
    const cols = ['authority', 'title', 'title_en', 'type', 'areas', 'published', 'first_seen', 'status', 'language', 'url'];
    const cell = (v) => { const s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = '﻿' + [cols.join(','), ...list.map((d) => cols.map((c) => cell(c === 'type' ? types()[d.type] : d[c])).join(','))].join('\r\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `regsignal-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  renderWatchlists();
  renderResults();
}

async function viewDoc(id) {
  setNav('all');
  await loadDocs();
  const d = S.docs.find((x) => x.id === id);
  if (!d) return `<div class="panel empty">This document is not in the archive. <a href="#all">Browse all documents</a>.</div>`;
  const src = S.meta?.sources?.[d.source];
  const hist = (d.history || []).slice().reverse().map((h) => `<li><strong>${fmt(h.date)}</strong>: ${h.changes.map((c) => c.field === 'title' ? `title changed from “${esc(c.from)}” to “${esc(c.to)}”` : c.field === 'published' ? `date changed from ${fmt(c.from)} to ${fmt(c.to)}` : c.field === 'listed' ? (c.to === 'no' ? 'no longer listed by the regulator' : 'listed again') : esc(c.field)).join('; ')}</li>`).join('');
  return `<div class="head"><span class="kicker"><a href="#all">All documents</a> · ${esc(d.authority)}</span><h1 ${d.language ? `lang="${esc(d.language)}"` : ''}${d.language === 'ar' ? ' dir="rtl"' : ''}>${esc(d.title)}</h1>${d.title_en ? `<p>${esc(d.title_en)}</p>` : ''}</div>
  <div class="toolbar"><a class="btn primary" href="${esc(d.url)}" target="_blank" rel="noopener">Open the official page ↗</a>${d.language && d.language !== 'en' ? `<a class="btn" href="https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(d.url)}" target="_blank" rel="noopener">Translate page ↗</a>` : ''}${PATHWAY_EXPLORER_URL ? `<a class="btn" href="${esc(PATHWAY_EXPLORER_URL)}#${esc(d.authority)}" target="_blank" rel="noopener">${esc(d.authority)} in the Pathway Explorer ↗</a>` : ''}</div>
  <div class="panel"><dl class="facts">
    <dt>Authority</dt><dd>${esc(authName(d.authority))} (${esc(region(d.authority))})</dd>
    <dt>Document type</dt><dd>${esc(types()[d.type] || d.type)}</dd>
    <dt>Product areas</dt><dd>${(d.areas || []).map((a) => esc(areas()[a] || a)).join(', ') || '<span class="muted">none matched</span>'}</dd>
    <dt>Date given by the regulator</dt><dd>${d.published ? fmt(d.published) : '<span class="muted">none given</span>'}</dd>
    <dt>First seen by RegSignal</dt><dd>${fmt(d.first_seen)}</dd>
    <dt>Last seen on the listing</dt><dd>${fmt(d.last_seen)}</dd>
    <dt>Label</dt><dd>${esc(d.status)}</dd>
    <dt>Language</dt><dd>${esc(langs()[d.language] || d.language)}</dd>
    <dt>Found on</dt><dd>${src ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.label)}</a>` : esc(d.source)}</dd>
    ${d.summary ? `<dt>Summary from the regulator's feed</dt><dd>${esc(d.summary)}</dd>` : ''}
    <dt>Official link</dt><dd><a href="${esc(d.url)}" target="_blank" rel="noopener" class="mono">${esc(d.url)}</a></dd>
  </dl></div>
  <div class="panel"><h2>History</h2>${hist ? `<ul style="margin:0;padding-left:18px">${hist}</ul>` : '<p class="muted" style="margin:0">No changes recorded since RegSignal first saw this document.</p>'}</div>`;
}

function viewDigests() {
  setNav('digests');
  const list = S.index?.digests || [];
  if (!list.length) return notReady();
  return `<div class="head"><span class="kicker">Archive</span><h1>Past weeks</h1><p>One digest per weekly run. Each is also in the <a href="feed.xml">RSS feed</a>.</p></div>
  <div class="tablewrap"><table><thead><tr><th>Run</th><th>New</th><th>Revised</th><th>No longer listed</th><th>Source problems</th><th>Tracked</th></tr></thead><tbody>
  ${list.map((d) => `<tr><td><a href="#week=${d.date}">${fmt(d.date)}</a>${d.baseline ? ' <span class="pill">first run</span>' : ''}</td><td>${d.totals.new}</td><td>${d.totals.revised}</td><td>${d.totals.removed}</td><td>${d.totals.failed + d.totals.suspect}</td><td>${d.totals.documents.toLocaleString()}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function viewHealth() {
  setNav('health');
  const src = S.meta?.sources;
  if (!src) return notReady();
  const byAuth = new Map();
  for (const [id, s] of Object.entries(src)) { if (!byAuth.has(s.authority)) byAuth.set(s.authority, []); byAuth.get(s.authority).push([id, s]); }
  const label = { ok: 'Read', suspect: 'Check', failed: 'Failed', new: 'Not read yet' };
  let ok = 0, all = 0;
  for (const s of Object.values(src)) { all++; if (s.state?.status === 'ok') ok++; }
  return `<div class="head"><span class="kicker">Transparency</span><h1>Source health</h1><p>Every feed and page RegSignal reads, with the result of the last run (${fmt(S.meta.updated)}). Regulator websites change without warning; a source marked Failed or Check is fixed in the code, and its documents are never treated as removed while it is broken.</p></div>
  <div class="counts"><div class="new"><b>${ok}</b><span>Read fine</span></div><div class="${all - ok ? 'bad' : ''}"><b>${all - ok}</b><span>Need attention</span></div><div><b>${byAuth.size}</b><span>Authorities</span></div></div>
  ${[...byAuth.entries()].map(([code, rows]) => `<section class="group"><h2>${esc(code)} <small>${esc(authName(code))} · ${esc(region(code))}</small></h2><div class="tablewrap"><table><thead><tr><th>Source</th><th>Language</th><th>Status</th><th>Items</th><th>Last read fine</th><th>Note</th></tr></thead><tbody>
    ${rows.map(([, s]) => { const st = s.state || {}; const status = st.status || 'new'; return `<tr><td><a href="${esc(st.url_used || s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a> <span class="muted">(${s.kind})</span></td><td>${esc(langs()[s.lang] || s.lang)}</td><td><span class="pill ${status}">${label[status] || status}</span></td><td>${st.items ?? '–'}</td><td>${st.last_ok ? fmt(st.last_ok) : '–'}</td><td class="err">${esc(st.last_error || '')}</td></tr>`; }).join('')}
  </tbody></table></div></section>`).join('')}`;
}

function viewAbout() {
  setNav('about');
  return `<div class="head"><span class="kicker">About</span><h1>What RegSignal does</h1></div>
  <div class="panel prose">
    <p>RegSignal checks the official websites of 17 drug regulators every Monday at 08:30 IST and lists every new or changed official document: guidelines, draft guidance and consultations, laws and gazette notifications, circulars and notices, safety communications, recalls and shortages, approvals and news. Each item links to the regulator's own page.</p>
    <p><strong>Authorities:</strong> ${auths().map((a) => `${esc(a.code)} (${esc(a.region)})`).join(', ') || 'FDA, EMA, MHRA, Swissmedic, Health Canada, TGA, WHO Prequalification, CDSCO, PMDA, NMPA, MFDS, SFDA, HSA, SAHPRA, ANVISA, COFEPRIS, ICH'}.</p>
    <p><strong>Every language.</strong> Regulators are read in each language they publish in: English, Japanese, Chinese, Korean, Arabic, Portuguese, Spanish, German and French. Titles are stored exactly as published. The optional "Translate titles" button uses the translator built into your browser; those translations are marked as machine translation and are never saved in the data.</p>
    <h2>How changes are decided</h2>
    <ul>
      <li><strong>New:</strong> a document link RegSignal has never seen before.</li>
      <li><strong>Revised:</strong> the same link with a changed title or date.</li>
      <li><strong>No longer listed:</strong> missing from its listing for two weekly runs in a row while the source itself was read correctly. The record is kept.</li>
      <li>The first run only records the starting point, so nothing is marked new that week.</li>
      <li>A source that fails, or suddenly shows far fewer items than usual, is flagged on the <a href="#health">source health</a> page and none of its documents are treated as removed.</li>
    </ul>
    <h2>Limits</h2>
    <ul>
      <li>RegSignal tracks listing entries, not the text inside PDFs. A regulator that silently replaces a file behind the same link and title will not be caught.</li>
      <li>Document types and product areas come from keywords in the title and can be wrong. They help filtering; they are not a classification decision.</li>
      <li>RegSignal never summarises, interprets or gives regulatory advice. Always read the official document.</li>
    </ul>
    <h2>Open data</h2>
    <p>Everything is public and free to reuse: <a href="data/documents.json">documents.json</a>, <a href="data/documents.csv">documents.csv</a>, <a href="data/latest.json">this week's digest</a>, <a href="data/runs.json">run log</a> and the <a href="feed.xml">RSS feed</a>. Your watchlists are saved only in your own browser.</p>
    <h2>Credit and licence</h2>
    <p>Made by Khan Gulrez Shagufa Fazal Ahmed (<a href="https://orcid.org/0009-0009-6195-0329" target="_blank" rel="noopener">ORCID 0009-0009-6195-0329</a>). Source code under the Apache License 2.0 on <a href="https://github.com/randomthingsonlineatsk-cloud/regsignal" target="_blank" rel="noopener">GitHub</a>. Version ${VERSION}.</p>
  </div>`;
}

// ------------------------------------------------------------ router

async function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const app = $('#view');
  let html;
  try {
    if (h.startsWith('doc=')) html = await viewDoc(h.slice(4));
    else if (h.startsWith('week=')) html = await viewWeek(h.slice(5));
    else if (h === 'all') html = await viewAll();
    else if (h === 'digests') html = viewDigests();
    else if (h === 'health') html = viewHealth();
    else if (h === 'about') html = viewAbout();
    else if (h === 'subscribe') return;
    else html = await viewWeek();
  } catch (e) {
    html = `<div class="panel empty">Something went wrong loading this view: ${esc(e.message)}</div>`;
  }
  app.innerHTML = html;
  wireTranslate();
  wireAll();
  const om = $('#onlyMine');
  if (om) om.onchange = () => { store.set('onlyMine', om.checked); route(); };
  if (!h.startsWith('doc=')) window.scrollTo({ top: 0 });
}

async function start() {
  const [latest, meta, index] = await Promise.all([
    getJson('data/latest.json').catch(() => null),
    getJson('data/sources.json').catch(() => null),
    getJson('data/digests/index.json').catch(() => null),
  ]);
  Object.assign(S, { latest, meta, index });
  window.addEventListener('hashchange', route);
  await route();
}
start();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

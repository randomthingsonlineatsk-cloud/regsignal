/*!
 * Polite HTTP for RegSignal: one request every 2 seconds per site, robots.txt respected,
 * clear user-agent, correct decoding of Japanese, Chinese, Korean and other encodings.
 * Copyright 2026 Khan Gulrez Shagufa Fazal Ahmed. Licensed under the Apache License 2.0.
 */

export const USER_AGENT = 'RegSignal/1.0 (weekly regulatory update digest; +https://github.com/randomthingsonlineatsk-cloud/regsignal)';
const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,application/atom+xml,*/*;q=0.8';
const GAP_MS = 2000;
const TIMEOUT_MS = 45000;

const lastHit = new Map();
const robotsCache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitTurn(host) {
  const last = lastHit.get(host) || 0;
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

/** Picks the character set from the header, the XML declaration or a meta tag. */
export function sniffCharset(contentType, bytes) {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType || '');
  if (fromHeader) return fromHeader[1].toLowerCase();
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
  const m = /<\?xml[^>]*encoding=["']([\w-]+)/i.exec(head) || /<meta[^>]+charset=["']?([\w-]+)/i.exec(head);
  return m ? m[1].toLowerCase() : 'utf-8';
}

export function decode(bytes, contentType) {
  let cs = sniffCharset(contentType, bytes);
  if (cs === 'ks_c_5601-1987' || cs === 'x-windows-949' || cs === 'cp949') cs = 'euc-kr';
  if (cs === 'gb2312' || cs === 'gbk') cs = 'gb18030';
  if (cs === 'sjis' || cs === 'x-sjis' || cs === 'windows-31j') cs = 'shift_jis';
  try { return new TextDecoder(cs).decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
}

/** Minimal robots.txt check for our user-agent and "*". */
export function robotsAllows(robotsText, path) {
  if (!robotsText) return true;
  const groups = [];
  let cur = null;
  for (const raw of robotsText.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
    } else if (cur && (key === 'disallow' || key === 'allow')) {
      cur.rules.push({ allow: key === 'allow', path: val });
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== '*' && 'regsignal'.includes(a)))
    || groups.find((g) => g.agents.includes('*'));
  if (!mine) return true;
  let best = null;
  for (const r of mine.rules) {
    if (!r.path) continue;
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  }
  return !best || best.allow;
}

async function rawGet(url, accept) {
  const u = new URL(url);
  await waitTurn(u.host);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: accept || BROWSER_ACCEPT, 'Accept-Language': 'en,ja;q=0.8,zh;q=0.8,ko;q=0.8,ar;q=0.7,pt;q=0.7,es;q=0.7,de;q=0.7,fr;q=0.7' },
      redirect: 'follow', signal: ctl.signal,
    });
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, ok: res.ok, url: res.url || url, text: decode(bytes, res.headers.get('content-type')), contentType: res.headers.get('content-type') || '' };
  } finally {
    clearTimeout(timer);
  }
}

async function robotsFor(url) {
  const u = new URL(url);
  if (robotsCache.has(u.origin)) return robotsCache.get(u.origin);
  let text = '';
  try {
    const r = await rawGet(`${u.origin}/robots.txt`, 'text/plain');
    if (r.ok && !/<html/i.test(r.text.slice(0, 500))) text = r.text;
  } catch { /* no robots.txt reachable: treat as allowed */ }
  robotsCache.set(u.origin, text);
  return text;
}

/** GET a page or feed. Throws an Error with a plain-language message on failure. */
export async function politeGet(url) {
  const u = new URL(url);
  const robots = await robotsFor(url);
  if (!robotsAllows(robots, u.pathname + u.search)) throw new Error(`robots.txt of ${u.host} does not allow this page, so it is not read.`);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await rawGet(url);
      if (r.ok) return r;
      lastErr = new Error(`The site answered HTTP ${r.status}${r.status === 403 ? ' (access refused, possibly blocking cloud servers)' : r.status === 404 ? ' (page not found; the address may have changed)' : ''}.`);
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      lastErr = new Error(e.name === 'AbortError' ? `No answer within ${TIMEOUT_MS / 1000} seconds.` : `Could not connect (${e.cause?.code || e.message}).`);
    }
    await sleep(5000);
  }
  throw lastErr;
}

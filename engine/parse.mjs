/*!
 * RegSignal parsers for RSS/Atom feeds and official listing pages.
 * Copyright 2026 Khan Gulrez Shagufa Fazal Ahmed. Licensed under the Apache License 2.0.
 */
import * as cheerio from 'cheerio';
import { cleanText, findDate, parseFeedDate, asciiDigits } from './core.mjs';

export function looksLikeFeed(text) {
  const head = String(text || '').slice(0, 2000);
  return /<(rss|feed|rdf:RDF)[\s>]/i.test(head) && !/<html[\s>]/i.test(head.slice(0, 400));
}

function htmlToText(s) {
  if (!s) return '';
  if (!/[<&]/.test(s)) return cleanText(s);
  return cleanText(cheerio.load(`<div>${s}</div>`)('div').first().text());
}

/** Items from an RSS 2.0, RSS 1.0 (RDF) or Atom feed. */
export function parseFeed(xml, baseUrl) {
  const $ = cheerio.load(xml, { xml: true });
  const out = [];
  const nodes = $('item').length ? $('item') : $('entry');
  nodes.each((_, el) => {
    const n = $(el);
    const pick = (...names) => {
      for (const name of names) {
        const v = n.children(name).first().text();
        if (v && v.trim()) return v.trim();
      }
      return '';
    };
    let link = '';
    const atomLinks = n.children('link[href]');
    if (atomLinks.length) {
      const alt = atomLinks.filter((_, l) => !$(l).attr('rel') || $(l).attr('rel') === 'alternate').first();
      link = (alt.length ? alt : atomLinks.first()).attr('href');
    } else {
      link = pick('link');
      if (!link) {
        const guid = n.children('guid').first();
        if (guid.length && guid.attr('isPermaLink') !== 'false' && /^https?:/.test(guid.text().trim())) link = guid.text().trim();
      }
    }
    out.push({
      title: htmlToText(pick('title')),
      url: link,
      base: baseUrl,
      published: parseFeedDate(pick('pubDate', 'dc\\:date', 'published', 'updated', 'dc\\:created')),
      summary: htmlToText(pick('description', 'summary', 'content\\:encoded', 'content')),
    });
  });
  return out;
}

const NOISE = 'script, style, noscript, nav, footer, iframe, svg, [role=navigation], [role=banner], [role=contentinfo], [aria-hidden=true]';
const NOISE_NAME = /(^|[\s_-])(gnb|lnb|snb|nav|navbar|menu|megamenu|breadcrumb|breadcrumbs|footer|site-header|sitemap|quick|skip|share|social|pagination|pager|paging)([\s_-]|$)/i;
const GENERIC_LINK = /^((pdf|docx?|xlsx?|zip|hwpx?)\s*(\(.*\))?|download|pdf|view|more|read more|details?|click here|here|open|file|attachment|anexo|descargar|baixar|télécharger|herunterladen|다운로드|다운받기|미리보기|바로보기|ダウンロード|下载|查看|详情|تحميل|عرض|المزيد|\d+(\.\d+)?\s*(kb|mb))$/i;
const DEFAULT_ROWS = 'tr, li, article, dl, .views-row, .list-item, div[class*="item"], div[class*="card"], div[class*="list"] > div, div[class*="row"]';

/** Removes a leading or trailing date (and separators) from a title. */
export function stripDate(title) {
  let t = cleanText(title);
  const date = '(?:令和\\s*(?:元|\\d{1,2})\\s*年\\s*\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日|(?:19|20)\\d{2}\\s*[-./年]\\s*\\d{1,2}\\s*[-./月]\\s*\\d{1,2}\\s*日?\\.?|\\d{1,2}\\s*[-./]\\s*\\d{1,2}\\s*[-./]\\s*(?:19|20)\\d{2})';
  t = asciiDigits(t).replace(new RegExp(`^\\s*[\\[(]?${date}[\\])]?\\s*[-–—|:·,]?\\s*`), '');
  t = t.replace(new RegExp(`\\s*[-–—|:·,]?\\s*[\\[(]?${date}[\\])]?\\s*$`), '');
  return t.trim();
}

/**
 * Items from a listing page: every row (table row, list item, card) that holds both a link and a date.
 * When rows nest, the smallest row that qualifies wins, so headings and wrappers are ignored.
 */
export function parsePage(html, baseUrl, channel = {}) {
  // Block boundaries become spaces so that table cells and list parts do not run together.
  const spaced = String(html).replace(/<br\s*\/?>/gi, ' ').replace(/<\/(td|th|li|div|p|span|h[1-6]|dt|dd|a|time|strong|em|b|label)>/gi, '$& ');
  const $ = cheerio.load(spaced);
  $(NOISE).remove();
  $('[class], [id]').each((_, el) => {
    const n = $(el);
    if (NOISE_NAME.test(`${n.attr('class') || ''} ${n.attr('id') || ''}`) && !n.is('body, main, html')) n.remove();
  });
  const base = $('base[href]').attr('href') ? new URL($('base[href]').attr('href'), baseUrl).toString() : baseUrl;
  const order = channel.dates || 'dmy';
  const rows = [];
  $(channel.rows || DEFAULT_ROWS).each((i, el) => {
    const n = $(el);
    const text = cleanText(n.text());
    if (!text || text.length > 700) return;
    rows.push({ n, text, order: i });
  });
  rows.sort((a, b) => a.text.length - b.text.length);

  const out = [];
  const seen = new Set();
  const pageUrl = baseUrl.replace(/#.*$/, '');
  for (const { n, text, order: pos } of rows) {
    const published = findDate(text, order) || findDate(n.find('[datetime]').attr('datetime') || '', order);
    if (!published) continue;
    let best = null;
    n.find('a[href]').each((_, a) => {
      const el = $(a);
      const href = (el.attr('href') || '').trim();
      if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) return;
      let abs;
      try { abs = new URL(href, base).toString(); } catch { return; }
      if (abs.replace(/#.*$/, '') === pageUrl) return;
      const label = cleanText(el.text()) || cleanText(el.attr('title') || '');
      if (/^\d{1,3}$/.test(label)) return; // pagination
      const score = GENERIC_LINK.test(label) ? 1 : label.length + 10;
      if (!best || score > best.score) best = { abs, label, score };
    });
    if (!best || seen.has(best.abs)) continue;
    let title = best.label;
    if (!title || GENERIC_LINK.test(title) || title.length < 6) {
      const heading = cleanText(n.find('h1,h2,h3,h4,h5,strong,.title,[class*="title"],[class*="subject"]').first().text());
      title = heading || cleanText(best.label ? text.split(best.label).join(' ') : text).replace(/^\d{1,4}\.?\s+/, '');
    }
    title = stripDate(title);
    if (title.length < 4) continue;
    if (title.length > 400) title = `${title.slice(0, 397)}…`;
    seen.add(best.abs);
    out.push({ title, url: best.abs, base, published, pos });
    if (out.length >= 300) break;
  }
  return out.sort((a, b) => a.pos - b.pos).map(({ pos, ...it }) => it);
}

export function parseAny(text, url, channel) {
  return looksLikeFeed(text) ? parseFeed(text, url) : parsePage(text, url, channel);
}

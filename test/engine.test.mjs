// Offline tests for the RegSignal engine. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findDate, parseFeedDate, detectLanguage, normaliseUrl, classifyType, classifyAreas, toCandidate, applyRun,
  buildDigest, digestEmailHtml, digestSubject, digestRss, toCsv, titleKey,
} from '../engine/core.mjs';
import { parseFeed, parsePage, parseAny, parseJson, stripDate, looksLikeFeed } from '../engine/parse.mjs';
import { decode, robotsAllows } from '../engine/fetch.mjs';
import { sendBroadcast } from '../engine/kit.mjs';
import { runAll, readChannel } from '../engine/run.mjs';
import { AUTHORITIES } from '../engine/sources.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = (f) => readFile(path.join(here, 'samples', f), 'utf8');
const A = (code) => AUTHORITIES.find((a) => a.code === code);

test('sources: 17 authorities, unique channel ids, valid URLs', () => {
  assert.equal(AUTHORITIES.length, 17);
  for (const a of AUTHORITIES) {
    const ids = a.channels.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, a.code);
    for (const c of a.channels) {
      assert.ok(['feed', 'page', 'json'].includes(c.kind));
      if (c.blocked) assert.ok(c.blocked.length > 40, 'blocked sources explain why');
      for (const u of [c.url, ...(c.alts || [])]) assert.ok(new URL(u));
    }
  }
  const langs = new Set(AUTHORITIES.flatMap((a) => a.channels.map((c) => c.lang)));
  for (const l of ['en', 'ja', 'zh', 'ko', 'ar', 'pt', 'es', 'de', 'fr']) assert.ok(langs.has(l), l);
});

test('dates in every format regulators use', () => {
  const cases = [
    ['2026-10-22', '2026-10-22'], ['2026.10.22.', '2026-10-22'], ['2026. 10. 22.', '2026-10-22'], ['2026/1/5', '2026-01-05'],
    ['2026年10月8日', '2026-10-08'], ['令和8年10月8日', '2026-10-08'], ['令和元年5月1日', '2019-05-01'],
    ['21/10/2026', '2026-10-21'], ['03.10.2026', '2026-10-03'], ['22 October 2026', '2026-10-22'], ['October 22, 2026', '2026-10-22'],
    ['22 de outubro de 2026', '2026-10-22'], ['15 de octubre de 2026', '2026-10-15'], ['22. Oktober 2026', '2026-10-22'], ['22 octobre 2026', '2026-10-22'],
    ['١٩ أكتوبر ٢٠٢٦', '2026-10-19'], ['٢٢/١٠/٢٠٢٦', '2026-10-22'], ['２０２６年１０月２２日', '2026-10-22'],
    ['Posted 31/02/2026', null], ['no date here', null],
  ];
  for (const [input, want] of cases) assert.equal(findDate(input), want, input);
  assert.equal(findDate('03/04/2026', 'mdy'), '2026-03-04');
  assert.equal(findDate('03/04/2026'), '2026-04-03');
  assert.equal(parseFeedDate('Thu, 22 Oct 2026 14:30:00 EDT'), '2026-10-22');
  assert.equal(parseFeedDate('2026-10-23T09:15:00+01:00'), '2026-10-23');
  assert.equal(parseFeedDate('Wed, 14 Oct 2026 00:30:00 +0900'), '2026-10-14', 'date as written, not shifted to UTC');
  assert.equal(parseFeedDate('2026-10-14T00:30:00+09:00'), '2026-10-14');
});

test('language detection by script', () => {
  assert.equal(detectLanguage('使用上の注意の改訂'), 'ja');
  assert.equal(detectLanguage('关于发布指导原则的通告'), 'zh');
  assert.equal(detectLanguage('薬局方', 'ja'), 'ja');
  assert.equal(detectLanguage('의약품 안전'), 'ko');
  assert.equal(detectLanguage('تحذير'), 'ar');
  assert.equal(detectLanguage('Guía de buenas prácticas', 'es'), 'es');
});

test('URL normalisation removes tracking and fragments', () => {
  assert.equal(normaliseUrl('https://www.FDA.gov/a/b/?utm_source=rss&x=1#top'), 'https://fda.gov/a/b?x=1');
  assert.equal(normaliseUrl('download_file_division.jsp?num_id=1', 'https://cdsco.gov.in/opencms/opencms/en/Notifications/Circulars/'), 'https://cdsco.gov.in/opencms/opencms/en/Notifications/Circulars/download_file_division.jsp?num_id=1');
  assert.equal(normaliseUrl('javascript:void(0)'), null);
});

test('document types in nine languages', () => {
  const cases = [
    ['Draft Guidance: Bioequivalence Studies', null, 'draft'],
    ['Final guidance on process validation', null, 'guideline'],
    ['Circular regarding Schedule M', null, 'circular'],
    ['G.S.R. 123(E) New Drugs and Clinical Trials (Amendment) Rules, 2026', null, 'law'],
    ['Voluntary recall of batch 123', null, 'recall'],
    ['FDA approves first biosimilar', null, 'approval'],
    ['ガイドライン案に関する意見募集について', null, 'draft'],
    ['使用上の注意の改訂指示通知', null, 'safety'],
    ['关于发布化学药物指导原则的通告', null, 'guideline'],
    ['药品召回管理办法', null, 'recall'],
    ['「의약품 등의 안전에 관한 규칙」 일부개정령안 입법예고', null, 'draft'],
    ['바이오시밀러 품질평가 가이드라인', null, 'guideline'],
    ['الهيئة تصدر دليل التسجيل للأجهزة الطبية', null, 'guideline'],
    ['تحذير من منتج تجميل مغشوش', null, 'safety'],
    ['Consulta pública sobre rotulagem', null, 'draft'],
    ['Guía de buenas prácticas de fabricación', null, 'guideline'],
    ['Rückruf einer Charge', null, 'recall'],
    ['Agency news of the week', 'news', 'news'],
    ['Agency safety update on valproate', 'news', 'safety'],
    ['Anything at all', 'law', 'law'],
    ['Meeting highlights', null, 'other'],
  ];
  for (const [title, ch, want] of cases) assert.equal(classifyType(title, ch), want, title);
});

test('product-area tags across languages', () => {
  assert.deepEqual(classifyAreas('Biosimilar adalimumab approved'), ['biosimilar']);
  assert.ok(classifyAreas('ワクチンの品質に関する通知').includes('vaccine'));
  assert.ok(classifyAreas('ワクチンの品質に関する通知').includes('quality'));
  assert.ok(classifyAreas('医疗器械临床试验').includes('device'));
  assert.ok(classifyAreas('医疗器械临床试验').includes('clinical'));
  assert.ok(classifyAreas('lipid nanoparticle mRNA products').includes('nanomedicine'));
  assert.ok(!classifyAreas('Medical device rules').includes('ivd'));
});

test('feeds: RSS and Atom', async () => {
  const rss = parseFeed(await sample('fda-rss.xml'), 'https://www.fda.gov/');
  assert.equal(rss.length, 3);
  assert.equal(rss[0].published, '2026-10-22');
  assert.match(rss[0].summary, /draft guidance/);
  assert.equal(rss[2].url, 'https://www.fda.gov/drugs/item-3');
  assert.equal(rss[2].published, '2026-10-20');
  const atom = parseFeed(await sample('mhra-atom.xml'), 'https://www.gov.uk/');
  assert.equal(atom.length, 2);
  assert.equal(atom[1].url, 'https://www.gov.uk/drug-safety-update/valproate-new-safety-measures');
  assert.ok(looksLikeFeed(await sample('fda-rss.xml')));
  assert.ok(!looksLikeFeed(await sample('cdsco.html')));
});

test('pages: Japanese list (PMDA), ignores navigation and footer', async () => {
  const items = parsePage(await sample('pmda-ja.html'), 'https://www.pmda.go.jp/0017.html', { lang: 'ja' });
  assert.equal(items.length, 3, JSON.stringify(items, null, 1));
  assert.equal(items[0].published, '2026-10-08');
  assert.equal(items[0].title, '安全 使用上の注意の改訂指示通知（医薬品）を掲載しました');
  assert.equal(items[2].published, '2026-09-30');
  assert.equal(items[2].title, 'ワクチンの品質に関する通知');
  assert.equal(items[1].url, 'https://www.pmda.go.jp/review-services/pub-comments/0099.html');
});

test('pages: table with generic download links (CDSCO)', async () => {
  const items = parsePage(await sample('cdsco.html'), 'https://cdsco.gov.in/opencms/opencms/en/Notifications/Circulars/', { dates: 'dmy' });
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Circular regarding the implementation of revised Schedule M (GMP) for MSMEs');
  assert.equal(items[0].published, '2026-10-21');
  assert.equal(items[1].published, '2026-10-03');
});

test('pages: Korean board, Arabic cards, Spanish dates', async () => {
  const ko = parsePage(await sample('mfds-ko.html'), 'https://www.mfds.go.kr/brd/m_209/list.do', {});
  assert.equal(ko.length, 2);
  assert.equal(ko[0].url, 'https://www.mfds.go.kr/brd/m_209/view.do?seq=3689&srchFr=&page=1');
  assert.equal(ko[1].published, '2026-10-22');
  const ar = parsePage(await sample('sfda-ar.html'), 'https://www.sfda.gov.sa/ar/news', {});
  assert.equal(ar.length, 2);
  assert.equal(ar[0].published, '2026-10-22');
  assert.equal(ar[1].published, '2026-10-19');
  const es = parsePage(await sample('cofepris-es.html'), 'https://www.gob.mx/cofepris/archivo/prensa', {});
  assert.deepEqual(es.map((i) => i.published), ['2026-10-22', '2026-10-15']);
});

test('stripDate removes leading and trailing dates only', () => {
  assert.equal(stripDate('2026年10月8日 安全 通知'), '安全 通知');
  assert.equal(stripDate('Notice on GMP - 21/10/2026'), 'Notice on GMP');
  assert.equal(stripDate('Rules, 2026 amendment'), 'Rules, 2026 amendment');
});

test('character sets: Shift_JIS, EUC-KR, GB18030 and meta sniffing', () => {
  const sjis = new Uint8Array([0x93, 0xfa, 0x96, 0x7b]);
  assert.equal(decode(sjis, 'text/html; charset=Shift_JIS'), '日本');
  const meta = new Uint8Array([...new TextEncoder().encode('<meta charset="euc-kr">'), 0xb0, 0xa1]);
  assert.ok(decode(meta, 'text/html').endsWith('가'));
  assert.equal(decode(new Uint8Array([0xd6, 0xd0]), 'text/html; charset=gb2312'), '中');
});

test('robots.txt rules', () => {
  const r = 'User-agent: *\nDisallow: /search\nAllow: /search/public\n\nUser-agent: BadBot\nDisallow: /';
  assert.ok(robotsAllows(r, '/en/news'));
  assert.ok(!robotsAllows(r, '/search?q=x'));
  assert.ok(robotsAllows(r, '/search/public/list'));
  assert.ok(!robotsAllows('User-agent: RegSignal\nDisallow: /', '/a'));
  assert.ok(robotsAllows('', '/a'));
});

function cand(code, chId, title, url, published) {
  const a = A(code);
  const ch = a.channels.find((c) => c.id === chId);
  return toCandidate({ title, url, published }, a, ch);
}

test('change detection: baseline, new, revised, removal safeguards', () => {
  const src = 'CDSCO/circulars';
  const mk = (n, d) => cand('CDSCO', 'circulars', `Circular number ${n}`, `https://cdsco.gov.in/c${n}.pdf`, d);
  const week1 = [mk(1, '2026-10-01'), mk(2, '2026-10-05'), mk(3, '2026-10-10')];
  let r = applyRun({}, [{ sourceId: src, ok: true, items: week1 }], '2026-10-12');
  assert.equal(r.baseline, true);
  assert.equal(r.changes.new.length, 0);
  assert.equal(Object.keys(r.archive.documents).length, 3);

  // Week 2: one new, one retitled, one punctuation fix only; c1 missing but older than the listing window.
  const week2 = [mk(4, '2026-10-15'), cand('CDSCO', 'circulars', 'Circular number 2 (revised)', 'https://cdsco.gov.in/c2.pdf', '2026-10-05'), cand('CDSCO', 'circulars', 'Circular  number 3.', 'https://cdsco.gov.in/c3.pdf', '2026-10-10')];
  r = applyRun(r.archive, [{ sourceId: src, ok: true, items: week2 }], '2026-10-19');
  assert.deepEqual(r.changes.new, [week2[0].id]);
  assert.equal(r.changes.revised.length, 1);
  assert.equal(r.changes.revised[0].changes[0].field, 'title');
  assert.equal(r.archive.documents[week2[2].id].status, 'unchanged');
  assert.equal(r.changes.removed.length, 0, 'c1 is older than anything still listed, so it simply scrolled off');

  // A failed source never removes anything.
  const before = r.archive;
  r = applyRun(before, [{ sourceId: src, ok: false, error: 'HTTP 503', items: [] }], '2026-10-26');
  assert.equal(r.changes.failed.length, 1);
  assert.equal(r.changes.removed.length, 0);

  // c3 disappears from the listing while newer and older items are still there: removed after two healthy runs.
  const week4 = [mk(5, '2026-10-24'), mk(4, '2026-10-15'), cand('CDSCO', 'circulars', 'Circular number 2 (revised)', 'https://cdsco.gov.in/c2.pdf', '2026-10-05')];
  r = applyRun(r.archive, [{ sourceId: src, ok: true, items: week4 }], '2026-11-02');
  assert.equal(r.changes.removed.length, 0);
  r = applyRun(r.archive, [{ sourceId: src, ok: true, items: week4 }], '2026-11-09');
  assert.deepEqual(r.changes.removed, [mk(3).id]);
  assert.equal(r.archive.documents[mk(3).id].status, 'no longer listed');

  // A sudden collapse in item count marks the source suspect and removes nothing.
  r = applyRun(r.archive, [{ sourceId: src, ok: true, items: [] }], '2026-11-16');
  assert.equal(r.changes.broken.length, 1);
  assert.equal(r.archive.sources[src].status, 'suspect');
  assert.equal(r.changes.removed.length, 0);
});

test('digest, email, RSS and CSV outputs', () => {
  const items = [cand('PMDA', 'shinchaku', '使用上の注意の改訂指示通知', 'https://www.pmda.go.jp/x.html', '2026-10-08')];
  let r = applyRun({}, [{ sourceId: 'PMDA/shinchaku', ok: true, items: [cand('PMDA', 'shinchaku', '古いお知らせ', 'https://www.pmda.go.jp/old.html', '2026-09-01')] }, { sourceId: 'FDA/drugs', ok: true, items: [cand('FDA', 'drugs', 'Old item', 'https://fda.gov/o', '2026-01-01')] }], '2026-10-05');
  r = applyRun(r.archive, [{ sourceId: 'PMDA/shinchaku', ok: true, items: [...items, cand('PMDA', 'shinchaku', '古いお知らせ', 'https://www.pmda.go.jp/old.html', '2026-09-01')] }, { sourceId: 'FDA/drugs', ok: false, error: 'HTTP 403', items: [] }], '2026-10-12');
  const d = buildDigest(r.archive, r.changes, { runDate: '2026-10-12T03:00:00Z', today: '2026-10-12', baseline: r.baseline });
  assert.equal(d.totals.new, 1);
  assert.equal(d.new[0].language, 'ja');
  assert.equal(digestSubject(d), 'RegSignal 12 Oct 2026: 1 new');
  const html = digestEmailHtml(d, 'https://example.org/');
  assert.match(html, /使用上の注意の改訂指示通知/);
  assert.match(html, /could not be read fully/);
  assert.match(html, /Made by Khan Gulrez Shagufa Fazal Ahmed/);
  assert.doesNotMatch(html, /<script/);
  const quiet = buildDigest(r.archive, { new: [], revised: [], removed: [], broken: [], failed: [] }, { runDate: '2026-10-19T03:00:00Z', today: '2026-10-19' });
  assert.match(digestSubject(quiet), /no new or revised/);
  assert.match(digestEmailHtml(quiet, 'https://example.org'), /found nothing new/);
  const rss = digestRss([d], 'https://example.org');
  assert.match(rss, /<rss version="2.0">/);
  assert.match(rss, /New · PMDA/);
  const csv = toCsv(Object.values(r.archive.documents));
  assert.ok(csv.startsWith('﻿authority,title'));
  assert.match(csv, /Safety communication/);
});

test('Kit broadcast request', async () => {
  let seen;
  const fake = async (url, opts) => { seen = { url, opts }; return { ok: true, status: 201, text: async () => JSON.stringify({ broadcast: { id: 42 } }) }; };
  const now = new Date('2026-10-26T03:00:00Z');
  const res = await sendBroadcast({ apiKey: 'k', subject: 'S', html: '<p>x</p>', fetchImpl: fake, now });
  assert.deepEqual(res, { ok: true, id: 42, send_at: '2026-10-26T03:05:00.000Z' });
  assert.equal(seen.url, 'https://api.kit.com/v4/broadcasts');
  assert.equal(seen.opts.headers['X-Kit-Api-Key'], 'k');
  const body = JSON.parse(seen.opts.body);
  assert.equal(body.public, false);
  assert.equal(body.content, '<p>x</p>');
  const none = await sendBroadcast({ apiKey: '', subject: 'S', html: '' });
  assert.equal(none.skipped, true);
  const bad = await sendBroadcast({ apiKey: 'k', subject: 'S', html: '', fetchImpl: async () => ({ ok: false, status: 401, text: async () => '{"errors":["The access token is invalid"]}' }) });
  assert.match(bad.error, /401: The access token is invalid/);
});

test('end to end: two runs against saved samples', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'regsignal-'));
  try {
    const files = { 'https://a.test/feed': 'fda-rss.xml', 'https://a.test/page': 'pmda-ja.html', 'https://a.test/alt': 'mfds-ko.html' };
    const getter = async (url) => {
      if (url === 'https://a.test/broken') throw new Error('The site answered HTTP 403.');
      return { url, text: await sample(files[url]) };
    };
    const authorities = [
      { code: 'FDA', channels: [{ id: 'drugs', kind: 'feed', lang: 'en', url: 'https://a.test/feed' }] },
      { code: 'PMDA', channels: [{ id: 'shinchaku', kind: 'page', lang: 'ja', url: 'https://a.test/page' }] },
      { code: 'MFDS', channels: [{ id: 'm_209', kind: 'page', lang: 'ko', url: 'https://a.test/broken', alts: ['https://a.test/alt'] }] },
    ];
    const r1 = await runAll({ dataDir: dir, getter, authorities, now: new Date('2026-10-19T03:00:00Z'), log: () => {} });
    assert.equal(r1.baseline, true);
    assert.equal(r1.digest.totals.documents, 8);
    assert.equal(r1.run.sources['MFDS/m_209'].url, 'https://a.test/alt');
    const docs = JSON.parse(await readFile(path.join(dir, 'documents.json'), 'utf8'));
    assert.equal(docs.count, 8);
    const r2 = await runAll({ dataDir: dir, getter, authorities, now: new Date('2026-10-26T03:00:00Z'), log: () => {} });
    assert.equal(r2.baseline, false);
    assert.equal(r2.digest.totals.new, 0, 'same content a week later: nothing new');
    const index = JSON.parse(await readFile(path.join(dir, 'digests', 'index.json'), 'utf8'));
    assert.equal(index.digests.length, 2);
    const ch = await readChannel(authorities[2], authorities[2].channels[0], getter);
    assert.equal(ch.ok, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('title comparison ignores spacing and punctuation', () => {
  assert.equal(titleKey('Circular  number 3.'), titleKey('Circular number 3'));
  assert.notEqual(titleKey('Circular number 3'), titleKey('Circular number 4'));
});

test('pages where the whole row is a link (HSA) and share links are ignored', async () => {
  const items = parsePage(await sample('hsa.html'), 'https://www.hsa.gov.sg/announcements', { rows: 'a[href^="/announcements/"]' });
  assert.deepEqual(items.map((i) => [i.title, i.published]), [['Haze advisory for blood donors', '2026-10-21'], ['New guidance on cell therapy products', '2026-10-14']]);
  const generic = parsePage(await sample('hsa.html'), 'https://www.hsa.gov.sg/announcements', {});
  assert.ok(!generic.some((i) => /facebook/.test(i.url)));
});

test('JSON reader for the ICH site', async () => {
  const items = parseJson(await sample('ich.json'), 'https://admin.ich.org/api/v1/nodes', { kind: 'json', json: 'ich' });
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://www.ich.org/pressrelease/press-release-ich-assembly-meeting-rio-de-janeiro-june-2026');
  assert.equal(items[0].published, '2026-06-04');
  assert.equal(items[1].published, '2026-09-01');
  assert.equal(items[1].summary, 'Final guideline.');
  assert.throws(() => parseJson('{}', 'x', { kind: 'json', json: 'nope' }));
});

test('blocked sources are listed, not requested; empty feeds are healthy', async () => {
  let asked = 0;
  const getter = async () => { asked++; return { text: '<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>' }; };
  const blocked = await readChannel({ code: 'TGA' }, { id: 'a', kind: 'feed', url: 'https://x.test/a', blocked: 'Refuses connections from cloud data centres, checked on a test date.' }, getter);
  assert.equal(asked, 0);
  assert.equal(blocked.blocked, true);
  const empty = await readChannel({ code: 'EMA' }, { id: 'h', kind: 'feed', url: 'https://x.test/h' }, getter);
  assert.equal(empty.ok, true);
  assert.equal(empty.emptyFeed, true);
  const r = applyRun({}, [blocked, empty], '2026-10-26');
  assert.equal(r.archive.sources['TGA/a'].status, 'blocked');
  assert.equal(r.archive.sources['EMA/h'].status, 'ok');
  assert.equal(r.changes.failed.length, 0);
  assert.equal(r.changes.broken.length, 0);
});

test('undated link lists (ANVISA home page teasers)', () => {
  const html = '<a href="/anvisa/pt-br/assuntos/noticias-anvisa/2026/anvisa-proibe-produtos"><div>FISCALIZAÇÃO</div><h2>Anvisa proíbe produtos de limpeza irregulares</h2><p>Medidas envolvem saneantes</p></a><a href="/anvisa/pt-br/assuntos/noticias-anvisa/2026/anvisa-proibe-produtos"><img src="x.jpg"></a><a href="https://api.whatsapp.com/send?text=/assuntos/noticias-anvisa/2026/x">Compartilhe no Whatsapp</a><a href="/anvisa/pt-br/outra">Outra página qualquer</a>';
  const items = parsePage(html, 'https://www.gov.br/anvisa/pt-br', { undated: true, links: '/assuntos/noticias-anvisa/20' });
  assert.deepEqual(items.map((i) => [i.title, i.published]), [['Anvisa proíbe produtos de limpeza irregulares', null]]);
  assert.equal(classifyType('Peptides health risks'), 'safety');
});

test('a source read for the first time (new or repaired) does not flood the digest', () => {
  const a = cand('FDA', 'drugs', 'Existing item', 'https://fda.gov/e', '2026-10-01');
  let r = applyRun({}, [{ sourceId: 'FDA/drugs', ok: true, items: [a] }, { sourceId: 'ICH/news', ok: false, error: 'HTTP 404', items: [] }], '2026-10-24');
  const ich = [cand('ICH', 'news', 'E6(R3) reaches Step 4', 'https://www.ich.org/news/e6', '2026-09-01')];
  r = applyRun(r.archive, [{ sourceId: 'FDA/drugs', ok: true, items: [a] }, { sourceId: 'ICH/news', ok: true, items: ich }], '2026-10-26');
  assert.equal(r.changes.new.length, 0, 'first healthy read of ICH is its starting point');
  const more = [cand('ICH', 'news', 'Q1 stability guideline adopted', 'https://www.ich.org/news/q1', '2026-10-30'), ...ich];
  r = applyRun(r.archive, [{ sourceId: 'FDA/drugs', ok: true, items: [a] }, { sourceId: 'ICH/news', ok: true, items: more }], '2026-11-02');
  assert.deepEqual(r.changes.new, [more[0].id]);
});

test('one-day date differences are not revisions; start-over runs report nothing', () => {
  const v1 = cand('PMDA', 'top-all', 'Revisions of PRECAUTIONS', 'https://www.pmda.go.jp/p.html', '2026-10-13');
  let r = applyRun({}, [{ sourceId: 'PMDA/top-all', ok: true, items: [v1] }], '2026-10-24');
  r = applyRun(r.archive, [{ sourceId: 'PMDA/top-all', ok: true, items: [{ ...v1, published: '2026-10-14' }] }], '2026-10-26');
  assert.equal(r.changes.revised.length, 0);
  const v3 = { ...v1, title: 'Revisions of PRECAUTIONS (corrected)' };
  const r2 = applyRun(r.archive, [{ sourceId: 'PMDA/top-all', ok: true, items: [v3, cand('PMDA', 'top-all', 'Another', 'https://www.pmda.go.jp/q.html', '2026-10-20')] }], '2026-10-26', { startOver: true });
  assert.equal(r2.baseline, true);
  assert.equal(r2.changes.new.length + r2.changes.revised.length, 0);
  assert.equal(r2.archive.documents[v1.id].title, 'Revisions of PRECAUTIONS (corrected)');
});

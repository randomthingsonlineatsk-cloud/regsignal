/*!
 * RegSignal core: dates, languages, classification, change detection and digests.
 * Copyright 2026 Khan Gulrez Shagufa Fazal Ahmed. Licensed under the Apache License 2.0.
 * No network access and no dependencies, so every rule here is covered by offline tests.
 */

// ---------------------------------------------------------------- text helpers

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
const FULLWIDTH_DIGITS = /[０-９]/g;

export function asciiDigits(s) {
  return String(s || '')
    .replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10))
    .replace(FULLWIDTH_DIGITS, (d) => String(d.charCodeAt(0) - 0xff10));
}

export function cleanText(s) {
  return String(s || '').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
}

/** Title used for comparison only: case, spacing and punctuation removed. */
export function titleKey(s) {
  return cleanText(asciiDigits(s)).toLowerCase().normalize('NFKC').replace(/[\p{P}\p{S}\s]+/gu, '');
}

// ---------------------------------------------------------------- dates

const MONTHS = {
  // English
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  // Portuguese
  janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  // Spanish
  enero: 1, febrero: 2, marzo: 3, mayo: 5, junio: 6, julio: 7, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  // French
  janvier: 1, 'février': 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, 'août': 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, 'décembre': 12, decembre: 12,
  // German
  januar: 1, 'jänner': 1, februar: 2, 'märz': 3, maerz: 3, juni: 6, juli: 7, oktober: 10, dezember: 12,
  // Arabic (Gregorian month names used in the Gulf and the Levant)
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'ابريل': 4, 'إبريل': 4, 'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8, 'اغسطس': 8,
  'سبتمبر': 9, 'أكتوبر': 10, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
  'كانون الثاني': 1, 'شباط': 2, 'آذار': 3, 'نيسان': 4, 'أيار': 5, 'حزيران': 6, 'تموز': 7, 'آب': 8, 'أيلول': 9, 'تشرين الأول': 10, 'تشرين الثاني': 11, 'كانون الأول': 12,
};
const MONTH_WORDS = Object.keys(MONTHS).sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

function iso(y, m, d) {
  y = Number(y); m = Number(m); d = Number(d);
  if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * Finds the first calendar date in a piece of text, in any of the formats regulators use.
 * order: 'dmy' (default, used by most of the world) or 'mdy' for numeric dates like 03/04/2026.
 * Returns YYYY-MM-DD or null.
 */
export function findDate(text, order = 'dmy') {
  const s = asciiDigits(text);
  let m;
  // Japanese era: 令和8年10月22日 (Reiwa 1 = 2019)
  if ((m = s.match(/令和\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/))) {
    return iso(2018 + (m[1] === '元' ? 1 : Number(m[1])), m[2], m[3]);
  }
  // 2026年10月22日 / 2026-10-22 / 2026.10.22 / 2026/10/22 / 2026. 10. 22.
  if ((m = s.match(/(?<!\d)((?:19|20)\d{2})\s*[-./年]\s*(\d{1,2})\s*[-./月]\s*(\d{1,2})(?!\d)/))) {
    const r = iso(m[1], m[2], m[3]);
    if (r) return r;
  }
  // 22/10/2026, 22.10.2026, 22-10-2026 (or month first when order is mdy)
  if ((m = s.match(/(?<!\d)(\d{1,2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*((?:19|20)\d{2})(?!\d)/))) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const r = order === 'mdy' ? (iso(m[3], a, b) || iso(m[3], b, a)) : (iso(m[3], b, a) || iso(m[3], a, b));
    if (r) return r;
  }
  const lower = s.toLowerCase();
  // 22 October 2026, 22 de outubro de 2026, 22. Oktober 2026, 22 أكتوبر 2026
  const reDmy = new RegExp(`(?<!\\d)(\\d{1,2})(?:er|st|nd|rd|th)?\\.?\\s*(?:de\\s+)?(${MONTH_WORDS})\\.?,?\\s*(?:de\\s+)?((?:19|20)\\d{2})`, 'u');
  if ((m = lower.match(reDmy))) {
    const r = iso(m[3], MONTHS[m[2]], m[1]);
    if (r) return r;
  }
  // October 22, 2026 / Oct. 22 2026
  const reMdy = new RegExp(`(${MONTH_WORDS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+((?:19|20)\\d{2})`, 'u');
  if ((m = lower.match(reMdy))) {
    const r = iso(m[3], MONTHS[m[1]], m[2]);
    if (r) return r;
  }
  return null;
}

/** Dates from feeds: RFC 822, ISO 8601, or anything findDate understands. */
export function parseFeedDate(s) {
  if (!s) return null;
  const t = cleanText(s);
  // The calendar date as the regulator wrote it, never shifted to another time zone.
  const direct = /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
  if (direct && iso(...direct.split('-'))) return direct;
  const rfc = /^(?:[A-Za-z]{3},?\s+)?(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(t);
  if (rfc && MONTHS[rfc[2].toLowerCase()]) {
    const r = iso(rfc[3], MONTHS[rfc[2].toLowerCase()], rfc[1]);
    if (r) return r;
  }
  const ms = Date.parse(t);
  if (!Number.isNaN(ms)) {
    const d = new Date(ms);
    if (d.getUTCFullYear() >= 1990) return d.toISOString().slice(0, 10);
  }
  return findDate(t);
}

// ---------------------------------------------------------------- language

export function detectLanguage(text, fallback = 'en') {
  const s = String(text || '');
  if (/[぀-ヿ]/.test(s)) return 'ja';
  if (/[가-힯]/.test(s)) return 'ko';
  if (/[一-鿿]/.test(s)) return fallback === 'ja' ? 'ja' : 'zh';
  if (/[؀-ۿ]/.test(s)) return 'ar';
  return fallback;
}

export const LANGUAGE_NAMES = {
  en: 'English', ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ar: 'Arabic', pt: 'Portuguese', es: 'Spanish', de: 'German', fr: 'French',
};

// ---------------------------------------------------------------- URLs and ids

const TRACKING = /^(utm_|fbclid|gclid|mc_|_ga|cid$|source$|ref$)/i;

export function normaliseUrl(href, base) {
  let u;
  try { u = new URL(String(href).trim(), base); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.toString().replace(/^http:/, 'https:');
}

/** Stable record id: authority code plus the normalised official URL. */
export function recordId(authority, url) {
  return `${authority.toLowerCase()}:${url.replace(/^https:\/\//, '')}`;
}

// ---------------------------------------------------------------- classification

export const TYPES = {
  guideline: 'Guideline (final)',
  draft: 'Draft guidance or consultation',
  law: 'Law, rule or gazette notification',
  circular: 'Circular, notice or order',
  safety: 'Safety communication',
  recall: 'Recall or shortage',
  approval: 'Approval or product decision',
  news: 'News or press release',
  other: 'Other',
};

// Checked in this order; the first matching type wins. Keywords are lower case; CJK and Arabic are matched as substrings.
const TYPE_RULES = [
  ['draft', [
    'draft guidance', 'draft guideline', 'draft for comment', 'consultation', 'public comment', 'comments requested', 'call for comment', 'request for comment', 'step 2', 'concept paper',
    'consulta pública', 'consulta publica', 'proposta', 'proyecto de norma', 'consulta', 'anteproyecto', 'entwurf', 'vernehmlassung', 'projet de', 'avant-projet',
    '意見募集', 'パブリックコメント', '案に関する', '征求意见', '征求', '意见稿', '입법예고', '행정예고', '의견', '예고', 'مسودة', 'استطلاع', 'طلب مرئيات', 'مرئيات',
  ]],
  ['recall', [
    'recall', 'shortage', 'withdrawal of batch', 'market withdrawal', 'rappel', 'pénurie', 'rückruf', 'versorgungsengpass', 'recolhimento', 'desabastecimento', 'retiro', 'desabasto',
    '回収', '供給', '召回', '短缺', '회수', '공급 부족', '품절', 'سحب', 'استدعاء', 'نقص',
  ]],
  ['guideline', [
    'guideline', 'guidance', 'guide', 'q&a', 'questions and answers', 'reflection paper', 'points to consider', 'manual', 'standard',
    'ligne directrice', 'lignes directrices', 'leitlinie', 'wegleitung', 'merkblatt', 'guia', 'guía', 'orientação', 'orientaciones', 'manual',
    'ガイドライン', '指針', '手引き', 'ガイダンス', '指导原则', '指南', '技术要求', '가이드라인', '안내서', '지침', '가이드', 'دليل', 'إرشادات', 'ارشادات',
  ]],
  ['safety', [
    'safety', 'warning', 'dhpc', 'dear healthcare professional', 'risk', 'adverse', 'pharmacovigilance', 'medwatch', 'alert', 'boxed warning', 'precautions',
    'sécurité', 'mise en garde', 'sicherheit', 'warnung', 'risiko', 'segurança', 'seguridad', 'alerta', 'farmacovigil', 'riesgo', 'risco',
    '安全', '副作用', '使用上の注意', '注意喚起', '不良反应', '警戒', '风险', '안전', '위해', '부작용', '경고', 'سلامة', 'تحذير', 'مخاطر', 'تنبيه',
  ]],
  ['law', [
    'gazette', 'g.s.r', 'gsr ', 's.o.', 'notification no', 'regulation', 'regulations', 'act ', ' act', 'rules,', 'rules ', 'amendment rules', 'statutory', 'legislative instrument', 'ordinance', 'decree', 'resolution rdc', 'rdc ',
    'loi', 'règlement', 'ordonnance', 'verordnung', 'gesetz', 'resolução', 'resolucao', 'portaria', 'instrução normativa', 'decreto', 'norma oficial', 'nom-', 'reglamento', 'acuerdo',
    '省令', '告示', '政令', '法律', '规定', '办法', '条例', '法规', '고시', '법률', '시행령', '시행규칙', '훈령', '예규', 'نظام', 'لائحة', 'اللائحة', 'قرار',
  ]],
  ['circular', [
    'circular', 'notice', 'order', 'o.m.', 'office memorandum', 'public notice', 'notification', 'letter to', 'announcement',
    'communiqué', 'avis', 'mitteilung', 'circular', 'comunicado', 'aviso', 'ofício', 'oficio', 'nota técnica',
    '通知', '事務連絡', '公告', '通告', '公示', '공지', '공고', '안내', 'تعميم', 'إشعار', 'اشعار', 'إعلان',
  ]],
  ['approval', [
    'approved', 'approves', 'approve', 'approval', 'aprova', 'aprueba', 'authorised', 'authorized', 'authorisation', 'marketing authorization', 'prequalified', 'designation', 'epar', 'positive opinion', 'summary of opinion', 'withdrawn application', 'paediatric investigation plan', 'biosimilar approved',
    'autorisation', 'zulassung', 'zugelassen', 'registro', 'aprovação', 'aprovado', 'aprobación', 'autorización', 'registro sanitario',
    '承認', '审批', '批准', '注册', '허가', '승인', 'تسجيل', 'اعتماد', 'موافقة',
  ]],
  ['news', [
    'news', 'press release', 'media release', 'statement', 'announces', 'nouvelles', 'actualité', 'medienmitteilung', 'notícia', 'noticia', 'prensa',
    'お知らせ', '新闻', '보도자료', 'خبر',
  ]],
];

function hasWord(hay, word) {
  if (/[^\x00-\x7f]/.test(word) || /[ .,&]/.test(word)) return hay.includes(word);
  return new RegExp(`(?<![a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es)?(?![a-z])`).test(hay);
}

/**
 * Document type: the channel's own type comes first unless a stronger title keyword says the item is
 * a draft, recall or safety notice; otherwise title keywords decide; otherwise "other".
 */
export function classifyType(title, channelType) {
  const t = ` ${cleanText(title).toLowerCase()} `;
  const match = (type) => TYPE_RULES.find((r) => r[0] === type)[1].some((w) => hasWord(t, w));
  if (channelType) {
    if (channelType !== 'draft' && match('draft') && !/\bfinal\b/.test(t)) return 'draft';
    if (['news', 'circular', 'other'].includes(channelType)) {
      for (const strong of ['recall', 'safety', 'guideline', 'law']) if (match(strong)) return strong;
    }
    return channelType;
  }
  for (const [type, words] of TYPE_RULES) if (words.some((w) => hasWord(t, w))) return type;
  return 'other';
}

export const AREAS = {
  'small-molecule': ['small molecule', 'chemical drug', 'tablet', 'capsule', '化学药', '低分子', '화학의약품', 'medicamento sintético'],
  biologic: ['biologic', 'biological', 'monoclonal', 'antibody', 'protein', 'blood product', 'plasma', 'biotherapeutic', 'biologique', 'biologisch', 'biológico', '生物', 'バイオ', '抗体', '생물', '항체', 'بيولوجي', 'حيوي'],
  vaccine: ['vaccine', 'vaccination', 'immunisation', 'immunization', 'vaccin', 'impfstoff', 'impfung', 'vacina', 'vacuna', 'ワクチン', '疫苗', '백신', 'لقاح', 'لقاحات'],
  cgt: ['cell therapy', 'gene therapy', 'cell and gene', 'atmp', 'advanced therapy', 'car-t', 'regenerative', 'thérapie génique', 'gentherapie', 'terapia gênica', 'terapia celular', 'terapia génica', '再生医療', '遺伝子治療', '细胞治疗', '基因治疗', '세포치료', '유전자치료', '첨단바이오', 'العلاج الجيني', 'العلاج الخلوي'],
  biosimilar: ['biosimilar', 'similar biological', 'biosimilaire', 'biossimilar', 'biocomparable', 'バイオシミラー', 'バイオ後続品', '生物类似药', '바이오시밀러', '동등생물의약품', 'مثيل حيوي', 'البدائل الحيوية'],
  generic: ['generic', 'bioequivalence', 'abbreviated new drug', 'anda', 'générique', 'generika', 'genérico', 'bioequivalência', 'bioequivalencia', '後発', 'ジェネリック', '仿制药', '一致性评价', '제네릭', '생물학적동등성', 'جنيس', 'التكافؤ الحيوي'],
  device: ['medical device', 'device', 'implant', 'software as a medical device', 'samd', 'dispositif médical', 'medizinprodukt', 'dispositivo médico', 'dispositivos médicos', 'produto para saúde', '医療機器', '医疗器械', '의료기기', 'أجهزة طبية', 'جهاز طبي', 'الأجهزة الطبية'],
  ivd: ['in vitro diagnostic', 'ivd', 'diagnostic test', 'diagnostic kit', 'diagnostic in vitro', 'in-vitro-diagnostik', 'diagnóstico in vitro', '体外診断', '体外诊断', '체외진단', 'التشخيص المختبري'],
  herbal: ['herbal', 'traditional medicine', 'complementary medicine', 'botanical', 'phytothérap', 'pflanzlich', 'fitoterápico', 'herbolario', '漢方', '生薬', '中药', '中成药', '한약', '생약', 'عشبي', 'الطب التقليدي'],
  cosmetic: ['cosmetic', 'cosmétique', 'kosmetik', 'cosmético', '化粧品', '化妆品', '화장품', 'مستحضرات التجميل', 'تجميل'],
  paediatric: ['paediatric', 'pediatric', 'children', 'child', 'neonat', 'infant', 'pip ', 'pédiatrique', 'pädiatrisch', 'pediátrico', '小児', '儿童', '儿科', '소아', '어린이', 'الأطفال'],
  orphan: ['orphan', 'rare disease', 'rare diseases', 'orphelin', 'seltene krankheit', 'doença rara', 'enfermedad rara', 'huérfano', '希少疾病', '罕见病', '희귀', 'الأمراض النادرة', 'يتيم'],
  nanomedicine: ['nanomedicine', 'nanoparticle', 'nanomaterial', 'liposom', 'lipid nanoparticle', 'nanotechnolog', 'nanomédecine', 'nanopartícula', 'ナノ', '纳米', '나노', 'النانو'],
  quality: ['gmp', 'quality', 'cmc', 'manufacturing', 'stability', 'impurit', 'pharmacopoeia', 'pharmacopeia', 'nitrosamine', 'inspection', 'qualité', 'qualität', 'qualidade', 'calidad', 'boas práticas de fabricação', 'buenas prácticas de fabricación', '品質', '薬局方', '质量', '药典', 'gmp', '품질', '약전', 'جودة', 'التصنيع'],
  clinical: ['clinical trial', 'clinical study', 'clinical investigation', 'gcp', 'good clinical practice', 'essai clinique', 'klinische prüfung', 'ensaio clínico', 'ensayo clínico', '治験', '臨床試験', '临床试验', '临床', '임상시험', '임상', 'التجارب السريرية', 'دراسة سريرية'],
  pv: ['pharmacovigilance', 'adverse event', 'adverse reaction', 'psur', 'pbrer', 'rmp', 'risk management plan', 'signal', 'farmacovigilância', 'farmacovigilancia', 'pharmacovigilance', '副作用', '安全性定期報告', '药物警戒', '不良反应', '약물감시', '이상사례', 'التيقظ الدوائي', 'الآثار الجانبية'],
};

export function classifyAreas(text) {
  const t = ` ${cleanText(text).toLowerCase()} `;
  return Object.entries(AREAS).filter(([, words]) => words.some((w) => hasWord(t, w))).map(([k]) => k);
}

export const AREA_NAMES = {
  'small-molecule': 'Small molecule', biologic: 'Biologic', vaccine: 'Vaccine', cgt: 'Cell and gene therapy', biosimilar: 'Biosimilar', generic: 'Generic',
  device: 'Medical device', ivd: 'IVD', herbal: 'Herbal or traditional', cosmetic: 'Cosmetic', paediatric: 'Paediatric', orphan: 'Orphan or rare disease',
  nanomedicine: 'Nanomedicine', quality: 'Quality (CMC/GMP)', clinical: 'Clinical trials', pv: 'Pharmacovigilance',
};

// ---------------------------------------------------------------- item → record

/**
 * Turns a raw item from a parser into a clean candidate record. Returns null when the item has no
 * usable title or link.
 */
export function toCandidate(raw, authority, channel) {
  const title = cleanText(raw.title);
  const url = normaliseUrl(raw.url, raw.base);
  if (!title || title.length < 4 || !url) return null;
  const language = detectLanguage(title, channel.lang || 'en');
  const summary = raw.summary ? cleanText(raw.summary).slice(0, 600) : '';
  const titleEn = raw.title_en ? cleanText(raw.title_en) : '';
  return {
    id: recordId(authority.code, url),
    authority: authority.code,
    title,
    title_en: titleEn && titleEn !== title ? titleEn : '',
    url,
    published: raw.published || null,
    type: classifyType(`${title} ${titleEn}`, channel.type),
    areas: classifyAreas(`${title} ${titleEn} ${summary}`),
    summary,
    source: `${authority.code}/${channel.id}`,
    language,
  };
}

// ---------------------------------------------------------------- change detection

export const REMOVE_AFTER_MISSES = 2;

/**
 * Compares this run's results with the archive and returns the updated archive plus what changed.
 *
 * archive  : { documents: {id: record}, sources: {sourceId: state} }
 * results  : [{ sourceId, ok, error, items: [candidate] }]
 * today    : 'YYYY-MM-DD'
 * baseline : true when the archive is empty (first run): everything is recorded, nothing reported as new
 */
export function applyRun(archive, results, today, opts = {}) {
  const docs = { ...(archive.documents || {}) };
  const srcState = JSON.parse(JSON.stringify(archive.sources || {}));
  const baseline = !!opts.startOver || Object.keys(docs).length === 0;
  const changes = { new: [], revised: [], removed: [], broken: [], failed: [] };
  const seenNow = new Set();

  for (const r of results) {
    const st = srcState[r.sourceId] || (srcState[r.sourceId] = { counts: [], last_ok: null, last_error: null, status: 'new' });
    st.last_attempt = today;
    // A source read successfully for the first time (new or just repaired) sets its own starting point:
    // its items are recorded but not reported as new.
    const sourceBaseline = baseline || !st.last_ok;
    st.url_used = r.urlUsed || st.url_used || null;
    if (r.blocked) {
      st.status = 'blocked';
      st.last_error = r.error;
      st.items = 0;
      continue;
    }
    if (!r.ok) {
      st.status = 'failed';
      st.last_error = r.error || 'unknown error';
      changes.failed.push({ source: r.sourceId, error: st.last_error });
      continue;
    }
    // Deduplicate within the channel.
    const items = [];
    const ids = new Set();
    for (const it of r.items) if (it && !ids.has(it.id)) { ids.add(it.id); items.push(it); }

    const avg = st.counts.length ? st.counts.reduce((a, b) => a + b, 0) / st.counts.length : null;
    const broken = !r.emptyFeed && (items.length === 0 || (avg !== null && st.counts.length >= 2 && items.length < avg / 2));
    st.counts = [...st.counts, items.length].slice(-8);
    if (broken) {
      st.status = 'suspect';
      st.last_error = items.length === 0 ? 'The page or feed was read but no items were found (the site layout may have changed).' : `Only ${items.length} items found, under half the usual ${Math.round(avg)}.`;
      changes.broken.push({ source: r.sourceId, error: st.last_error, items: items.length });
    } else {
      st.status = 'ok';
      st.last_ok = today;
      st.last_error = r.emptyFeed && !items.length ? 'The feed is valid but has no items at the moment.' : null;
    }
    st.items = items.length;
    st.oldest_listed = items.map((i) => i.published).filter(Boolean).sort()[0] || null;
    st.healthy = !broken;

    for (const it of items) {
      seenNow.add(it.id);
      const prev = docs[it.id];
      if (!prev) {
        // A new URL whose title matches a known document from the same authority is a revision of it.
        docs[it.id] = { ...it, first_seen: today, last_seen: today, status: sourceBaseline || broken ? 'unchanged' : 'new', misses: 0, history: [] };
        if (!sourceBaseline && !broken) changes.new.push(it.id);
        continue;
      }
      const rec = { ...prev, last_seen: today, misses: 0 };
      const what = [];
      if (titleKey(prev.title) !== titleKey(it.title)) what.push({ field: 'title', from: prev.title, to: it.title });
      else if (prev.title !== it.title) rec.title = it.title; // spacing or punctuation fix: silently updated
      if (it.published && prev.published && it.published !== prev.published) {
        // A one-day difference is a time-zone artefact (the same item in two feeds), not a revision.
        const days = Math.abs(Date.parse(it.published) - Date.parse(prev.published)) / 864e5;
        if (days > 1) what.push({ field: 'published', from: prev.published, to: it.published });
      }
      for (const w of what) rec[w.field] = w.to;
      if (!prev.published && it.published) rec.published = it.published;
      if (it.title_en && !prev.title_en) rec.title_en = it.title_en;
      if (it.summary && !prev.summary) rec.summary = it.summary;
      rec.type = it.type; rec.areas = it.areas; rec.language = it.language;
      if (what.length && !baseline) {
        rec.status = 'revised';
        rec.history = [...(prev.history || []), { date: today, changes: what }];
        changes.revised.push({ id: it.id, changes: what });
      } else {
        rec.status = prev.status === 'no longer listed' ? 'unchanged' : (prev.status === 'new' || prev.status === 'revised' ? 'unchanged' : prev.status);
        if (prev.status === 'no longer listed') rec.history = [...(prev.history || []), { date: today, changes: [{ field: 'listed', from: 'no', to: 'yes' }] }];
      }
      docs[it.id] = rec;
    }
  }

  // Items not seen this run: only counted as missing when their own source was read healthily and the
  // item is recent enough that it should still be on the listing (listings show only the latest page).
  const okSources = new Set(results.filter((r) => r.ok && srcState[r.sourceId]?.healthy).map((r) => r.sourceId));
  for (const [id, rec] of Object.entries(docs)) {
    if (seenNow.has(id) || !okSources.has(rec.source) || rec.status === 'no longer listed') continue;
    const oldest = srcState[rec.source].oldest_listed;
    if (!rec.published || !oldest || rec.published < oldest) continue;
    const misses = (rec.misses || 0) + 1;
    if (misses >= REMOVE_AFTER_MISSES) {
      docs[id] = { ...rec, misses, status: 'no longer listed', history: [...(rec.history || []), { date: today, changes: [{ field: 'listed', from: 'yes', to: 'no' }] }] };
      changes.removed.push(id);
    } else {
      docs[id] = { ...rec, misses };
    }
  }
  return { archive: { documents: docs, sources: srcState }, changes, baseline };
}

// ---------------------------------------------------------------- digest

export function buildDigest(archive, changes, meta) {
  const docs = archive.documents;
  const pick = (id) => {
    const d = docs[id];
    return d && { id: d.id, authority: d.authority, title: d.title, title_en: d.title_en, url: d.url, published: d.published, type: d.type, areas: d.areas, language: d.language, source: d.source };
  };
  const byAuth = (a, b) => a.authority.localeCompare(b.authority) || String(b.published || '').localeCompare(String(a.published || ''));
  return {
    run_date: meta.runDate,
    date: meta.today,
    baseline: !!meta.baseline,
    totals: {
      new: changes.new.length, revised: changes.revised.length, removed: changes.removed.length,
      failed: changes.failed.length, suspect: changes.broken.length, documents: Object.keys(docs).length,
    },
    new: changes.new.map(pick).filter(Boolean).sort(byAuth),
    revised: changes.revised.map((r) => ({ ...pick(r.id), changes: r.changes })).filter((r) => r.id).sort(byAuth),
    removed: changes.removed.map(pick).filter(Boolean).sort(byAuth),
    failed: changes.failed,
    suspect: changes.broken,
  };
}

// ---------------------------------------------------------------- outputs

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
}

export function digestSubject(digest) {
  const t = digest.totals;
  const when = formatDate(digest.date);
  if (!t.new && !t.revised) return `RegSignal ${when}: no new or revised documents this week`;
  const parts = [];
  if (t.new) parts.push(`${t.new} new`);
  if (t.revised) parts.push(`${t.revised} revised`);
  return `RegSignal ${when}: ${parts.join(', ')}`;
}

function groupByAuthority(list) {
  const g = new Map();
  for (const it of list) { if (!g.has(it.authority)) g.set(it.authority, []); g.get(it.authority).push(it); }
  return g;
}

/** Email body (HTML) for the weekly broadcast. Kit adds its own footer with the unsubscribe link. */
export function digestEmailHtml(digest, siteUrl) {
  const t = digest.totals;
  const site = siteUrl.replace(/\/$/, '');
  const row = (it, extra = '') => `<li style="margin:0 0 10px"><a href="${escapeHtml(it.url)}" style="color:#1a5fb4">${escapeHtml(it.title)}</a>${it.title_en ? `<br><span style="color:#555">${escapeHtml(it.title_en)}</span>` : ''}<br><span style="color:#666;font-size:13px">${escapeHtml(TYPES[it.type] || it.type)}${it.published ? ` · ${formatDate(it.published)}` : ''}${extra}</span></li>`;
  const section = (heading, list, extraFn) => {
    if (!list.length) return '';
    let html = `<h2 style="font-size:18px;margin:24px 0 8px">${heading}</h2>`;
    for (const [auth, items] of groupByAuthority(list)) {
      html += `<h3 style="font-size:15px;margin:16px 0 6px">${escapeHtml(auth)} (${items.length})</h3><ul style="padding-left:18px;margin:0">${items.map((i) => row(i, extraFn ? extraFn(i) : '')).join('')}</ul>`;
    }
    return html;
  };
  const changed = (i) => ` · changed: ${escapeHtml(i.changes.map((c) => c.field === 'title' ? 'title' : c.field === 'published' ? `date ${formatDate(c.from)} → ${formatDate(c.to)}` : c.field).join(', '))}`;
  let html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1f;max-width:640px">`;
  html += `<p style="margin:0 0 4px;font-size:13px;color:#666">RegSignal weekly digest · ${formatDate(digest.date)}</p>`;
  if (!t.new && !t.revised) {
    html += `<h1 style="font-size:22px;margin:0 0 12px">No new or revised documents this week</h1><p>RegSignal checked all 17 regulators and found nothing new or revised since last week.</p>`;
  } else {
    html += `<h1 style="font-size:22px;margin:0 0 12px">${t.new} new · ${t.revised} revised</h1>`;
    html += `<p style="margin:0 0 8px">Titles are shown as the regulator published them, in the original language.</p>`;
    html += section('New documents', digest.new) + section('Revised documents', digest.revised, changed);
  }
  if (digest.removed.length) html += `<p style="color:#555">${digest.removed.length} document${digest.removed.length > 1 ? 's are' : ' is'} no longer listed by the regulator. The records are kept on the website.</p>`;
  const problems = digest.failed.length + digest.suspect.length;
  if (problems) html += `<p style="color:#8a4b00">${problems} source${problems > 1 ? 's' : ''} could not be read fully this week. Details are on the <a href="${site}/#health">source health page</a>.</p>`;
  html += `<p style="margin:24px 0 8px"><a href="${site}/" style="background:#1a5fb4;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open this week on RegSignal</a></p>`;
  html += `<p style="font-size:12px;color:#666;margin-top:24px">RegSignal lists changes on official regulator websites. It does not interpret them, and the official text always prevails. Made by Khan Gulrez Shagufa Fazal Ahmed. Free and open source.</p></div>`;
  return html;
}

/** RSS 2.0 feed of weekly digests (newest first). */
export function digestRss(digests, siteUrl) {
  const site = siteUrl.replace(/\/$/, '');
  const items = digests.map((d) => {
    const lines = [...d.new.map((i) => `New · ${i.authority}: ${i.title}`), ...d.revised.map((i) => `Revised · ${i.authority}: ${i.title}`)];
    const desc = d.baseline ? `First run: ${d.totals.documents} documents recorded as the starting point.` : (lines.length ? lines.slice(0, 200).join('\n') : 'No new or revised documents this week.');
    return `<item><title>${escapeHtml(d.baseline ? `RegSignal started tracking ${d.totals.documents} documents` : digestSubject(d))}</title><link>${site}/#week=${d.date}</link><guid isPermaLink="false">regsignal-${d.date}</guid><pubDate>${new Date(d.run_date).toUTCString()}</pubDate><description>${escapeHtml(desc)}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>RegSignal weekly digest</title><link>${site}/</link><description>New and revised official documents from 17 drug regulators, every Monday.</description><language>en</language>${items}</channel></rss>\n`;
}

/** CSV with a BOM so Excel opens non-Latin titles correctly. */
export function toCsv(records) {
  const cols = ['authority', 'title', 'title_en', 'type', 'areas', 'published', 'first_seen', 'status', 'language', 'url'];
  const cell = (v) => {
    const s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(','), ...records.map((r) => cols.map((c) => cell(c === 'type' ? TYPES[r.type] || r.type : r[c])).join(','))].join('\r\n');
}

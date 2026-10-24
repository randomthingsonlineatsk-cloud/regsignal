/*!
 * RegSignal source list. Copyright 2026 Khan Gulrez Shagufa Fazal Ahmed. Apache-2.0.
 *
 * One entry per authority. Each authority has one or more "channels": an RSS/Atom feed or an
 * official listing page. A channel may list alternative URLs; the first one that works is used.
 *
 * Channel fields
 *   id      short stable id, unique within the authority (never change it once data exists)
 *   kind    "feed" or "page"
 *   url     address to read; alts: further addresses to try if the first fails
 *   lang    language of the titles (ISO code); detected from the script if left out
 *   label   human name shown on the source health page
 *   type    document type every item from this channel gets, unless a title keyword says otherwise
 *   rows    (pages) CSS selector for one listing row; a generic finder is used when left out
 *   dates   (pages) "dmy" or "mdy" for numeric dates like 03/04/2026 (default dmy)
 */

export const AUTHORITIES = [
  {
    code: 'FDA', name: 'US Food and Drug Administration', region: 'United States', home: 'https://www.fda.gov',
    channels: [
      { id: 'drugs', kind: 'feed', lang: 'en', label: "What's New: Drugs", url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml' },
      { id: 'biologics', kind: 'feed', lang: 'en', label: "What's New: Biologics", url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/biologics/rss.xml' },
      { id: 'press', kind: 'feed', lang: 'en', label: 'Press releases', type: 'news', url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml' },
      { id: 'medwatch', kind: 'feed', lang: 'en', label: 'MedWatch safety alerts', type: 'safety', url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml' },
      { id: 'recalls', kind: 'feed', lang: 'en', label: 'Recalls', type: 'recall', url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml' },
    ],
  },
  {
    code: 'EMA', name: 'European Medicines Agency', region: 'European Union', home: 'https://www.ema.europa.eu',
    channels: [
      { id: 'news', kind: 'feed', lang: 'en', label: 'News and press releases', type: 'news', url: 'https://www.ema.europa.eu/en/news.xml' },
      { id: 'whatsnew', kind: 'feed', lang: 'en', label: "What's new", url: 'https://www.ema.europa.eu/en/whats-new.xml' },
      { id: 'sciguide', kind: 'feed', lang: 'en', label: 'Scientific guidelines', type: 'guideline', url: 'https://www.ema.europa.eu/en/scientific-guidelines.xml' },
      { id: 'regguide', kind: 'feed', lang: 'en', label: 'Regulatory and procedural guidelines', type: 'guideline', url: 'https://www.ema.europa.eu/en/regulatory-and-procedural-guideline.xml' },
      { id: 'consult', kind: 'feed', lang: 'en', label: 'Public consultations', type: 'draft', url: 'https://www.ema.europa.eu/en/public-consultations.xml' },
      { id: 'epar', kind: 'feed', lang: 'en', label: 'EPARs and summaries of opinion', type: 'approval', url: 'https://www.ema.europa.eu/en/human-medicine-new.xml' },
      { id: 'newmed', kind: 'feed', lang: 'en', label: 'New medicines: human', type: 'approval', url: 'https://www.ema.europa.eu/en/new-human-medicine-new.xml' },
      { id: 'orphan', kind: 'feed', lang: 'en', label: 'Orphan designations', type: 'approval', url: 'https://www.ema.europa.eu/en/orphan.xml' },
      { id: 'pip', kind: 'feed', lang: 'en', label: 'Paediatric investigation plans', type: 'approval', url: 'https://www.ema.europa.eu/en/pip.xml' },
      { id: 'withdrawn', kind: 'feed', lang: 'en', label: 'Withdrawn applications', type: 'approval', url: 'https://www.ema.europa.eu/en/withdrawn-applications.xml' },
      { id: 'herbal', kind: 'feed', lang: 'en', label: 'Herbal medicines', url: 'https://www.ema.europa.eu/en/herbal-medicine-new.xml' },
    ],
  },
  {
    code: 'MHRA', name: 'Medicines and Healthcare products Regulatory Agency', region: 'United Kingdom', home: 'https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency',
    channels: [
      { id: 'guidance', kind: 'feed', lang: 'en', label: 'Guidance and regulation (GOV.UK)', url: 'https://www.gov.uk/search/guidance-and-regulation.atom?order=updated-newest&organisations%5B%5D=medicines-and-healthcare-products-regulatory-agency&parent=medicines-and-healthcare-products-regulatory-agency' },
      { id: 'dsu', kind: 'feed', lang: 'en', label: 'Drug Safety Update', type: 'safety', url: 'https://www.gov.uk/drug-safety-update.atom' },
      { id: 'alerts', kind: 'feed', lang: 'en', label: 'Alerts and recalls', type: 'recall', url: 'https://www.gov.uk/drug-device-alerts.atom' },
    ],
  },
  {
    code: 'Swissmedic', name: 'Swissmedic', region: 'Switzerland', home: 'https://www.swissmedic.ch',
    channels: [
      { id: 'neu', kind: 'feed', lang: 'de', label: 'Neu auf der Website', url: 'http://fetchrss.com/rss/5fe092c0fd80be0c580365425fe091f22136327aca5bccf2.xml' },
      { id: 'sicherheit', kind: 'feed', lang: 'de', label: 'Arzneimittelsicherheit', type: 'safety', url: 'https://fetchrss.com/feed/X-CSwP0MWGVCZ8rORu-q3KN0.rss' },
      { id: 'mitteilungen', kind: 'page', lang: 'de', label: 'Mitteilungen', url: 'https://www.swissmedic.ch/swissmedic/de/home/news/mitteilungen.html', dates: 'dmy' },
      { id: 'actualite', kind: 'page', lang: 'fr', label: 'Actualité', url: 'https://www.swissmedic.ch/swissmedic/fr/home/news/actualite.html', dates: 'dmy' },
      { id: 'news-en', kind: 'page', lang: 'en', label: 'News (English)', url: 'https://www.swissmedic.ch/swissmedic/en/home/news/news.html', dates: 'dmy' },
    ],
  },
  {
    code: 'HC', name: 'Health Canada', region: 'Canada', home: 'https://www.canada.ca/en/health-canada.html',
    channels: [
      { id: 'recalls-en', kind: 'feed', lang: 'en', label: 'Health product recalls and alerts', type: 'recall', url: 'https://recalls-rappels.canada.ca/en/feed/health-products-alerts-recalls' },
      { id: 'recalls-fr', kind: 'feed', lang: 'fr', label: 'Rappels et avis: produits de santé', type: 'recall', url: 'https://recalls-rappels.canada.ca/fr/flux/produits-sante-alertes-rappels', alts: ['https://recalls-rappels.canada.ca/fr/feed/health-products-alerts-recalls'] },
      { id: 'news-en', kind: 'feed', lang: 'en', label: 'News (Canada.ca)', type: 'news', url: 'https://api.io.canada.ca/io-server/gc/news/en/v2?dept=healthcanada&sort=publishedDate&orderBy=desc&pick=50&format=atom' },
      { id: 'news-fr', kind: 'feed', lang: 'fr', label: 'Nouvelles (Canada.ca)', type: 'news', url: 'https://api.io.canada.ca/io-server/gc/news/fr/v2?dept=healthcanada&sort=publishedDate&orderBy=desc&pick=50&format=atom', alts: ['https://api.io.canada.ca/io-server/gc/news/fr/v2?dept=santecanada&sort=publishedDate&orderBy=desc&pick=50&format=atom'] },
    ],
  },
  {
    code: 'TGA', name: 'Therapeutic Goods Administration', region: 'Australia', home: 'https://www.tga.gov.au',
    channels: [
      { id: 'alerts', kind: 'feed', lang: 'en', label: 'Alerts (safety, recalls, shortages)', url: 'https://www.tga.gov.au/feeds/alert.xml' },
      { id: 'news', kind: 'feed', lang: 'en', label: 'News', type: 'news', url: 'https://www.tga.gov.au/feeds/article/news.xml' },
      { id: 'notices', kind: 'feed', lang: 'en', label: 'Notices', type: 'circular', url: 'https://www.tga.gov.au/feeds/article/notices.xml' },
      { id: 'safety', kind: 'feed', lang: 'en', label: 'Safety updates', type: 'safety', url: 'https://www.tga.gov.au/feeds/article/safety-updates.xml' },
      { id: 'guidance', kind: 'feed', lang: 'en', label: 'Guidance', type: 'guideline', url: 'https://www.tga.gov.au/feeds/guidance.xml' },
      { id: 'consult', kind: 'feed', lang: 'en', label: 'Consultations', type: 'draft', url: 'https://www.tga.gov.au/feeds/consultation.xml' },
      { id: 'legislation', kind: 'feed', lang: 'en', label: 'Legislation', type: 'law', url: 'https://www.tga.gov.au/feeds/legislation.xml' },
      { id: 'scheduling', kind: 'feed', lang: 'en', label: 'Scheduling decisions (final)', type: 'law', url: 'https://www.tga.gov.au/feeds/publication/scheduling-decisions-final.xml' },
    ],
  },
  {
    code: 'WHO-PQ', name: 'WHO Prequalification', region: 'Global', home: 'https://extranet.who.int/prequal',
    channels: [
      { id: 'all', kind: 'feed', lang: 'en', label: 'News, alerts and updates', url: 'https://extranet.who.int/prequal/rss.xml' },
    ],
  },
  {
    code: 'CDSCO', name: 'Central Drugs Standard Control Organisation', region: 'India', home: 'https://cdsco.gov.in',
    channels: [
      { id: 'circulars', kind: 'page', lang: 'en', label: 'Circulars', type: 'circular', url: 'https://cdsco.gov.in/opencms/opencms/en/Notifications/Circulars/', dates: 'dmy' },
      { id: 'gazette', kind: 'page', lang: 'en', label: 'Gazette notifications', type: 'law', url: 'https://cdsco.gov.in/opencms/opencms/en/Notifications/Gazette-Notifications/', dates: 'dmy' },
      { id: 'notices', kind: 'page', lang: 'en', label: 'Public notices', type: 'circular', url: 'https://cdsco.gov.in/opencms/opencms/en/Notifications/Public-Notices/', dates: 'dmy' },
      { id: 'alerts', kind: 'page', lang: 'en', label: 'Alerts', type: 'safety', url: 'https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/', dates: 'dmy' },
    ],
  },
  {
    code: 'PMDA', name: 'Pharmaceuticals and Medical Devices Agency', region: 'Japan', home: 'https://www.pmda.go.jp',
    channels: [
      { id: 'shinchaku', kind: 'page', lang: 'ja', label: '新着情報 (What\'s new, Japanese)', url: 'https://www.pmda.go.jp/0017.html' },
      { id: 'pubcom-review', kind: 'page', lang: 'ja', label: '意見募集 審査 (public comments, review)', type: 'draft', url: 'https://www.pmda.go.jp/review-services/pub-comments/0001.html' },
      { id: 'pubcom-safety', kind: 'page', lang: 'ja', label: '意見募集 安全対策 (public comments, safety)', type: 'draft', url: 'https://www.pmda.go.jp/safety/pub-comments/0001.html' },
      { id: 'top-all', kind: 'feed', lang: 'en', label: 'Top All (English)', url: 'https://www.pmda.go.jp/rss_008.xml' },
      { id: 'reviews', kind: 'feed', lang: 'en', label: 'Reviews (English)', url: 'https://www.pmda.go.jp/rss_011.xml' },
      { id: 'safety', kind: 'feed', lang: 'en', label: 'Safety measures (English)', type: 'safety', url: 'https://www.pmda.go.jp/rss_013.xml' },
      { id: 'postmarket', kind: 'feed', lang: 'en', label: 'Post-marketing safety (English)', type: 'safety', url: 'https://www.pmda.go.jp/rss_006.xml' },
      { id: 'intl', kind: 'feed', lang: 'en', label: 'International activities (English)', url: 'https://www.pmda.go.jp/rss_009.xml' },
      { id: 'standards', kind: 'feed', lang: 'en', label: 'RS and standards (English)', url: 'https://www.pmda.go.jp/rss_012.xml' },
    ],
  },
  {
    code: 'NMPA', name: 'National Medical Products Administration', region: 'China', home: 'https://www.nmpa.gov.cn',
    channels: [
      { id: 'ggtg', kind: 'page', lang: 'zh', label: '公告通告 (announcements)', type: 'circular', url: 'https://www.nmpa.gov.cn/xxgk/ggtg/index.html' },
      { id: 'fgwj', kind: 'page', lang: 'zh', label: '法规文件 (rules)', type: 'law', url: 'https://www.nmpa.gov.cn/xxgk/fgwj/index.html' },
      { id: 'zhqyj', kind: 'page', lang: 'zh', label: '征求意见 (consultations)', type: 'draft', url: 'https://www.nmpa.gov.cn/xxgk/zhqyj/index.html' },
      { id: 'cde-zdyz', kind: 'page', lang: 'zh', label: 'CDE 指导原则 (technical guidelines)', type: 'guideline', url: 'https://www.cde.org.cn/zdyz/index' },
      { id: 'en', kind: 'page', lang: 'en', label: 'Regulatory information (English)', url: 'https://english.nmpa.gov.cn/regulatoryinformation.html' },
    ],
  },
  {
    code: 'MFDS', name: 'Ministry of Food and Drug Safety', region: 'South Korea', home: 'https://www.mfds.go.kr',
    channels: [
      { id: 'm_74', kind: 'page', lang: 'ko', label: '공지 (notices)', type: 'circular', url: 'https://www.mfds.go.kr/brd/m_74/list.do' },
      { id: 'm_76', kind: 'page', lang: 'ko', label: '공고 (announcements)', type: 'circular', url: 'https://www.mfds.go.kr/brd/m_76/list.do' },
      { id: 'm_99', kind: 'page', lang: 'ko', label: '보도자료 (press releases)', type: 'news', url: 'https://www.mfds.go.kr/brd/m_99/list.do' },
      { id: 'm_207', kind: 'page', lang: 'ko', label: '제개정고시 (amended notices)', type: 'law', url: 'https://www.mfds.go.kr/brd/m_207/list.do' },
      { id: 'm_209', kind: 'page', lang: 'ko', label: '입법/행정예고 (draft rules)', type: 'draft', url: 'https://www.mfds.go.kr/brd/m_209/list.do' },
      { id: 'm_211', kind: 'page', lang: 'ko', label: '고시훈령예규 (rules)', type: 'law', url: 'https://www.mfds.go.kr/brd/m_211/list.do' },
      { id: 'm_1059', kind: 'page', lang: 'ko', label: '공무원지침서/민원인안내서 (guidelines)', type: 'guideline', url: 'https://www.mfds.go.kr/brd/m_1059/list.do' },
      { id: 'm_506', kind: 'page', lang: 'ko', label: '의약품 등 위해정보 (safety)', type: 'safety', url: 'https://www.mfds.go.kr/brd/m_506/list.do' },
      { id: 'en-m_61', kind: 'page', lang: 'en', label: 'News & Notice (English)', url: 'https://www.mfds.go.kr/eng/brd/m_61/list.do' },
      { id: 'en-m_18', kind: 'page', lang: 'en', label: 'Drugs regulations (English)', type: 'law', url: 'https://www.mfds.go.kr/eng/brd/m_18/list.do' },
      { id: 'en-m_1127', kind: 'page', lang: 'en', label: 'Drugs guidelines (English)', type: 'guideline', url: 'https://www.mfds.go.kr/eng/brd/m_1127/list.do' },
      { id: 'en-m_27', kind: 'page', lang: 'en', label: 'Bio and cosmetics regulations (English)', type: 'law', url: 'https://www.mfds.go.kr/eng/brd/m_27/list.do' },
      { id: 'en-m_40', kind: 'page', lang: 'en', label: 'Medical devices regulations (English)', type: 'law', url: 'https://www.mfds.go.kr/eng/brd/m_40/list.do' },
    ],
  },
  {
    code: 'SFDA', name: 'Saudi Food and Drug Authority', region: 'Saudi Arabia', home: 'https://www.sfda.gov.sa',
    channels: [
      { id: 'news-ar', kind: 'page', lang: 'ar', label: 'الأخبار (news)', type: 'news', url: 'https://www.sfda.gov.sa/ar/news' },
      { id: 'regulations-ar', kind: 'page', lang: 'ar', label: 'الأنظمة واللوائح (regulations)', type: 'law', url: 'https://www.sfda.gov.sa/ar/regulations' },
      { id: 'warnings-ar', kind: 'page', lang: 'ar', label: 'التحذيرات (warnings)', type: 'safety', url: 'https://www.sfda.gov.sa/ar/warnings' },
      { id: 'news-en', kind: 'page', lang: 'en', label: 'News (English)', type: 'news', url: 'https://www.sfda.gov.sa/en/news' },
      { id: 'regulations-en', kind: 'page', lang: 'en', label: 'Regulations (English)', type: 'law', url: 'https://www.sfda.gov.sa/en/regulations' },
      { id: 'guides-en', kind: 'page', lang: 'en', label: 'Guidelines (English)', type: 'guideline', url: 'https://www.sfda.gov.sa/en/guide', alts: ['https://www.sfda.gov.sa/en/guides'] },
      { id: 'warnings-en', kind: 'page', lang: 'en', label: 'Warnings (English)', type: 'safety', url: 'https://www.sfda.gov.sa/en/warnings' },
      { id: 'circulars-en', kind: 'page', lang: 'en', label: 'Drug circulars and withdrawals (English)', type: 'circular', url: 'https://www.sfda.gov.sa/en/drugs_circulars_withdrawal' },
    ],
  },
  {
    code: 'HSA', name: 'Health Sciences Authority', region: 'Singapore', home: 'https://www.hsa.gov.sg',
    channels: [
      { id: 'announcements', kind: 'page', lang: 'en', label: 'Announcements', url: 'https://www.hsa.gov.sg/announcements' },
    ],
  },
  {
    code: 'SAHPRA', name: 'South African Health Products Regulatory Authority', region: 'South Africa', home: 'https://www.sahpra.org.za',
    channels: [
      { id: 'news', kind: 'feed', lang: 'en', label: 'News and updates', url: 'https://www.sahpra.org.za/category/news-and-updates/feed/', alts: ['https://www.sahpra.org.za/feed/'] },
      { id: 'all', kind: 'feed', lang: 'en', label: 'All posts', url: 'https://www.sahpra.org.za/feed/' },
    ],
  },
  {
    code: 'ANVISA', name: 'Agência Nacional de Vigilância Sanitária', region: 'Brazil', home: 'https://www.gov.br/anvisa',
    channels: [
      { id: 'noticias', kind: 'feed', lang: 'pt', label: 'Notícias', url: 'https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/RSS', alts: ['https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa'] },
    ],
  },
  {
    code: 'COFEPRIS', name: 'Comisión Federal para la Protección contra Riesgos Sanitarios', region: 'Mexico', home: 'https://www.gob.mx/cofepris',
    channels: [
      { id: 'prensa', kind: 'page', lang: 'es', label: 'Prensa', url: 'https://www.gob.mx/cofepris/archivo/prensa' },
      { id: 'documentos', kind: 'page', lang: 'es', label: 'Documentos', url: 'https://www.gob.mx/cofepris/archivo/documentos' },
    ],
  },
  {
    code: 'ICH', name: 'International Council for Harmonisation', region: 'Global', home: 'https://www.ich.org',
    channels: [
      { id: 'press', kind: 'page', lang: 'en', label: 'Press releases', type: 'news', url: 'https://www.ich.org/page/press-releases', alts: ['https://www.ich.org/'] },
      { id: 'consult', kind: 'page', lang: 'en', label: 'Public consultations', type: 'draft', url: 'https://www.ich.org/page/public-consultations' },
    ],
  },
];

export const REGIONS = Object.fromEntries(AUTHORITIES.map((a) => [a.code, a.region]));

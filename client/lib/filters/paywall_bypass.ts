// Bypass paywall logic ported from bypass-paywalls-firefox-clean
// Mechanisms: UA spoofing, paywall script blocking, DOM manipulation, JSON extraction

// ══════════════════════════════════════════════════════════════════════════════
//  SIMPLE GOOGLEBOT SITES — just add the domain, global blockers do the rest
// ══════════════════════════════════════════════════════════════════════════════
const GOOGLEBOT_DOMAINS: string[] = [
  // ── US / English ─────────────────────────────────────────────────────────
  'ft.com', 'newyorker.com', 'theatlantic.com', 'wired.com',
  'scientificamerican.com', 'washingtonpost.com', 'foreignaffairs.com',
  'harpers.org', 'vanityfair.com', 'vogue.com', 'vogue.co.uk', 'gq.com',
  'architecturaldigest.com', 'bonappetit.com', 'cntraveler.com',
  'epicurious.com', 'pitchfork.com', 'businessinsider.com',
  'christianitytoday.com', 'churchtimes.co.uk', 'bostonmagazine.com',
  'law.com', 'monocle.com', 'jazzwise.com', 'project-syndicate.org',
  'stratfor.com', 'phillymag.com', 'thehub.ca', 'endpoints.news',
  'usatoday.com', 'ajc.com', 'dallasnews.com', 'hilltimes.com',
  'uol.com.br', 'examtopics.com',
  // Gannett newspapers (Googlebot UA unlocks full text)
  'azcentral.com', 'cincinnati.com', 'commercialappeal.com',
  'courier-journal.com', 'democratandchronicle.com', 'desmoinesregister.com',
  'detroitnews.com', 'dispatch.com', 'freep.com', 'indystar.com',
  'jacksonville.com', 'jsonline.com', 'knoxnews.com', 'news-press.com',
  'northjersey.com', 'oklahoman.com', 'palmbeachpost.com', 'tennessean.com',
  // ── Scandinavian ─────────────────────────────────────────────────────────
  'aftenposten.no', 'dagsavisen.no', 'dagen.no', 'morgenbladet.no',
  'vl.no', 'united.no', 'nordjyske.dk', 'euroinvestor.dk',
  'kristeligt-dagblad.dk', 'nyteknik.se', 'vibilagare.se',
  // Bonnier Group SE
  'dagensmedicin.se', 'dn.se', 'hd.se', 'sydsvenskan.se',
  // ── German ───────────────────────────────────────────────────────────────
  'handelsblatt.com', 'weltkunst.de', 'freiepresse.de',
  'noz.de', 'shz.de', 'dk-online.de', 'flz.de', 'medieninsider.com',
  // ── French ───────────────────────────────────────────────────────────────
  'bulletinquotidien.fr', 'lopinion.fr', 'leparisien.fr',
  'lenouveleconomiste.fr', 'lecanardenchaine.fr', 'linforme.com',
  // ── Swiss (tamedia group + others) ───────────────────────────────────────
  'bonasavoir.ch', '24heures.ch', 'bazonline.ch', 'bernerzeitung.ch',
  'derbund.ch', 'tagesanzeiger.ch', 'tdg.ch', 'bauernzeitung.ch',
  'diegruene.ch', 'heidi.news',
  // ── Catalan / Spanish ────────────────────────────────────────────────────
  'ara.cat', 'arabalears.cat', 'infolibre.es',
  // ── Italian (GEDI group + others) ────────────────────────────────────────
  'ilmanifesto.it', 'huffingtonpost.it', 'lastampa.it', 'repubblica.it',
  'lescienze.it', 'moda.it', 'ilglobo.com',
  // ── Dutch / Belgian (Roularta group + others) ─────────────────────────────
  'groene.nl', 'beleggersbelangen.nl', 'femmesdaujourdhui.be',
  'flair.be', 'knack.be', 'kw.be', 'levif.be', 'libelle.be', 'pmg.be',
  // ── Japanese ─────────────────────────────────────────────────────────────
  'chunichi.co.jp', 'tokyo-np.co.jp', 'mainichi.jp', 'newspicks.com',
  // ── French regional / trade ──────────────────────────────────────────────
  'actu-environnement.com', 'aefinfo.fr', 'actu-juridique.fr',
  // ── Latin America ────────────────────────────────────────────────────────
  'df.cl', 'ladiaria.com.uy',
  // ── Eastern Europe ───────────────────────────────────────────────────────
  'polityka.pl', 'makorrishon.co.il',
  // ── Trade / niche ────────────────────────────────────────────────────────
  'gramophone.co.uk', 'key.aero', 'keymilitary.com', 'modernrailways.com',
  'naturalgasworld.com', 'pharmaceutical-journal.com', 'shrm.org',
  'teachingtimes.com', 'thecaterer.com', 'utilityweek.co.uk',
  'ipe.com', 'pokerindustrypro.com', 'tijorifinance.com',
  'railwaygazette.com', 'kalkinemedia.com',
];

export const UA_GOOGLEBOT   = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
export const UA_BINGBOT     = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
export const UA_FACEBOOKBOT = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

interface CsCodeElem {
  hide_elem?: string;
  add_style?: string;
  cond?: string;
  rm_class?: string;
  rm_attrib?: string;
  set_attrib?: string;
  rm_elem?: boolean;
  elems?: CsCodeElem[];
}

interface BypassRule {
  ua?: 'g' | 'b' | 'f';
  block?: string;
  cs_code?: CsCodeElem[];
  ld_json?: string;
  ld_json_next?: string;
  clear_storage?: boolean;
  remove_cookies?: string[];
}

// ── Paywall platform scripts blocked globally on every page ──────────────────
const GLOBAL_BLOCK_PATTERNS: string[] = [
  // Piano / Tinypass
  '\\.tinypass\\.com\\/',
  '\\.piano\\.io\\/xbuilder\\/experience\\/execute',
  // Poool
  '\\.poool\\.fr\\/',
  // Pelcro
  'js\\.pelcro\\.com\\/',
  // Sophi
  '\\.sophi\\.io\\/',
  // Wallkit
  'wallkit\\.net\\/',
  // Qiota
  '\\.qiota\\.com\\/',
  // Axate
  '\\.axate\\.io',
  // AMP access/subscriptions
  'ampproject\\.org\\/v0\\/amp-(access|subscriptions)-.+\\.m?js',
  // Arc XP
  '\\.arc-cdn\\.net\\/arc\\/subs\\/',
  '\\/arc\\/subs\\/p\\.min\\.js',
  // Zephr
  '\\.zephr\\.com\\/',
  '\\/zephr\\/feature',
  // Leaky Paywall (WordPress plugin)
  '\\.leaky-paywall\\.com\\/',
  '\\/wp-content\\/plugins\\/leaky-paywall\\/js\\/leaky-paywall-cookie\\.js',
  '\\/wp-json\\/leaky-paywall\\/v\\d\\/check-restrictions',
  // Cxense
  '\\.cxense\\.com\\/',
  // Evolok
  '\\.evolok\\.net\\/',
  '\\/evolok\\/(.+\\/)?ev-(em|widgets)\\.min\\.js',
  // Ensighten (tag manager used for metering on some sites)
  '\\.ensighten\\.com\\/.+\\/Bootstrap\\.js',
  // Mather Analytics (article metering)
  'js\\.matheranalytics\\.com\\/',
  // Amplitude (subscription tracking)
  '\\.amplitude\\.com\\/',
  // BlueConic (subscriber data platform)
  '\\.blueconic\\.net\\/',
  // NewsMemory
  '\\.newsmemory\\.com\\/\\?meter',
  // TownNews / Blox CMS
  '\\/tncms\\/api\\/access(\\.\\w+)*\\.js',
  // Steady (creator subscription platform)
  '\\/steadyhq\\.com\\/',
  // Newspack content gate
  '\\/wp-content\\/plugins\\/newspack-plugin\\/dist\\/.+-gate-metering\\.js',
  // Omeda / Olytics
  'olytics\\.omeda\\.com\\/',
  // OneCount metering
  '\\.onecount\\.net\\/',
  // Pico subscriber tools
  'api\\.pico\\.tools\\/',
  // FewCents
  '\\.fewcents\\.co\\/.+\\/paywall.*\\.js',
];

// ── Site-specific rules ──────────────────────────────────────────────────────
const BYPASS_RULES: Record<string, BypassRule> = {

  // ── Needs Googlebot UA + extra site-specific block ───────────────────────
  'businessinsider.com': { ua: 'g', block: '(\\.businessinsider\\.com\\/chunks\\/scripts\\/\\d.+\\.js|\\.sophi\\.io\\/)' },
  'fd.nl':               { ua: 'g', block: '\\/specials\\.fd\\.nl\\/_next\\/static\\/chunks\\/framework-.+\\.js' },
  'elmercurio.com':      { ua: 'g', block: '\\.(elmercurio\\.com|emol\\.cl)\\/(.+\\/)?js\\/(.+\\/)?(modal|merPramV\\d|(FuncionesComun|PramModal)\\.min)\\.js' },
  'digitimes.com':       { ua: 'g', block: '\\.piano\\.io\\/' },
  'rheinpfalz.de':       { ua: 'g', block: '\\.piano\\.io\\/' },
  'grupogedi.it':        { ua: 'g', block: 'scripts\\.repubblica\\.it\\/pw\\/pw\\.js' },
  'repubblica.it':       { ua: 'g', block: 'scripts\\.repubblica\\.it\\/pw\\/pw\\.js' },

  // ── Facebookbot UA ────────────────────────────────────────────────────────
  'bt.no':           { ua: 'f' },
  'citywire.com':    { ua: 'f' },
  'lagaceta.com.ar': { ua: 'f' },
  'thediplomat.com': { ua: 'f' },
  'wonderzine.com':  { ua: 'f' },
  'milesplit.com':   { ua: 'f' },

  // ── Site-specific script blocks (beyond global patterns) ─────────────────
  'bloomberg.com':          { block: '\\.bwbx\\.io\\/s3\\/fence\\/fortress-client\\/' },
  'adweek.com':             { block: '\\.adweek\\.com\\/wp-content\\/plugins\\/adw-zephr\\/' },
  'historyextra.com':       { block: '\\.historyextra\\.com\\/zephr\\/feature' },
  'wsj.com':                { block: '\\.cxense\\.com\\/' },
  'barrons.com':            { block: '\\.cxense\\.com\\/' },
  'economist.com':          { block: '\\.economist\\.com\\/(latest\\/wall-ui|script)\\.js' },
  'fastcompany.com':        { block: '\\.fastcompany\\.com\\/script\\.js' },
  'fortune.com':            { block: '\\.fortune\\.com\\/api\\/tinypass\\.min\\.js' },
  'latimes.com':            { block: '(\\.latimes\\.com\\/meteringjs|\\.californiatimes\\.com\\/caltimes\\/latimes\\/Bootstrap\\.js)' },
  'telegraph.co.uk':        { block: '\\.telegraph\\.co\\.uk\\/martech\\/js\\/' },
  'thetimes.com':           { block: '\\.thetimes\\.com\\/wp-content\\/plugins\\/tm-wp-zephr\\/' },
  'nypost.com':             { block: '\\.nypost\\.com\\/zephr\\/feature' },
  'nzherald.co.nz':         { block: '\\.nzherald\\.co\\.nz\\/zephr\\/' },
  'sueddeutsche.de':        { block: '\\.sueddeutsche\\.de\\/api\\/tinypass\\.min\\.js' },
  'reuters.com':            { block: '\\.reuters\\.com\\/arc\\/subs\\/p\\.min\\.js' },
  'irishtimes.com':         { block: '\\.irishtimes\\.com\\/zephr\\/feature' },
  'ilsole24ore.com':        { block: '\\.ilsole24ore\\.com\\/zephr\\/feature' },
  'nzz.ch':                 { block: 'tms\\.danzz\\.ch\\/scripts\\/t\\.min\\.js' },
  'lavanguardia.com':       { block: '\\/ev\\.lavanguardia\\.com\\/' },
  'elpais.com':             { block: '\\.prisa\\.com\\/dist\\/subs\\/pmwall\\/.+\\/pmwall\\.min\\.js' },
  'elpais.com.uy':          { block: '(\\.elpais\\.com\\.uy\\/user\\/authStatus|\\.evolok\\.net\\/)' },
  'hbr.org':                { block: 'cdn\\.tinypass\\.com\\/' },
  'bostonglobe.com':        { block: 'meter\\.bostonglobe\\.com\\/js\\/' },
  'theatlantic.com':        { block: '\\.theatlantic\\.com\\/zephr\\/' },
  'theglobeandmail.com':    { block: '\\.theglobeandmail\\.com\\/zephr\\/feature' },
  'seattletimes.com':       { block: '\\.seattletimes\\.com\\/.+\\/st-user-messaging.+\\.js' },
  'tampabay.com':           { block: 'js\\.matheranalytics\\.com\\/' },
  'startribune.com':        { block: '\\.tinypass\\.com\\/' },
  'statnews.com':           { block: '\\.tinypass\\.com\\/' },
  'nationalreview.com':     { block: '\\.ampproject\\.org\\/v0\\/amp-access-.+\\.js' },
  'thedailybeast.com':      { block: '\\.tinypass\\.com\\/' },
  'inc.com':                { block: '\\.tinypass\\.com\\/' },
  'entrepreneur.com':       { block: '\\.tinypass\\.com\\/' },
  'nbcnews.com':            { block: '\\.tinypass\\.com\\/' },
  'newsweek.com':           { block: 'js\\.pelcro\\.com\\/' },
  'scmp.com':               { block: '\\.tinypass\\.com\\/' },
  'independent.co.uk':      { block: '\\.independent\\.co\\.uk\\/api\\/tinypass\\.min\\.js' },
  'newstatesman.com':       { block: '\\.piano\\.io\\/' },
  'politico.com':           { block: '\\.piano\\.io\\/' },
  'slate.com':              { block: '\\.sophi\\.io\\/' },
  'thehill.com':            { block: '\\.tinypass\\.com\\/' },
  'thehindu.com':           { block: '\\.piano\\.io\\/' },
  'japantimes.co.jp':       { block: '\\.cxense\\.com\\/' },
  'marketwatch.com':        { block: '\\.cxense\\.com\\/' },
  'spglobal.com':           { block: '\\.spglobal\\.com\\/script\\.js' },
  'theeconomist.com':       { block: '\\.economist\\.com\\/(latest\\/wall-ui|script)\\.js' },
  'zeit.de':                { block: '\\.piano\\.io\\/' },
  'diepresse.com':          { block: '\\.tinypass\\.com\\/' },
  'derstandard.at':         { block: '\\.tinypass\\.com\\/' },
  'kurier.at':              { block: '\\.tinypass\\.com\\/' },
  'kleinezeitung.at':       { block: '\\.tinypass\\.com\\/' },
  'fnlondon.com':           { block: '\\.tinypass\\.com\\/' },
  'thespectator.co.uk':     { block: '\\.tinypass\\.com\\/' },
  'spectator.co.uk':        { block: '\\.tinypass\\.com\\/' },
  'newscientist.com':       { block: '\\.piano\\.io\\/' },
  'profil.at':              { block: '\\.piano\\.io\\/' },
  'vol.at':                 { block: '\\.piano\\.io\\/' },
  'prospectmagazine.co.uk': { block: '\\.piano\\.io\\/' },
  'thenation.com':          { block: '\\.thenation\\.com\\/wp-content\\/themes\\/.+\\/js\\/paywall\\/main\\.js' },
  'thebaffler.com':         { block: '\\/blink\\.net\\/.+\\/blink-sdk\\.js' },
  'newrepublic.com':        { block: '\\/blink\\.net\\/.+\\/blink-sdk\\.js' },
  'foreignpolicy.com':      { block: '\\.cxense\\.com\\/' },
  'nytimes.com':            { clear_storage: true, block: '\\.nytimes\\.com\\/(meter\\.js|svc\\/onsite-messaging\\/query)' },
  'acadienouvelle.com':     { block: '\\.acadienouvelle\\.com\\/script\\.js' },
  'abajournal.com':         { block: '\\.piano\\.io' },
  'baseballamerica.com':    { block: '\\.tinypass\\.com' },
  'brandonsun.com':         { block: 'account\\.brandonsun\\.com\\/api\\/v\\d\\/auth\\/identify' },
  'businessinsider.de':     { block: '\\.piano\\.io' },
  'catholicherald.co.uk':   { block: '\\.catholicherald\\.co\\.uk\\/c\\/assets\\/pigeon\\.js' },
  'catholicherald.org':     { block: '\\.catholicherald\\.co\\.uk\\/c\\/assets\\/pigeon\\.js' },
  'commercialobserver.com': { block: '\\/commercialobserver\\.com\\/wp-admin\\/admin-ajax\\.php' },
  'corriere.it':            { block: '(\\.tinypass\\.com\\/|\\.ith9ueyuhu\\.it\\/)' },
  'capitalaberto.com.br':   { block: '\\/paywall\\.capitalaberto\\.com\\.br' },
  'clareecho.ie':           { block: '\\.flip-pay\\.com', cs_code: [{ cond: 'div.td-post-content', rm_class: 'td-post-content' }] },
  'craftscouncil.org.uk':   { block: '\\/steadyhq\\.com' },
  'cornwallreports.co.uk':  { block: '\\.axate\\.io' },
  'adage.com':              { block: '(js\\.pelcro\\.com\\/|\\.sophi\\.io\\/)' },
  'autonews.com':           { block: '(js\\.pelcro\\.com\\/|\\.sophi\\.io\\/)' },
  'chicagobusiness.com':    { block: '(js\\.pelcro\\.com\\/|\\.sophi\\.io\\/)' },
  'modernhealthcare.com':   { block: '(js\\.pelcro\\.com\\/|\\.sophi\\.io\\/)' },
  'pionline.com':           { block: '(js\\.pelcro\\.com\\/|\\.sophi\\.io\\/)' },
  'corrieredellosport.it':  { block: '\\.tinypass\\.com\\/' },
  'thebulletin.org':        { block: '\\.tinypass\\.com\\/' },
  'theblaze.com':           { block: '\\.piano\\.io\\/' },
  'boston.com':             { block: '\\.boston\\.com\\/api\\/tinypass\\.min\\.js', cs_code: [{ hide_elem: 'div.m-advert,div.m-content-advert' }] },
  'businesspost.ie':        { block: '\\.businesspost\\.ie\\/api\\/tinypass\\.min\\.js' },
  'al.com':                 { block: '\\.sophi\\.io\\/' },
  'cleveland.com':          { block: '\\.sophi\\.io\\/' },
  'oregonlive.com':         { block: '\\.sophi\\.io\\/' },
  'masslive.com':           { block: '\\.sophi\\.io\\/' },
  'mlive.com':              { block: '\\.sophi\\.io\\/' },
  'nj.com':                 { block: '\\.sophi\\.io\\/' },
  'pennlive.com':           { block: '\\.sophi\\.io\\/' },
  'syracuse.com':           { block: '\\.sophi\\.io\\/' },
  'afr.com':                { block: '\\.tinypass\\.com\\/' },
  'smh.com.au':             { block: '\\.tinypass\\.com\\/' },
  'theage.com.au':          { block: '\\.tinypass\\.com\\/' },
  'brisbanetimes.com.au':   { block: '\\.tinypass\\.com\\/' },
  'watoday.com.au':         { block: '\\.tinypass\\.com\\/' },
  'adelaidenow.com.au':     { block: '\\.ampproject\\.org\\/v0\\/amp-subscriptions-.+\\.js' },
  'heraldsun.com.au':       { block: '\\.ampproject\\.org\\/v0\\/amp-subscriptions-.+\\.js' },
  'theaustralian.com.au':   { block: '\\.ampproject\\.org\\/v0\\/amp-subscriptions-.+\\.js' },
  'couriermail.com.au':     { block: '\\.ampproject\\.org\\/v0\\/amp-subscriptions-.+\\.js' },
  'cairnspost.com.au':      { block: '\\.ampproject\\.org\\/v0\\/amp-subscriptions-.+\\.js' },
  'elconfidencial.com':     { block: '\\.tinypass\\.com\\/' },
  'eltiempo.com':           { block: '\\.tinypass\\.com\\/' },
  'eluniversal.com.mx':     { block: '\\.tinypass\\.com\\/' },
  'eluniverso.com':         { block: '\\.tinypass\\.com\\/' },
  'elespanol.com':          { block: '\\.tinypass\\.com\\/' },
  'globo.com':              { block: '\\.tinypass\\.com\\/' },
  'lanacion.com.ar':        { block: '\\.glanacion\\.com\\/.+\\/metering\\/.+\\.js' },
  'latercera.com':          { block: '\\.latercera\\.com\\/arc\\/subs\\/p\\.min\\.js' },
  'losandes.com.ar':        { block: 'cdn\\.lavoz\\.com\\.ar\\/sites\\/.+\\/paywall\\/losandes\\/pw\\.js' },
  'eldeber.com.bo':         { block: 'cdn\\.lavoz\\.com\\.ar\\/sites\\/.+\\/paywall\\/eldeber\\/pw\\.js' },
  'elobservador.com.uy':    { block: '\\.elobservador\\.com\\.uy\\/shares' },
  'eldiario.es':            { block: '\\.ampproject\\.org\\/v0\\/amp-access-.+\\.js' },
  'elespectador.com':       { block: '\\.tinypass\\.com\\/' },
  'eltribuno.com':          { block: '\\.ampproject\\.org\\/v0\\/amp-access-.+\\.js' },
  'businessday.co.za':      { block: '\\.arc-cdn\\.net\\/arc\\/subs\\/p\\.min\\.js' },
  'timeslive.co.za':        { block: '\\.arc-cdn\\.net\\/arc\\/subs\\/p\\.min\\.js' },
  'digiday.com':            { block: '\\.tinypass\\.com\\/' },
  'glossy.co':              { block: '\\.tinypass\\.com\\/' },
  'modernretail.co':        { block: '\\.tinypass\\.com\\/' },
  'dailyherald.com':        { block: '\\.tinypass\\.com\\/' },
  'standard.co.uk':         { block: '\\.tinypass\\.com\\/' },
  'jpost.com':              { block: '\\.jpost\\.com\\/js\\/js_article\\.min\\.js' },
  'washingtonexaminer.com': { block: '\\.zephr\\.com\\/zephr-browser\\/' },
  'thecritic.co.uk':        { block: '\\.hadrianpaywall\\.com\\/' },
  'irishnews.com':          { block: '\\.poool\\.fr\\/' },
  'firstthings.com':        { block: '\\/firstthings\\.com\\/wp-content\\/themes\\/.+\\/static\\/js\\/modal.+\\.js' },
  'focusplus.de':           { block: '\\.piano\\.io\\/xbuilder\\/experience\\/execute' },

  // ── Sites needing cookie reset ────────────────────────────────────────────
  'businessstandard.com': { remove_cookies: ['userUid'] },
  'business-standard.com': { remove_cookies: ['userUid'] },
  'pitchfork.com':      { remove_cookies: ['pay_ent_msmp'] },
  'enotes.com':         { remove_cookies: ['ENOTESID'] },
  'ambito.com':         { remove_cookies: ['TDNotesRead'] },
  'demorgen.be':        { remove_cookies: ['TID_ID'] },
  'parool.nl':          { remove_cookies: ['TID_ID'] },
  'trouw.nl':           { remove_cookies: ['TID_ID'] },
  'volkskrant.nl':      { remove_cookies: ['TID_ID'] },

  // ── DOM manipulation only ─────────────────────────────────────────────────
  'anandabazar.com': {
    block: '\\.anandabazar\\.com\\/subscription-assets\\/js\\/paywall.*\\.js',
    cs_code: [{ hide_elem: 'div.paywallouterbox, div.readarticlebox, div.showmorebox, div.adbox' }],
  },
  'arabianbusiness.com': {
    block: '\\.tinypass\\.com',
    cs_code: [{ cond: 'div.ev-meter-content', rm_attrib: 'class' }],
  },
  'augsburger-allgemeine.de': { cs_code: [{ hide_elem: 'div#paywall-fallback-content' }] },
  'bizwest.com': {
    cs_code: [{ cond: 'div.fp-paywall', rm_elem: true, elems: [{ cond: 'div.fp-content', rm_attrib: 'class' }] }],
  },
  'boredpanda.com': {
    cs_code: [
      { cond: 'div.open-list-items', rm_class: 'open-list-items' },
      { cond: 'div#show-all-images-block-premium', rm_elem: true },
    ],
  },
  'businesstoday.in': { cs_code: [{ hide_elem: 'div#magazinePayWallStrip' }] },
  'cardiologie-pratique.com': { cs_code: [{ cond: 'div.wrap-node', rm_attrib: 'class' }] },
  'brusselstimes.com': {
    block: '\\.piano\\.io\\/xbuilder\\/experience\\/execute',
    cs_code: [{ cond: "div[style*='height: 0;']", rm_attrib: 'style' }],
  },
  'nu.nl': {
    cs_code: [
      { cond: 'article#LOGIN', rm_elem: true },
      { cond: 'div.authorized-content', rm_class: 'authorized-content' },
    ],
  },
  'scroll.in': { cs_code: [{ cond: 'article.article-locked', rm_class: 'article-locked' }] },
  'gothamist.com': {
    cs_code: [
      { cond: 'div.leadin', rm_class: 'leadin' },
      { cond: 'div.wall-wrapper', rm_elem: true },
    ],
  },
  'heatmap.news': {
    cs_code: [
      { cond: 'div.body-description', rm_attrib: 'style' },
      { hide_elem: 'div.regwall-container' },
    ],
  },
  'jewishinsider.com': {
    cs_code: [
      { cond: 'div.regModalOuter', rm_elem: true },
      { cond: 'section.paywalled-content', rm_class: 'paywalled-content' },
    ],
  },
  'kommersant.ru': {
    cs_code: [
      { cond: 'section.regwall', rm_elem: true },
      { cond: 'article.doc--regwall', rm_class: 'doc--regwall' },
    ],
  },
  'mamamia.com.au': { cs_code: [{ cond: 'div.paywall-restrict', rm_class: 'paywall-restrict' }] },
  'mainpost.de': { block: '\\.tinypass\\.com', cs_code: [{ hide_elem: 'div#paywall-fallback-content' }] },
  'museumsassociation.org': {
    cs_code: [
      { cond: 'body.paywall', rm_class: 'paywall' },
      { cond: 'div#paywall-wrapper', rm_elem: true },
    ],
  },
  'narcity.com': {
    cs_code: [
      { cond: 'div.body-description[style]', rm_attrib: 'style' },
      { cond: 'div#login-wall, div#overlay', rm_elem: true },
    ],
  },
  'newoxfordreview.org': { cs_code: [{ cond: 'div.not-viewable', rm_class: 'not-viewable' }] },
  'nzgeo.com': { cs_code: [{ cond: 'div#paywall-bottom', rm_elem: true }] },
  'odt.co.nz': {
    block: '\\.odt\\.co\\.nz\\/bwtw\\/api\\/TheWall',
    cs_code: [{ cond: "div[property='content:encoded']", rm_attrib: 'property' }],
  },
  'politiken.dk': { cs_code: [{ cond: 'aside.bg-paper-200', rm_elem: true }] },
  'publishersweekly.com': {
    block: '\\.omeda\\.com',
    cs_code: [
      { cond: 'div#content div.loggedOutOnly', rm_elem: true },
      { cond: 'div#content div.loggedInOnly', rm_attrib: 'class|style' },
    ],
  },
  'spiked-online.com': {
    cs_code: [
      { hide_elem: 'div#support-overlay-sell' },
      { add_style: 'body {overflow: auto !important}' },
    ],
  },
  'telecompaper.com': { cs_code: [{ cond: 'body.blue-background', rm_class: 'blue-background' }] },
  'thejc.com': {
    block: '\\.poool\\.fr',
    cs_code: [
      { cond: 'div.paywall', rm_attrib: 'class' },
      { hide_elem: 'div.poool-widget' },
    ],
  },
  'therealdeal.com': {
    block: '\\.tinypass\\.com',
    cs_code: [{ hide_elem: "div[class^='AdUnit_wrapper_']" }],
  },
  'themonthly.com.au': { block: '\\.themonthly\\.com\\.au\\/xbuilder\\/experience\\/execute' },
  'valueresearchonline.com': { cs_code: [{ cond: 'div.text-blur', rm_attrib: 'class' }] },
  'wbjournal.com': {
    cs_code: [
      { hide_elem: 'div.paywall-container' },
      { cond: 'div.expandable-paywall-premium-content', rm_attrib: 'style' },
    ],
  },
  'lapost.com': {
    cs_code: [
      { cond: 'div.article-content', rm_attrib: 'style' },
      { hide_elem: 'div.google-ad-wrapper' },
    ],
  },
  'lavozdegalicia.es': {
    cs_code: [
      { cond: 'body.blocked', rm_class: 'blocked' },
      { cond: 'hr.pw-separator', rm_class: 'pw-separator' },
    ],
  },
  'dasinvestment.com': {
    cs_code: [
      { cond: 'div.premium-content', rm_elem: true },
      { cond: "div.hidden.showAfterLogin:not([style])", rm_class: 'hidden' },
    ],
  },
  'ktipp.ch': {
    cs_code: [{
      cond: 'div.paywall', rm_attrib: 'class',
      elems: [{ cond: 'div.login-box-cover, div.article-text, div.related-interests', rm_elem: true }],
    }],
  },
  'historischnieuwsblad.nl': { cs_code: [{ hide_elem: 'div.b-premium-paywall__outer' }] },
  'gocomics.com': {
    cs_code: [
      { hide_elem: 'div[data-paywall]' },
      { add_style: 'html {overflow: auto !important}' },
    ],
  },
  'rockdelux.com': {
    cs_code: [
      { cond: 'div.bg-paywall', rm_elem: true },
      { cond: 'body', rm_attrib: 'class|style' },
    ],
  },
  'solarserver.de': {
    cs_code: [{
      cond: 'div.paywall-box', rm_elem: true,
      elems: [
        { cond: 'div.paywall', rm_attrib: 'style' },
        { cond: 'div.paywall-blurred', rm_attrib: 'class' },
      ],
    }],
  },
  'splainer.in': {
    cs_code: [{
      cond: '.subscription-prompt', rm_elem: true,
      elems: [{ cond: '.hide-section', rm_class: 'hide-section' }],
    }],
  },
  'thefederal.com': {
    cs_code: [
      { cond: 'div.hide.paywall-content', set_attrib: 'class|article_cont_size' },
      { hide_elem: 'div#premium_access_message_text,div#lock_message' },
    ],
  },
  'visegradinsight.eu': { cs_code: [{ cond: 'div.fade', rm_class: 'fade' }] },

  // ── Content extraction (LD-JSON / Next.js data) ───────────────────────────
  'argaam.com':              { ld_json: 'div.subscription-package-article|div.restricted-article' },
  'athensreviewofbooks.com': { ld_json: 'div.freeUser|div.itemBody' },
  'aftermath.site':          { ld_json_next: "div[class^='ContentGate_wrapper']|div[class^='PostContent_wrapper']" },
  'lataco.com':              { ld_json_next: "div[class*='paywall']|div[class*='article-body']" },
};

const UA_MAP: Record<string, string> = { g: UA_GOOGLEBOT, b: UA_BINGBOT, f: UA_FACEBOOKBOT };

const GOOGLEBOT_SET = new Set(GOOGLEBOT_DOMAINS.map(d => d.toLowerCase()));
const GOOGLEBOT_RULE: BypassRule = { ua: 'g' };

function findRule(hostname: string): BypassRule | null {
  const d = hostname.toLowerCase().replace(/^www\./, '');
  const fromSimpleList = GOOGLEBOT_SET.has(d);
  const advancedRule = BYPASS_RULES[d] ?? (() => {
    const parts = d.split('.');
    for (let i = 1; i < parts.length; i++) {
      const p = parts.slice(i).join('.');
      if (BYPASS_RULES[p]) return BYPASS_RULES[p];
    }
    return null;
  })();
  if (advancedRule) return advancedRule;
  if (fromSimpleList) return GOOGLEBOT_RULE;
  return null;
}

export function getBypassRule(hostname: string): BypassRule | null {
  return findRule(hostname);
}

export function getBypassUA(url: string): string | null {
  try {
    const h = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    const rule = findRule(h);
    return rule?.ua ? (UA_MAP[rule.ua] ?? null) : null;
  } catch {
    return null;
  }
}

// ─────────────────────── Build injected JS strings ───────────────────────────

function buildPreloadJS(): string {
  const preloadRules: Record<string, { b?: string; c?: number }> = {};
  for (const [domain, rule] of Object.entries(BYPASS_RULES)) {
    if (rule.block || rule.clear_storage) {
      const r: { b?: string; c?: number } = {};
      if (rule.block) r.b = rule.block;
      if (rule.clear_storage) r.c = 1;
      preloadRules[domain] = r;
    }
  }

  return `
(function() {
  var GLOBAL = ${JSON.stringify(GLOBAL_BLOCK_PATTERNS)};
  var RULES = ${JSON.stringify(preloadRules)};

  function getDomain() {
    try { return window.location.hostname.toLowerCase().replace(/^www\\./, ''); } catch(e) { return ''; }
  }
  function matchRule(d) {
    if (RULES[d]) return RULES[d];
    var parts = d.split('.');
    for (var i = 1; i < parts.length; i++) {
      var p = parts.slice(i).join('.');
      if (RULES[p]) return RULES[p];
    }
    return null;
  }

  var domain = getDomain();
  var rule = matchRule(domain);

  var pats = GLOBAL.slice();
  if (rule && rule.b) pats.push(rule.b);
  var compiled = pats.map(function(p) { return new RegExp(p, 'i'); });

  function blocked(url) {
    if (!url || typeof url !== 'string') return false;
    return compiled.some(function(re) { return re.test(url); });
  }

  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (blocked(String(url || ''))) { this._bpc = true; return; }
    return _open.apply(this, arguments);
  };
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._bpc) return;
    return _send.apply(this, arguments);
  };

  if (typeof window.fetch === 'function') {
    var _fetch = window.fetch;
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input ? input.url : '');
      if (blocked(url)) return Promise.reject(new TypeError('bpc'));
      return _fetch.apply(this, arguments);
    };
  }

  if (rule && rule.c) {
    try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
  }
})();
true;
`.trim();
}

function buildPostloadJS(): string {
  const postRules: Record<string, { cs?: CsCodeElem[]; lj?: string; ljn?: string }> = {};
  for (const [domain, rule] of Object.entries(BYPASS_RULES)) {
    if (rule.cs_code || rule.ld_json || rule.ld_json_next) {
      const r: { cs?: CsCodeElem[]; lj?: string; ljn?: string } = {};
      if (rule.cs_code) r.cs = rule.cs_code;
      if (rule.ld_json) r.lj = rule.ld_json;
      if (rule.ld_json_next) r.ljn = rule.ld_json_next;
      postRules[domain] = r;
    }
  }
  if (Object.keys(postRules).length === 0) return '';

  return `
(function() {
  var DOM_RULES = ${JSON.stringify(postRules)};

  function getDomain() {
    try { return window.location.hostname.toLowerCase().replace(/^www\\./, ''); } catch(e) { return ''; }
  }
  function matchRule(d) {
    if (DOM_RULES[d]) return DOM_RULES[d];
    var parts = d.split('.');
    for (var i = 1; i < parts.length; i++) {
      var p = parts.slice(i).join('.');
      if (DOM_RULES[p]) return DOM_RULES[p];
    }
    return null;
  }

  function hideDOMStyle(sel) {
    if (!document.head) return;
    var s = document.createElement('style');
    s.innerText = sel + '{display:none!important}';
    document.head.appendChild(s);
  }

  function runCsCode(elems) {
    for (var i = 0; i < elems.length; i++) {
      var e = elems[i];
      if (e.hide_elem) { hideDOMStyle(e.hide_elem); continue; }
      if (e.add_style && document.head) {
        var s = document.createElement('style');
        s.innerText = e.add_style;
        document.head.appendChild(s);
        continue;
      }
      if (e.cond) {
        var items = document.querySelectorAll(e.cond);
        for (var j = 0; j < items.length; j++) {
          if (e.rm_elem) { items[j].remove(); continue; }
          if (e.rm_class) {
            e.rm_class.split(/[,|]/).forEach(function(c) { items[j].classList.remove(c.trim()); });
          }
          if (e.rm_attrib) {
            e.rm_attrib.split('|').forEach(function(a) { items[j].removeAttribute(a.trim()); });
          }
          if (e.set_attrib) {
            var sp = e.set_attrib.split('|');
            if (sp.length >= 2) items[j].setAttribute(sp[0], sp[1]);
          }
          if (j === 0 && e.elems) runCsCode(e.elems);
        }
      }
    }
  }

  function findKeyJson(obj, re) {
    if (!obj || typeof obj !== 'object') return null;
    for (var k in obj) {
      if (re.test(k)) return obj[k];
      var v = findKeyJson(obj[k], re);
      if (v) return v;
    }
    return null;
  }

  function findKeyNext(obj, keys, minLen) {
    if (!obj || typeof obj !== 'object') return null;
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (typeof v === 'string' && v.length > minLen) return v;
      if (Array.isArray(v) && v.length > 0) return v;
    }
    for (var k in obj) {
      var r = findKeyNext(obj[k], keys, minLen);
      if (r) return r;
    }
    return null;
  }

  function sanitize(html) {
    return String(html).replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, '');
  }

  setTimeout(function() {
    var rule = matchRule(getDomain());
    if (!rule) return;

    if (rule.cs) runCsCode(rule.cs);

    if (rule.lj) {
      var sels = rule.lj.split('|');
      var pwalls = document.querySelectorAll(sels[0]);
      var art = document.querySelector(sels[1]);
      if (pwalls.length && art) {
        for (var i = 0; i < pwalls.length; i++) pwalls[i].remove();
        var scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (var i = 0; i < scripts.length; i++) {
          if (!scripts[i].innerText.match(/"(articlebody|text)":/i)) continue;
          try {
            var json = JSON.parse(scripts[i].text.replace(/[\\r\\n\\t]/g, ''));
            var text = findKeyJson(json, new RegExp('^articlebody$', 'i')) || findKeyJson(json, new RegExp('^text$', 'i'));
            if (text) {
              var div = document.createElement('div');
              div.style.margin = '25px 0';
              div.innerHTML = sanitize(text);
              if (art.parentNode) art.parentNode.replaceChild(div, art);
            }
          } catch(e) {}
          break;
        }
      }
    }

    if (rule.ljn) {
      var sels2 = rule.ljn.split('|');
      var pwalls2 = document.querySelectorAll(sels2[0]);
      var art2 = document.querySelector(sels2[1]);
      if (pwalls2.length && art2) {
        for (var i = 0; i < pwalls2.length; i++) pwalls2[i].remove();
        var jscript = document.querySelector('script#__NEXT_DATA__');
        if (jscript) {
          try {
            var json2 = JSON.parse(jscript.text);
            var text2 = findKeyNext(json2, ['blocks','body','content','contentHtml','html','BodyPlainText'], 500);
            if (text2) {
              var div2 = document.createElement('div');
              div2.innerHTML = sanitize(typeof text2 === 'string' ? text2 : text2.map(function(x) {
                return typeof x === 'string' ? x : (x.text || x.innerHTML || '');
              }).join('<br><br>'));
              if (art2.parentNode) art2.parentNode.replaceChild(div2, art2);
            }
          } catch(e) {}
        }
      }
    }
  }, 1200);
})();
true;
`.trim();
}

export const PAYWALL_BYPASS_PRELOAD_JS: string = buildPreloadJS();
export const PAYWALL_BYPASS_POSTLOAD_JS: string = buildPostloadJS();

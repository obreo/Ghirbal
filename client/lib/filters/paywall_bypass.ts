// Bypass paywall logic ported from bypass-paywalls-firefox-clean
// Mechanisms: UA spoofing, paywall script blocking, DOM manipulation, JSON extraction
//
// ─── HOW TO ADD A NEW SITE ───────────────────────────────────────────────────
// Most paywalls are already bypassed automatically (Piano, Tinypass, Poool,
// Sophi, Pelcro, Zephr, etc. are blocked on every page with no config needed).
//
// If the site still shows a paywall after that, it's likely checking the
// User-Agent and only giving bots full access. Just add the domain below:
//
//   'example.com',          // gets Googlebot UA automatically
//
// That's it. The global script blockers handle the rest.
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
//  ADD NEW SITES HERE — one domain per line, no other config needed
// ══════════════════════════════════════════════════════════════════════════════
const GOOGLEBOT_DOMAINS: string[] = [
  // English
  'ft.com',
  'newyorker.com',
  'theatlantic.com',
  'wired.com',
  'scientificamerican.com',
  'washingtonpost.com',
  'hbr.org',
  'foreignaffairs.com',
  'harpers.org',
  'vanityfair.com',
  'vogue.com',
  'vogue.co.uk',
  'gq.com',
  'architecturaldigest.com',
  'bonappetit.com',
  'cntraveler.com',
  'epicurious.com',
  'pitchfork.com',
  'businessinsider.com',
  'christianitytoday.com',
  'churchtimes.co.uk',
  'bostonmagazine.com',
  // Scandinavian
  'aftenposten.no',
  'dagensmedicin.se',
  'dn.se',
  'hd.se',
  'sydsvenskan.se',
  'bulletinquotidien.fr',
  // Japanese
  'chunichi.co.jp',
  'tokyo-np.co.jp',
  // French
  'actu-environnement.com',
  'aefinfo.fr',
  'actu-juridique.fr',
  // Other
  'bonasavoir.ch',
  'ara.cat',
  'arabalears.cat',
];

export const UA_GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
export const UA_BINGBOT   = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
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
  ua?: 'g' | 'b' | 'f';   // googlebot | bingbot | facebookbot
  block?: string;           // site-specific regex to block (on top of global patterns)
  cs_code?: CsCodeElem[];   // DOM manipulation after page load
  ld_json?: string;         // "paywall_sel|article_sel" — extract from LD-JSON
  ld_json_next?: string;    // "paywall_sel|article_sel" — extract from __NEXT_DATA__
  clear_storage?: boolean;  // clear localStorage + sessionStorage
}

// Paywall platform scripts blocked globally on every page
const GLOBAL_BLOCK_PATTERNS: string[] = [
  '\\.tinypass\\.com\\/',
  '\\.piano\\.io\\/xbuilder\\/experience\\/execute',
  '\\.poool\\.fr\\/',
  'js\\.pelcro\\.com\\/',
  '\\.sophi\\.io\\/',
  'wallkit\\.net\\/',
  '\\.qiota\\.com\\/',
  '\\.axate\\.io',
  'ampproject\\.org\\/v0\\/amp-(access|subscriptions)-.+\\.js',
  '\\.arc-cdn\\.net\\/arc\\/subs\\/',
  '\\.zephr\\.com\\/',
  '\\.leaky-paywall\\.com\\/',
  '\\.cxense\\.com\\/',
];

// Site rules — derived from bypass-paywalls-firefox-clean (sites.js + sites_custom.json)
const BYPASS_RULES: Record<string, BypassRule> = {

  // Sites that need Googlebot UA + a specific extra block rule
  'businessinsider.com': { ua: 'g', block: '(\\.businessinsider\\.com\\/chunks\\/scripts\\/\\d.+\\.js|\\.sophi\\.io\\/)' },

  // ──────────────────────────── Facebookbot UA ─────────────────────────
  'bt.no':       { ua: 'f' },
  'citywire.com':{ ua: 'f' },

  // ──────────────────────── Site-specific script blocks ─────────────────
  'bloomberg.com':           { block: '\\.bwbx\\.io\\/s3\\/fence\\/fortress-client\\/' },
  'adweek.com':              { block: '\\.adweek\\.com\\/wp-content\\/plugins\\/adw-zephr\\/' },
  'historyextra.com':        { block: '\\.historyextra\\.com\\/zephr\\/feature' },
  'barrons.com':             { block: '\\.cxense\\.com\\/' },
  'wsj.com':                 { block: '\\.cxense\\.com\\/' },
  'nytimes.com':             { clear_storage: true },
  'cnbc.com':                { block: '\\.tinypass\\.com\\/' },
  'acadienouvelle.com':      { block: '\\.acadienouvelle\\.com\\/script\\.js' },
  'abajournal.com':          { block: '\\.piano\\.io' },
  'baseballamerica.com':     { block: '\\.tinypass\\.com' },
  'brandonsun.com':          { block: 'account\\.brandonsun\\.com\\/api\\/v\\d\\/auth\\/identify' },
  'brusselstimes.com':       { block: '\\.piano\\.io\\/xbuilder\\/experience\\/execute', cs_code: [{ cond: "div[style*='height: 0;']", rm_attrib: 'style' }] },
  'businessinsider.de':      { block: '\\.piano\\.io' },
  'catholicherald.co.uk':    { block: '\\.catholicherald\\.co\\.uk\\/c\\/assets\\/pigeon\\.js' },
  'catholicherald.org':      { block: '\\.catholicherald\\.co\\.uk\\/c\\/assets\\/pigeon\\.js' },
  'commercialobserver.com':  { block: '\\/commercialobserver\\.com\\/wp-admin\\/admin-ajax\\.php' },
  'corriere.it':             { block: '(\\.tinypass\\.com\\/|\\.ith9ueyuhu\\.it\\/)' },
  'capitalaberto.com.br':    { block: '\\/paywall\\.capitalaberto\\.com\\.br' },
  'clareecho.ie':            { block: '\\.flip-pay\\.com', cs_code: [{ cond: 'div.td-post-content', rm_class: 'td-post-content' }] },
  'craftscouncil.org.uk':    { block: '\\/steadyhq\\.com' },
  'cornwallreports.co.uk':   { block: '\\.axate\\.io' },
  'adage.com':               { block: '(js\\.pelcro\\.com\\/|\\.sophi\\.io\\/)' },
  'autonews.com':            { block: '(js\\.pelcro\\.com\\/|\\.sophi\\.io\\/)' },
  'chicagobusiness.com':     { block: '(js\\.pelcro\\.com\\/|\\.sophi\\.io\\/)' },
  'modernhealthcare.com':    { block: '(js\\.pelcro\\.com\\/|\\.sophi\\.io\\/)' },
  'pionline.com':            { block: '(js\\.pelcro\\.com\\/|\\.sophi\\.io\\/)' },
  'corrieredellosport.it':   { block: '\\.tinypass\\.com\\/' },
  'thebulletin.org':         { block: '\\.tinypass\\.com\\/' },
  'theblaze.com':            { block: '\\.piano\\.io\\/' },
  'boston.com':              { block: '\\.boston\\.com\\/api\\/tinypass\\.min\\.js', cs_code: [{ hide_elem: 'div.m-advert,div.m-content-advert' }] },
  'businesspost.ie':         { block: '\\.businesspost\\.ie\\/api\\/tinypass\\.min\\.js' },
  'al.com':                  { block: '\\.sophi\\.io\\/' },
  'cleveland.com':           { block: '\\.sophi\\.io\\/' },
  'oregonlive.com':          { block: '\\.sophi\\.io\\/' },
  'masslive.com':            { block: '\\.sophi\\.io\\/' },
  'mlive.com':               { block: '\\.sophi\\.io\\/' },
  'nj.com':                  { block: '\\.sophi\\.io\\/' },
  'pennlive.com':            { block: '\\.sophi\\.io\\/' },
  'syracuse.com':            { block: '\\.sophi\\.io\\/' },
  'afr.com':                 { block: '\\.tinypass\\.com\\/' },
  'smh.com.au':              { block: '\\.tinypass\\.com\\/' },
  'theage.com.au':           { block: '\\.tinypass\\.com\\/' },
  'brisbanetimes.com.au':    { block: '\\.tinypass\\.com\\/' },
  'watoday.com.au':          { block: '\\.tinypass\\.com\\/' },
  'adelaidenow.com.au':      { block: '\\.ampproject\\.org\\/v0\\/amp-subscriptions-.+\\.js' },
  'heraldsun.com.au':        { block: '\\.ampproject\\.org\\/v0\\/amp-subscriptions-.+\\.js' },
  'theaustralian.com.au':    { block: '\\.ampproject\\.org\\/v0\\/amp-subscriptions-.+\\.js' },
  'couriermail.com.au':      { block: '\\.ampproject\\.org\\/v0\\/amp-subscriptions-.+\\.js' },
  'cairnspost.com.au':       { block: '\\.ampproject\\.org\\/v0\\/amp-subscriptions-.+\\.js' },

  // ──────────────────────────── DOM manipulation ────────────────────────
  'anandabazar.com': {
    block: '\\.anandabazar.com\\/subscription-assets\\/js\\/paywall.*\\.js',
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

  // ─────────────────────────── Content extraction ───────────────────────
  'argaam.com':               { ld_json: 'div.subscription-package-article|div.restricted-article' },
  'athensreviewofbooks.com':  { ld_json: 'div.freeUser|div.itemBody' },
  'aftermath.site':           { ld_json_next: "div[class^='ContentGate_wrapper']|div[class^='PostContent_wrapper']" },
};

const UA_MAP: Record<string, string> = { g: UA_GOOGLEBOT, b: UA_BINGBOT, f: UA_FACEBOOKBOT };

const GOOGLEBOT_SET = new Set(GOOGLEBOT_DOMAINS.map(d => d.toLowerCase()));
const GOOGLEBOT_RULE: BypassRule = { ua: 'g' };

function findRule(hostname: string): BypassRule | null {
  const d = hostname.toLowerCase().replace(/^www\./, '');

  // Check simple googlebot list first (BYPASS_RULES can override with extra fields)
  const fromSimpleList = GOOGLEBOT_SET.has(d);

  // Check advanced rules
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

// ─────────────────────── Build injected JS strings ───────────────────────

function buildPreloadJS(): string {
  // Flatten rules to only what the preload script needs
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

  // Override XMLHttpRequest
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

  // Override fetch
  if (typeof window.fetch === 'function') {
    var _fetch = window.fetch;
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input ? input.url : '');
      if (blocked(url)) return Promise.reject(new TypeError('bpc'));
      return _fetch.apply(this, arguments);
    };
  }

  // Clear storage if rule requires it
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

    // DOM manipulation
    if (rule.cs) runCsCode(rule.cs);

    // LD-JSON extraction
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

    // __NEXT_DATA__ extraction
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

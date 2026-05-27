/**
 * paywall_extras.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * STANDALONE enhancements for paywall bypass.
 * These are NOT yet wired into the app. Integrate one at a time after testing.
 *
 * HOW TO INTEGRATE (BrowserScreen.tsx):
 *
 *   import {
 *     getRefererHeaders,
 *     getAmpUrl,
 *     getArchiveUrl,
 *     REFERER_SPOOF_PRELOAD_JS,
 *   } from '@/lib/filters/paywall_extras';
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getBypassRule } from './paywall_bypass';

// ══════════════════════════════════════════════════════════════════════════════
// 1. REFERER HEADER INJECTION
//    For the initial page load, inject Referer: https://www.google.com/
//    Works on: FT.com, WSJ, and any site that does server-side referrer checks.
//
//    INTEGRATION STEPS:
//      a) Add `referer` field to BypassRule in paywall_bypass.ts (already done below)
//      b) In the WebView's source prop, spread getRefererHeaders(url):
//
//         <WebView
//           source={{ uri: tab.url, ...getRefererHeaders(tab.url) }}
//           ...
//         />
//
//      c) In handleShouldStartLoadWithRequest, intercept navigation and
//         update the tab URL (return false) so the WebView re-renders with headers:
//
//         const shouldStartLoad = useCallback((request) => {
//           const { url } = request;
//           const headers = getRefererHeaders(url);
//           if (headers && activeTabId) {
//             updateTab(activeTabId, { sourceUrl: url });
//             setForceNavCounter(c => c + 1);
//             return false;  // cancel, let re-render handle it with headers
//           }
//           return true;
//         }, [activeTabId, updateTab, setForceNavCounter]);
//
//    NOTE: This only affects the initial HTML fetch. JS-initiated XHR/fetch
//    requests from within the page still use the page origin as referer.
//    Use REFERER_SPOOF_PRELOAD_JS (below) to also cover those.
// ══════════════════════════════════════════════════════════════════════════════

/** Sites that need a Google referer header to receive full content */
const REFERER_DOMAINS: Record<string, string> = {
  'ft.com':             'https://www.google.com/',
  'wsj.com':            'https://www.google.com/',
  'barrons.com':        'https://www.google.com/',
  'bloomberg.com':      'https://www.google.com/',
  'economist.com':      'https://www.google.com/',
  'thetimes.com':       'https://www.google.com/',
  'telegraph.co.uk':    'https://www.google.com/',
  'latimes.com':        'https://www.google.com/',
  'bostonglobe.com':    'https://www.google.com/',
  'theatlantic.com':    'https://www.google.com/',
  'newyorker.com':      'https://www.google.com/',
  'wired.com':          'https://www.google.com/',
  'foreignpolicy.com':  'https://www.google.com/',
  'foreignaffairs.com': 'https://www.google.com/',
  'theguardian.com':    'https://www.google.com/',
  'nytimes.com':        'https://www.google.com/',
  'washingtonpost.com': 'https://www.google.com/',
  'scientificamerican.com': 'https://www.google.com/',
  'hbr.org':            'https://www.google.com/',
  'thehindu.com':       'https://www.google.com/',
  'scmp.com':           'https://www.google.com/',
  'japantimes.co.jp':   'https://www.google.com/',
  'sueddeutsche.de':    'https://www.google.com/',
  'zeit.de':            'https://www.google.com/',
  'nzz.ch':             'https://www.google.com/',
  'elpais.com':         'https://www.google.com/',
  'lemonde.fr':         'https://www.google.com/',
  'lefigaro.fr':        'https://www.google.com/',
};

/**
 * Returns `{ headers: { Referer: '...' } }` to spread into WebView source prop,
 * or `{}` if no referer spoofing is needed for this URL.
 *
 * Usage:
 *   <WebView source={{ uri: url, ...getRefererHeaders(url) }} />
 */
export function getRefererHeaders(url: string): { headers?: Record<string, string> } {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`)
      .hostname.toLowerCase().replace(/^www\./, '');

    // Direct match
    if (REFERER_DOMAINS[hostname]) {
      return { headers: { Referer: REFERER_DOMAINS[hostname] } };
    }

    // Subdomain match (e.g. asia.nikkei.com → nikkei.com)
    const parts = hostname.split('.');
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(i).join('.');
      if (REFERER_DOMAINS[parent]) {
        return { headers: { Referer: REFERER_DOMAINS[parent] } };
      }
    }
  } catch {}
  return {};
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. REFERER SPOOF IN JS (covers XHR / fetch from within the page)
//    Injected as a preload script. Overrides fetch() and XMLHttpRequest to
//    append a Referer header on every outbound request from the page.
//
//    INTEGRATION STEPS:
//      Concatenate REFERER_SPOOF_PRELOAD_JS into injectedJavaScriptBeforeContentLoaded
//      for tabs that need referer spoofing:
//
//        const needsReferer = !!getRefererHeaders(tab.url)?.headers;
//        injectedJavaScriptBeforeContentLoaded={
//          ... + (needsReferer ? REFERER_SPOOF_PRELOAD_JS : '')
//        }
//
//    IMPORTANT: This is blocked if the page has a strict Content-Security-Policy
//    that forbids inline scripts. It will still be blocked on those pages.
// ══════════════════════════════════════════════════════════════════════════════

export const REFERER_SPOOF_PRELOAD_JS: string = `
(function() {
  var SPOOF_REFERER = 'https://www.google.com/';

  // Override fetch
  var _fetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      init = init || {};
      init.headers = init.headers || {};
      if (typeof init.headers === 'object' && !init.headers['Referer']) {
        init.headers['Referer'] = SPOOF_REFERER;
      }
    } catch(e) {}
    return _fetch.apply(this, arguments);
  };

  // Override XHR
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function() {
    this._spoofReferer = true;
    return _open.apply(this, arguments);
  };
  var _setReqHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (name && name.toLowerCase() === 'referer') return; // let our send override it
    return _setReqHeader.apply(this, arguments);
  };
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._spoofReferer) {
      try { _setReqHeader.call(this, 'Referer', SPOOF_REFERER); } catch(e) {}
    }
    return _send.apply(this, arguments);
  };
})();
true;
`.trim();


// ══════════════════════════════════════════════════════════════════════════════
// 3. ARCHIVE.IS FALLBACK
//    When a paywall is detected, offer to load the page from archive.ph.
//    archive.ph stores snapshots of web pages without paywalls.
//
//    INTEGRATION STEPS (two options):
//
//    Option A — Manual button in the browser UI:
//      Show a "Try archived version" button when a paywall is suspected.
//      On press: navigate the tab to getArchiveUrl(tab.url)
//
//    Option B — Auto-detect and redirect:
//      In the WebView's onMessage handler, listen for a 'paywallDetected' message
//      (sent by a postload JS snippet), then auto-navigate to archive.ph.
//
//    PAYWALL DETECTION SNIPPET (inject as postload JS):
//      window.ReactNativeWebView.postMessage(JSON.stringify({
//        type: 'paywallDetected',
//        url: window.location.href
//      }));
//      Trigger condition: check for common paywall indicators:
//        document.querySelector('.paywall, [class*="paywall"], [id*="paywall"]')
//        or document.body.scrollHeight < 800 (truncated article)
// ══════════════════════════════════════════════════════════════════════════════

const ARCHIVE_BASE = 'https://archive.ph/';

/**
 * Returns the archive.ph URL for a given article URL.
 * Loading this in the WebView shows the archived (paywall-free) snapshot.
 *
 * Usage:
 *   navigation.navigate to getArchiveUrl(currentUrl)
 */
export function getArchiveUrl(url: string): string {
  return `${ARCHIVE_BASE}${encodeURIComponent(url)}`;
}

/**
 * Returns the archive.ph "newest" snapshot URL, which skips the redirect page.
 * More reliable for direct navigation.
 */
export function getArchiveNewestUrl(url: string): string {
  return `${ARCHIVE_BASE}newest/${encodeURIComponent(url)}`;
}

/**
 * Detects if the current URL is already an archive.ph URL.
 */
export function isArchiveUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'archive.ph' || host === 'archive.is' || host === 'archive.today';
  } catch {
    return false;
  }
}

/**
 * Postload JS snippet that detects a paywall and sends a message to React Native.
 * Inject this in injectedJavaScript for sites where paywall bypass may fail.
 *
 * In onMessage handler:
 *   if (data.type === 'paywallDetected') { offer archive.ph navigation }
 */
export const PAYWALL_DETECT_JS: string = `
(function() {
  setTimeout(function() {
    var paywallSelectors = [
      '[class*="paywall"]', '[id*="paywall"]',
      '[class*="subscribe"]', '[class*="subscription"]',
      '[class*="meter"]', '[class*="gate"]',
      'div.piano-offer-overlay', 'div.tp-modal',
      'div[data-tp-snap]', 'div.pn-widget',
      'div.zephr-', '[class*="zephr"]',
    ];
    var found = paywallSelectors.some(function(sel) {
      try { return document.querySelector(sel) !== null; } catch(e) { return false; }
    });

    // Also detect if article body is suspiciously short (truncated content)
    var articleEl = document.querySelector('article, [class*="article-body"], [class*="story-body"]');
    var isTruncated = articleEl && articleEl.innerText.trim().length < 500;

    if (found || isTruncated) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'paywallDetected',
        url: window.location.href,
        method: found ? 'selector' : 'truncated'
      }));
    }
  }, 2000);
})();
true;
`.trim();


// ══════════════════════════════════════════════════════════════════════════════
// 4. AMP REDIRECT
//    AMP pages often serve full content without paywalls and load faster.
//    Try redirecting to the AMP version before loading the full page.
//
//    INTEGRATION STEPS:
//      In handleShouldStartLoadWithRequest (or before setting tab URL):
//
//        const ampUrl = getAmpUrl(url);
//        if (ampUrl && ampUrl !== url) {
//          updateTab(activeTabId, { url: ampUrl, sourceUrl: ampUrl });
//          setForceNavCounter(c => c + 1);
//          return false;
//        }
//
//    NOTE: Not all sites have AMP versions. getAmpUrl() only attempts
//    transformation for known AMP-enabled domains. If the AMP URL 404s,
//    the WebView's onError can fall back to the original URL.
//
//    FALLBACK: if AMP 404s, use onError to load the original URL instead.
// ══════════════════════════════════════════════════════════════════════════════

/** Domains known to support AMP pages with full (or fuller) content */
const AMP_DOMAINS: Record<string, (path: string, search: string) => string> = {
  // /amp suffix pattern
  'theatlantic.com':          (p, s) => `${p}/amp${s}`,
  'theguardian.com':          (p, s) => `${p}/amp${s}`,
  'washingtonpost.com':       (p, s) => `${p}/amp${s}`,
  'nytimes.com':              (p, s) => `${p}/amp${s}`,
  'forbes.com':               (p, s) => `${p}/amp${s}`,
  'businessinsider.com':      (p, s) => `${p}/amp${s}`,
  'huffingtonpost.com':       (p, s) => `${p}/amp${s}`,
  'huffpost.com':             (p, s) => `${p}/amp${s}`,
  'buzzfeed.com':             (p, s) => `${p}/amp${s}`,
  'usatoday.com':             (p, s) => `${p}/amp${s}`,
  'time.com':                 (p, s) => `${p}/amp${s}`,
  'rollingstone.com':         (p, s) => `${p}/amp${s}`,
  'vulture.com':              (p, s) => `${p}/amp${s}`,
  'nymag.com':                (p, s) => `${p}/amp${s}`,
  'thecut.com':               (p, s) => `${p}/amp${s}`,
  'esquire.com':              (p, s) => `${p}/amp${s}`,
  'elespectador.com':         (p, s) => `${p}/amp${s}`,
  'elconfidencial.com':       (p, s) => `${p}/amp${s}`,
  'elpais.com':               (p, s) => `${p}/amp${s}`,
  'elmercurio.com':           (p, s) => `${p}/amp${s}`,
  'corriere.it':              (p, s) => `${p}/amp${s}`,
  'lastampa.it':              (p, s) => `${p}/amp${s}`,
  'abcnews.go.com':           (p, s) => `${p}/amp${s}`,
  'cbsnews.com':              (p, s) => `${p}/amp${s}`,
  // ?amp=1 query param pattern
  'thehindu.com':             (p, s) => `${p}${s ? s + '&' : '?'}amp=1`,
  'hindustantimes.com':       (p, s) => `${p}${s ? s + '&' : '?'}amp=1`,
  'indiatoday.in':            (p, s) => `${p}${s ? s + '&' : '?'}amp=1`,
  'ndtv.com':                 (p, s) => `${p}${s ? s + '&' : '?'}amp=1`,
  // Subdomain pattern: amp.domain.com
  'ft.com':                   (p, s) => null as any, // FT.com AMP does NOT bypass paywall
};

/**
 * Returns an AMP version of the given URL, or null if AMP is not supported
 * for this domain or if the URL looks like it's already an AMP page.
 *
 * Usage:
 *   const ampUrl = getAmpUrl(url);
 *   if (ampUrl) navigateTo(ampUrl); else navigateTo(url);
 */
export function getAmpUrl(url: string): string | null {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    const path = urlObj.pathname;
    const search = urlObj.search;

    // Already an AMP page
    if (path.endsWith('/amp') || path.endsWith('/amp/') || search.includes('amp=1')) {
      return null;
    }

    // Must be an article path (has at least one path segment with content)
    const isArticlePath = path.split('/').filter(Boolean).length >= 2;
    if (!isArticlePath) return null;

    const transformer = AMP_DOMAINS[hostname];
    if (!transformer) return null;

    const newPath = transformer(path, search);
    if (!newPath) return null;

    return `${urlObj.origin}${newPath}`;
  } catch {
    return null;
  }
}

/**
 * Returns true if the URL is a known AMP URL (already on AMP version).
 */
export function isAmpUrl(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return (
      urlObj.pathname.endsWith('/amp') ||
      urlObj.pathname.endsWith('/amp/') ||
      urlObj.search.includes('amp=1') ||
      urlObj.hostname.startsWith('amp.')
    );
  } catch {
    return false;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// COMBINED HELPER — attempt order for a given URL
// ══════════════════════════════════════════════════════════════════════════════

export type BypassAttempt =
  | { method: 'referer'; headers: Record<string, string> }
  | { method: 'amp'; url: string }
  | { method: 'archive'; url: string }
  | { method: 'none' };

/**
 * Returns the recommended bypass attempts for a URL in priority order.
 * Use this to decide which strategy to try first.
 *
 * Priority:
 *   1. Referer header injection (cheapest, invisible to user)
 *   2. AMP redirect (still same domain, usually works)
 *   3. Archive.ph fallback (different domain, but reliable)
 */
export function getBypassAttempts(url: string): BypassAttempt[] {
  const attempts: BypassAttempt[] = [];

  const refererHeaders = getRefererHeaders(url);
  if (refererHeaders.headers) {
    attempts.push({ method: 'referer', headers: refererHeaders.headers });
  }

  const ampUrl = getAmpUrl(url);
  if (ampUrl) {
    attempts.push({ method: 'amp', url: ampUrl });
  }

  attempts.push({ method: 'archive', url: getArchiveNewestUrl(url) });

  return attempts;
}

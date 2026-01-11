import { getAllBlockedDomains, CUSTOM_BLOCKLIST } from './Blocklist/blocklist';
import { isMediaBlockingEnabled } from './app-config';
import { isMediaWhitelisted } from './media-whitelist';
import {
  isGoogleAuthUrl,
  isGoogleSearchDomain,
  isGoogleHomePage,
  isBlockedGoogleSection,
  getGoogleUiCleanupScript,
  enforceGoogleSafeSearch,
  GOOGLE_SAFESEARCH_SUPPRESSION_JS,
  GOOGLE_SECTIONS_BLOCK_JS,
  isGoogleSearchUrl,
} from './search_engine_restrictions';
import {
  enforceRedditSafe,
  isRedditUrl,
  REDDIT_EARLY_CSS_JS,
  REDDIT_NSFW_FILTER_JS,
  isNsfwRedditUrl,
  isBlockedRedditPath,
  isSubredditPage,
  getSubredditName,
} from './filters/reddit_filters';
import {
  MEDIA_BLOCK_PRELOAD_JS,
  MEDIA_BLOCK_POSTLOAD_JS,
  getMediaFilterScript,
  getMediaFilterPreloadScript,
} from './filters/visuals_filters';
import {
  isYouTubeUrl,
  isYouTubeShortsFromChannel,
  isBlockedYouTubeShortsUrl,
  isYouTubeVideoPage,
  getYouTubeContentFilterScript,
  YOUTUBE_CONTENT_FILTER_JS,
} from './filters/youtube_filter';

export {
  enforceRedditSafe,
  isRedditUrl,
  REDDIT_EARLY_CSS_JS,
  REDDIT_NSFW_FILTER_JS,
  isNsfwRedditUrl,
  isBlockedRedditPath,
  isSubredditPage,
  getSubredditName,
  MEDIA_BLOCK_PRELOAD_JS,
  MEDIA_BLOCK_POSTLOAD_JS,
  getMediaFilterScript,
  getMediaFilterPreloadScript,
  isYouTubeUrl,
  isYouTubeShortsFromChannel,
  isBlockedYouTubeShortsUrl,
  isYouTubeVideoPage,
  getYouTubeContentFilterScript,
  YOUTUBE_CONTENT_FILTER_JS,
  isMediaWhitelisted,
};

// Re-export constants for UI
export const BLOCKED_SITES_LIST = CUSTOM_BLOCKLIST;

// ====================================================
// ===== SAFESEARCHENGINE.COM AS PRIMARY HOMEPAGE =====
// ====================================================
const SAFE_SEARCH_ENGINE_URL = 'https://safesearchengine.com/';

// Simple check: Is the referrer from safesearchengine.com?
export function isReferrerFromSafeSearch(referrerUrl: string | null | undefined): boolean {
  console.log('[isReferrerFromSafeSearch] Checking referrer:', referrerUrl);

  if (!referrerUrl) {
    console.log('[isReferrerFromSafeSearch] ❌ No referrer URL provided');
    return false;
  }

  try {
    const url = new URL(referrerUrl.startsWith('http') ? referrerUrl : `https://${referrerUrl}`);
    const domain = url.hostname.toLowerCase().replace(/^www\./, '');
    const isSafeSearch = domain === 'safesearchengine.com';

    console.log('[isReferrerFromSafeSearch] Domain:', domain);
    console.log('[isReferrerFromSafeSearch] Result:', isSafeSearch ? '✓ YES' : '❌ NO');

    return isSafeSearch;
  } catch (e) {
    console.log('[isReferrerFromSafeSearch] ❌ Error parsing URL:', e);
    return false;
  }
}


// Check if URL is an OAuth callback URL (any domain receiving OAuth redirect)
// This is used to skip heavy script injection during OAuth flows
export function isOAuthCallbackUrl(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const search = urlObj.search.toLowerCase();

    // OAuth callback URLs typically contain authorization code or tokens
    const callbackParams = [
      'code=',           // Authorization code (most common)
      'access_token=',   // Implicit grant
      'id_token=',       // OpenID Connect
      'oauth_token=',    // OAuth 1.0
      'oauth_verifier=', // OAuth 1.0
    ];

    // Must also have state parameter (CSRF protection) to be a valid OAuth callback
    const hasState = search.includes('state=');
    const hasCallbackParam = callbackParams.some(param => search.includes(param));

    return hasState && hasCallbackParam;
  } catch {
    return false;
  }
}



export function isSafeSearchEnginePage(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    return domain === 'safesearchengine.com';
  } catch {
    return false;
  }
}

// ================================================================
// ================================================================
//
// ========================= FILTERS LIST =========================
//
// ================================================================
// ================================================================

// ====================================================================
// =============== FILTER OUT SEARCH ENGINES EXCEPT GOOGLE ============
// ====================================================================
const BLOCKED_SEARCH_ENGINES = ["yandex.com", "yandex.ru", "duckduckgo.com"];


// ====================================================================
// =============== BLOCKED DOMAINS LIST ===============================
// ====================================================================
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^www\./, "");
  }
}

// Check if domain is in blocked domains list
export function isBlockedDomain(url: string): boolean {
  // Always allow Google Auth URLs
  if (isGoogleAuthUrl(url)) {
    return false;
  }
  const domain = extractDomain(url).toLowerCase();
  // Use getAllBlockedDomains() to include external/local blocklists when available,
  // fallback to BLOCKED_DOMAINS + CUSTOM_BLOCKLIST for synchronous access
  const allBlocked = [...getAllBlockedDomains()];
  return allBlocked.some(
    (blocked) => {
      const b = blocked.toLowerCase();
      return domain === b || domain.endsWith(`.${b}`);
    },
  );
}

// Check if URL is a blocked search engine
export function isBlockedSearchEngine(url: string): boolean {
  const domain = extractDomain(url).toLowerCase();
  return BLOCKED_SEARCH_ENGINES.some(
    (blocked) => domain === blocked || domain.endsWith(`.${blocked}`),
  );
}


// ====================================================================
// =============== BLOCKED SOCIAL MEDIA PAGES ========================
// ====================================================================

// Instagram URL blocking logic
export function isBlockedInstagramUrl(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    const domain = urlObj.hostname.toLowerCase();

    if (!domain.includes("instagram.com")) {
      return false;
    }

    const path = urlObj.pathname;

    // Allow if it's a reel or post with content
    if (path.startsWith('/reel/') && path.length > '/reel/'.length) {
      return false;
    }
    if (path.startsWith('/p/') && path.length > '/p/'.length) {
      return false;
    }

    // Block all other Instagram URLs
    return true;
  } catch {
    return false;
  }
}

// Facebook URL blocking logic
export function isBlockedFacebookUrl(url: string): boolean {
  try {
    // Handle sfbfi scheme
    if (url.startsWith("sfbfi://")) return false;

    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    const domain = urlObj.hostname.toLowerCase();

    // Check for Facebook, Messenger, and related domains
    const isFacebook = domain.includes("facebook.com") ||
      domain.includes("fb.com") ||
      domain.includes("messenger.com") ||
      domain.includes("fbsbx.com") ||
      domain.includes("fb.me");

    if (!isFacebook) {
      return false;
    }

    const path = urlObj.pathname.toLowerCase();
    const search = urlObj.search.toLowerCase();

    // Allow normal Facebook usage
    return false;
  } catch (error) {
    return false;
  }
}

// ====================================================================
// =============== APK DOWNLOAD DETECTION =============================
// ====================================================================
export function isApkDownload(url: string): boolean {
  const lowerUrl = url.toLowerCase();

  // Check file extensions
  if (
    lowerUrl.endsWith(".apk") ||
    lowerUrl.endsWith(".xapk") ||
    lowerUrl.endsWith(".apkm") ||
    lowerUrl.endsWith(".apkx") ||
    lowerUrl.endsWith(".apks")
  ) {
    return true;
  }

  // Check URL path and query parameters for APK-related patterns
  const apkPatterns = [
    '/download.apk',
    '/app.apk',
    '.apk?',
    '.apk&',
    '/apk/',
    'download=apk',
    'type=apk',
    'file=apk',
    'format=apk',
    '/getapk',
    '/downloadapk',
    '/apk-download',
    'apkpure.com',
    'apkmirror.com',
    'apkcombo.com',
    'apk-dl.com',
    'aptoide.com',
  ];

  if (apkPatterns.some(pattern => lowerUrl.includes(pattern))) {
    return true;
  }

  // Check Content-Disposition-like patterns in URL
  if (lowerUrl.includes('application/vnd.android.package-archive') ||
    lowerUrl.includes('application%2fvnd.android.package-archive')) {
    return true;
  }

  return false;
}


export function processUrl(inputUrl: string): {
  url: string;
  blocked: boolean;
  reason?: string;
  redirect?: string;
} {
  let url = inputUrl.trim();

  // Handle special schemes (deep links) - don't prepend https://
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(url);
  const isWebScheme = url.startsWith("http://") || url.startsWith("https://");

  if (!hasScheme) {
    url = `https://${url}`;
  } else if (!isWebScheme) {
    // It's a non-web scheme (fb://, intent://, whatsapp:// etc.)
    // We allow it to pass through so handleShouldStartLoadWithRequest can deal with it
    return { url, blocked: false };
  }

  if (isApkDownload(url)) {
    return { url, blocked: true, reason: "APK downloads are not allowed" };
  }

  if (isBlockedDomain(url)) {
    return { url, blocked: true, reason: "This website is blocked for safety" };
  }

  if (isBlockedSearchEngine(url)) {
    return {
      url,
      blocked: true,
      reason: "This search engine is not allowed. Please use Google.",
    };
  }

  // Block Google Images, Videos, and Shorts sections
  if (isBlockedGoogleSection(url)) {
    return {
      url,
      blocked: true,
      reason: "Google Images, Videos, and Shorts are blocked",
    };
  }

  if (isNsfwRedditUrl(url)) {
    return {
      url,
      blocked: true,
      reason: "This Reddit content is blocked for safety",
    };
  }

  if (isBlockedRedditPath(url)) {
    return {
      url,
      blocked: true,
      reason: "This Reddit page is blocked",
    };
  }

  if (isBlockedInstagramUrl(url)) {
    return {
      url,
      blocked: true,
      reason: "This Instagram content is blocked. Only reels and posts are allowed.",
    };
  }

  if (isBlockedFacebookUrl(url)) {
    return {
      url,
      blocked: true,
      reason: "This Facebook content is blocked for safety",
    };
  }

  url = enforceGoogleSafeSearch(url);
  url = enforceRedditSafe(url);

  return { url, blocked: false };
}

export function isValidUrl(input: string): boolean {
  const trimmed = input.trim();
  const urlPattern = /^(https?:\/\/)?[\w\-.]+(\.[\w\-]+)+.*$/i;
  return urlPattern.test(trimmed);
}

export function formatSearchUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
  // Use safesearchengine.com for all searches from the URL bar
  return `https://safesearchengine.com/search?q=${encodedQuery}`;
}

export function getUrlOrSearch(input: string): string {
  const trimmed = input.trim();
  if (isValidUrl(trimmed)) {
    const { url } = processUrl(trimmed);
    return url;
  }
  return formatSearchUrl(trimmed);
}


// Moved to ./filters/youtube_filter.ts

// Re-export blocklist initialization for app startup
export { initializeBlocklists } from './Blocklist/blocklist';

// Re-export media whitelist functions
export { getWhitelistedDomains, getWhitelistedPaths } from './media-whitelist';


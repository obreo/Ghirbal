/**
 * Media Whitelist Configuration
 * 
 * This file contains domains and paths that are exempt from the 
 * image/video blur filter. By default, all images and videos in 
 * website body sections are hidden/blurred except for sites listed here.
 */

// Domains that are fully exempt from media filtering
// Images and videos will be shown normally on these domains
export const WHITELISTED_DOMAINS: string[] = [
  // Safe search engine (primary homepage)
  "safesearchengine.com",

  // Google authentication and OAuth (needed for "Sign in with Google")
  "accounts.google.com",
  "myaccount.google.com",
  "accounts.youtube.com",
  "gsi.gstatic.com",
  "iframerpc.gstatic.com",
  "oauth2.googleapis.com",
  "securetoken.googleapis.com",
  "identitytoolkit.googleapis.com",
  "content.googleapis.com",
  "sts.googleapis.com",

  // Educational platforms
  "wikipedia.org",
  "wikimedia.org",
  "khanacademy.org",
  "coursera.org",
  "edx.org",
  "udemy.com",
  "skillshare.com",

  // News sites (trusted)
  "bbc.com",
  "bbc.co.uk",
  "reuters.com",
  "apnews.com",

  // Development/Documentation
  "github.com",
  "stackoverflow.com",
  "developer.mozilla.org",
  "docs.google.com",
  "medium.com",

  // Shopping (product images needed)
  "amazon.com",
  "amazon.co.uk",
  "ebay.com",

  // Maps
  "maps.google.com",
  "google.com/maps",

  // Cloud storage (for viewing own files)
  "drive.google.com",
  "dropbox.com",
  "onedrive.live.com",
];

// Specific paths that are exempt (format: "domain.com/path")
// This allows whitelisting specific pages while keeping the domain filtered
export const WHITELISTED_PATHS: string[] = [
  // Google specific allowed paths
  // Google specific allowed paths
  // "google.com/search", // Search results page (REMOVED: to enforce media blocking)

  // YouTube channel pages (allow viewing channel art)
  "youtube.com/channel",
  "youtube.com/@",
  "youtube.com/c/",

  // Reddit specific paths where media is needed
  // Subreddit pages
];

// Domains where ONLY logos/icons in header/footer/nav are allowed
// but all other images/videos in body are filtered
// This is the default behavior for non-whitelisted sites
// export const PARTIAL_FILTER_DOMAINS: string[] = [
//   "google.com",
//   "facebook.com",
//   "instagram.com",
// ];

/**
 * Check if a domain is fully whitelisted for media
 * @param hostname - The hostname to check (e.g., "www.wikipedia.org")
 * @returns true if the domain is whitelisted
 */
export function isDomainWhitelisted(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');

  return WHITELISTED_DOMAINS.some(domain => {
    const normalizedDomain = domain.toLowerCase();
    return normalizedHost === normalizedDomain ||
      normalizedHost.endsWith(`.${normalizedDomain}`);
  });
}

/**
 * Check if a specific URL path is whitelisted for media
 * @param url - The full URL to check
 * @returns true if the path is whitelisted
 */
export function isPathWhitelisted(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = urlObj.pathname.toLowerCase();
    const fullPath = `${hostname}${pathname}`;

    return WHITELISTED_PATHS.some(path => {
      const normalizedPath = path.toLowerCase();
      return fullPath.startsWith(normalizedPath) ||
        fullPath.includes(normalizedPath);
    });
  } catch {
    return false;
  }
}

/**
 * Check if a URL is whitelisted for media display
 * @param url - The URL to check
 * @returns true if images/videos should be shown normally
 */
export function isMediaWhitelisted(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname;

    // Check if domain is fully whitelisted
    if (isDomainWhitelisted(hostname)) {
      return true;
    }

    // Check if specific path is whitelisted
    if (isPathWhitelisted(url)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get the list of whitelisted domains for display in settings
 */
export function getWhitelistedDomains(): string[] {
  return [...WHITELISTED_DOMAINS];
}

/**
 * Get the list of whitelisted paths for display in settings
 */
export function getWhitelistedPaths(): string[] {
  return [...WHITELISTED_PATHS];
}


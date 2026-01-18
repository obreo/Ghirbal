// ====================================================================
// ========== YOUTUBE SHORTS BLOCKING ==========
// ====================================================================

/**
 * Check if URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
    try {
        const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
        const domain = urlObj.hostname.toLowerCase();
        return domain.includes("youtube.com") || domain.includes("youtu.be") || domain.includes("m.youtube.com");
    } catch {
        return false;
    }
}

/**
 * Check if user is navigating from a YouTube channel to a short
 * Shorts from channels are allowed (e.g. /channel/XXX or /@username)
 */
export function isYouTubeShortsFromChannel(url: string, referrer: string | null): boolean {
    if (!referrer) return false;

    try {
        const referrerUrl = new URL(referrer);
        const referrerPath = referrerUrl.pathname.toLowerCase();

        // Check if referrer is a channel page
        const isFromChannel =
            referrerPath.startsWith('/channel/') ||
            referrerPath.startsWith('/@') ||
            referrerPath.startsWith('/c/') ||
            referrerPath.startsWith('/user/');

        return isFromChannel;
    } catch {
        return false;
    }
}

/**
 * Check if URL is a YouTube Shorts URL that should be blocked
 * Blocks /shorts/ URLs unless they come from a channel
 */
export function isBlockedYouTubeShortsUrl(url: string, referrer: string | null = null): boolean {
    try {
        const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
        const domain = urlObj.hostname.toLowerCase();

        // Only applies to YouTube
        if (!domain.includes("youtube.com") && !domain.includes("m.youtube.com")) {
            return false;
        }

        const path = urlObj.pathname.toLowerCase();

        // Check if it's a shorts URL
        if (path.startsWith('/shorts') || path.startsWith('/shorts/')) {
            // Allow if coming from a channel
            if (isYouTubeShortsFromChannel(url, referrer)) {
                return false;
            }
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

/**
 * Check if URL is a YouTube video page
 */
export function isYouTubeVideoPage(url: string): boolean {
    try {
        const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
        const domain = urlObj.hostname.toLowerCase();

        if (!domain.includes("youtube.com") && !domain.includes("youtu.be") && !domain.includes("m.youtube.com")) {
            return false;
        }

        // youtube.com/watch?v=... 
        if (urlObj.pathname.includes('/watch')) {
            return true;
        }

        // youtu.be/VIDEO_ID
        if (domain.includes("youtu.be") && urlObj.pathname.length > 1) {
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

/**
 * Generate YouTube content filtering script
 * 1. Block /shorts/ page navigation (redirect to home)
 * 2. Force restricted mode (configurable)
 * 3. Hide shorts: tab, shelves, search results (.big-shorts-singleton, pivot-shorts)
 * 4. Hide suggested videos: #secondary, related-items section
 * 
 * @param alwaysRestricted - If true, restricted mode is always on (even on video pages)
 *                           If false, restricted mode is dynamic (off on video pages for comments)
 */
export function getYouTubeContentFilterScript(alwaysRestricted: boolean): string {
    return `
(function() {
  'use strict';
  console.log('[YT Filter] Starting...');

  // ===== UTILITY FUNCTIONS =====
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name, value) {
    // Try multiple approaches for React Native WebView compatibility
    try {
      // Method 1: Standard document.cookie
      document.cookie = name + "=" + encodeURIComponent(value) + "; path=/; domain=.youtube.com; expires=Fri, 31 Dec 9999 23:59:59 GMT; SameSite=Lax";
      console.log('[YT Filter] Cookie set via document.cookie:', name + '=' + value);

      // Method 2: Try different domain variations
      document.cookie = name + "=" + encodeURIComponent(value) + "; path=/; domain=.m.youtube.com; expires=Fri, 31 Dec 9999 23:59:59 GMT; SameSite=Lax";
      document.cookie = name + "=" + encodeURIComponent(value) + "; path=/; domain=youtube.com; expires=Fri, 31 Dec 9999 23:59:59 GMT; SameSite=Lax";
      document.cookie = name + "=" + encodeURIComponent(value) + "; path=/; domain=m.youtube.com; expires=Fri, 31 Dec 9999 23:59:59 GMT; SameSite=Lax";

      // Method 3: Try without domain for current host
      document.cookie = name + "=" + encodeURIComponent(value) + "; path=/; expires=Fri, 31 Dec 9999 23:59:59 GMT; SameSite=Lax";

      // Verify the cookie was set
      var verifyCookie = getCookie(name);
      console.log('[YT Filter] Cookie verification - set:', value, 'read:', verifyCookie);

    } catch(e) {
      console.error('[YT Filter] Error setting cookie:', e);
    }
  }

  function isVideoPage() {
    var path = window.location.pathname;
    return path.includes('/watch') || path.includes('/embed/');
  }

  function isChannelPage() {
    var path = window.location.pathname.toLowerCase();
    return path.startsWith('/channel/') || path.startsWith('/@') || path.startsWith('/c/') || path.startsWith('/user/');
  }

  function isShortsPage() {
    return window.location.pathname.toLowerCase().startsWith('/shorts');
  }

  // Block shorts page navigation
  function blockShortsPage() {
    if (isShortsPage() && !isChannelPage()) {
      console.log('[YT Filter] Redirecting away from shorts page');
      window.location.href = '/';
      return true;
    }
    return false;
  }

  // ===== 1. HIDE SHORTS =====
  function hideShorts() {
    if (isChannelPage()) return; // Allow shorts on channel pages
    
    var style = document.getElementById('yt-hide-shorts');
    if (!style) {
      style = document.createElement('style');
      style.id = 'yt-hide-shorts';
      document.head.appendChild(style);
    }
    
    style.textContent = \`
      /* Hide shorts tab - desktop */
      ytd-guide-entry-renderer:has(a[href="/shorts"]),
      ytd-mini-guide-entry-renderer:has(a[href="/shorts"]),
      a[href="/shorts"],
      a[title*="Shorts" i],
      tp-yt-paper-item:has(a[href="/shorts"]),
      
      /* Hide ONLY shorts tab in mobile pivot bar - NOT all tabs */
      ytm-pivot-bar-item-renderer:has(.pivot-shorts),
      ytm-pivot-bar-item-renderer .pivot-shorts,
      
      /* Hide shorts shelves */
      ytd-rich-shelf-renderer[is-shorts],
      ytd-reel-shelf-renderer,
      ytd-rich-section-renderer:has([is-shorts]),
      [is-shorts],
      grid-shelf-view-model,
      
      /* Hide shorts in search - big-shorts-singleton */
      .big-shorts-singleton,
      ytd-reel-item-renderer,
      ytd-video-renderer:has(a[href*="/shorts/"]),
      ytd-grid-video-renderer:has(a[href*="/shorts/"]),
      ytm-reel-shelf-renderer,
      ytm-shorts-lockup-view-model,
      
      /* Chips */
      yt-chip-cloud-chip-renderer:has([href*="shorts"])
      {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
      }
    \`;
    
    // Also remove from DOM
    try {
      // Remove shorts elements
      document.querySelectorAll('[is-shorts], ytd-reel-shelf-renderer, ytd-reel-item-renderer, grid-shelf-view-model, .big-shorts-singleton').forEach(function(el) {
        el.remove();
      });
      
      // Remove ONLY the shorts tab from mobile pivot bar (not all tabs)
      document.querySelectorAll('ytm-pivot-bar-item-renderer').forEach(function(el) {
        var hasShorts = el.querySelector('.pivot-shorts') || el.innerHTML.includes('pivot-shorts');
        if (hasShorts) {
          el.remove();
        }
      });
      
      // Remove videos that link to shorts
      document.querySelectorAll('a[href*="/shorts/"]').forEach(function(el) {
        if (!isChannelPage()) {
          var parent = el.closest('ytd-video-renderer, ytd-grid-video-renderer');
          if (parent) parent.remove();
        }
      });
    } catch(e) {}
    
    console.log('[YT Filter] Shorts hidden');
  }

  // ===== 2. HIDE SUGGESTED VIDEOS =====
  function hideSuggestions() {
    if (!isVideoPage()) return;
    
    var style = document.getElementById('yt-hide-suggestions');
    if (!style) {
      style = document.createElement('style');
      style.id = 'yt-hide-suggestions';
      document.head.appendChild(style);
    }
    
    style.textContent = \`
      /* Hide suggestions - secondary sidebar */
      #secondary,
      #secondary-inner,
      ytd-watch-next-secondary-results-renderer,
      #related,
      ytd-compact-video-renderer,
      ytd-item-section-renderer[section-identifier="related-items"],
      [section-identifier="related-items"],
      
      /* Hide end screen */
      .ytp-endscreen-content,
      .ytp-ce-element,
      
      /* Mobile suggestions */
      ytm-watch-next-secondary-results-renderer,
      ytm-item-section-renderer:has(ytm-compact-video-renderer)
      {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
      
      /* Expand video */
      ytd-watch-flexy #primary {
        max-width: 100% !important;
      }
      
      /* Keep comments visible */
      #comments,
      ytd-comments,
      ytd-comment-thread-renderer,
      ytd-comment-renderer
      {
        display: block !important;
        visibility: visible !important;
      }
    \`;
    
    // Remove from DOM
    try {
      // Remove secondary sidebar
      var secondary = document.getElementById('secondary');
      if (secondary) {
        secondary.remove();
      }
      
      // Remove related items section
      document.querySelectorAll('[section-identifier="related-items"], ytd-item-section-renderer[section-identifier="related-items"]').forEach(function(el) {
        el.remove();
      });
      
      // Remove all compact video renderers (suggested videos)
      document.querySelectorAll('ytd-compact-video-renderer, ytm-compact-video-renderer').forEach(function(el) {
        el.remove();
      });
    } catch(e) {}
    
    console.log('[YT Filter] Suggestions hidden');
  }

  // ===== 3. RESTRICTED MODE =====
  function handleRestrictedMode() {
    var currentPref = getCookie('PREF') || '';
    var onVideoPage = isVideoPage();
    var alwaysRestricted = ${alwaysRestricted}; // Config option

    console.log('[YT Filter] Checking PREF cookie');
    console.log('[YT Filter] Current PREF:', currentPref);
    console.log('[YT Filter] On video page:', onVideoPage);
    console.log('[YT Filter] Always restricted:', alwaysRestricted);

    // If alwaysRestricted=true, always use restricted mode
    // If alwaysRestricted=false, only use restricted mode on non-video pages (allows comments)
    var shouldHaveRestricted = alwaysRestricted ? true : !onVideoPage;
    var changed = false;

    if (shouldHaveRestricted && !currentPref.includes('f2=8000000')) {
      console.log('[YT Filter] MISSING f2=8000000 on non-video page - adding');
      var newPref = currentPref ? currentPref + '&f2=8000000' : 'f2=8000000';
      setCookie('PREF', newPref);
      changed = true;
    } else if (!shouldHaveRestricted && currentPref.includes('f2=8000000')) {
      console.log('[YT Filter] HAS f2=8000000 on video page - removing');
      var newPref = currentPref.replace('&f2=8000000', '').replace('f2=8000000&', '').replace('f2=8000000', '');
      setCookie('PREF', newPref);
      changed = true;
    } else {
      console.log('[YT Filter] PREF cookie is already correct');
    }

    // Reload if we changed the cookie
    if (changed) {
      console.log('[YT Filter] Cookie changed - requesting stop->reload (no timers)');

      // Stop the current load ASAP so the next reload is clean/deterministic
      try { window.stop(); } catch(e) {}

      // Ask React Native to perform an ordered stopLoading -> reload.
      // Do NOT use setTimeout here; window.stop() can break timers unpredictably.
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ytStopThenReload',
            reason: 'pref_cookie_changed',
            url: window.location.href
          }));
          return;
        }
      } catch(e) {}

      // Absolute fallback if RN bridge isn't available
      try { window.location.replace(window.location.href); } catch(e2) {}
    }
  }


  // ===== INITIALIZATION =====
  function runAll() {
    // Block shorts page immediately
    if (blockShortsPage()) return;

    // Check and fix restricted mode (will reload if needed)
    handleRestrictedMode();

    // Run UI filters immediately
    hideShorts();
    hideSuggestions();
  }

  // Run immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAll);
  } else {
    runAll();
  }

  // Run on YouTube SPA navigation
  window.addEventListener('yt-navigate-start', function() {
    // Clear the tracking when navigation starts so the check runs on the new page
    console.log('[YT Filter] Navigation started - clearing tracking');
    window.sessionStorage.removeItem('yt_last_handled_url');
    window.sessionStorage.removeItem('yt_last_handled_pref');
  });
  
  window.addEventListener('yt-navigate-finish', function() {
    console.log('[YT Filter] Navigation detected');
    setTimeout(runAll, 100);
  });

  // Run periodically for dynamic content (only UI)
  setInterval(function() {
    hideShorts();
    hideSuggestions();
  }, 2000);

  console.log('[YT Filter] Script loaded');
})();
true;
`;
}

// For backward compatibility, export a default version
export const YOUTUBE_CONTENT_FILTER_JS = getYouTubeContentFilterScript(false);

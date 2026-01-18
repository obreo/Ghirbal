import { isGoogleImagesBlockingEnabled } from './app-config';

// Check if URL is a Google authentication/OAuth URL
export function isGoogleAuthUrl(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();
    const search = urlObj.search.toLowerCase();

    // Auth-related subdomains - these should ALWAYS be allowed (wildcard match)
    const authSubdomains = [
      'accounts.google',
      'myaccount.google',
      'oauth2.googleapis',
      'securetoken.googleapis',
      'identitytoolkit.googleapis',
      'gsi.gstatic',
      'iframerpc.gstatic',
      'content.googleapis',
      'sts.googleapis',
      'accounts.youtube'
    ];
    if (authSubdomains.some(sub => hostname.includes(sub))) {
      return true;
    }

    // Auth-related path patterns (wildcard-like matching)
    // Any path containing these keywords indicates auth flow
    const authPathKeywords = [
      '/signin',
      '/oauth',
      '/auth',
      '/login',
      '/accounts',
      '/gsi',
      '/ServiceLogin',
      '/CheckCookie',
      '/AccountChooser',
      '/AddSession',
      '/Logout',
      '/challenge',
      '/speedbump',
      '/accountlookup',
      '/interstitial',
      '/embedded',
      '/authorization'
    ];
    if (authPathKeywords.some(keyword => path.includes(keyword))) {
      return true;
    }

    // OAuth query parameters (any of these indicate OAuth flow)
    const oauthParams = [
      'response_type=',
      'client_id=',
      'redirect_uri=',
      'state=',
      'scope=',
      'continue=',
      'authuser=',
      'oauth=',
      'token=',
      'access_token=',
      'code=',
      'grant_type=',
      'refresh_token='
    ];
    if (oauthParams.some(param => search.includes(param))) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Check if URL is Google (search domain, not services or auth)
export function isGoogleSearchDomain(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, '');

    // Always allow Google authentication URLs
    if (isGoogleAuthUrl(url)) {
      return false;
    }

    // Only block main Google search domain to only allow safesearchengine.com
    if (domain === 'google.com' || domain.match(/^google\.[a-z]{2,3}(\.[a-z]{2})?$/)) {
      // Allow Google services
      const allowedPrefixes = ['maps.', 'drive.', 'docs.', 'sheets.', 'slides.',
        'calendar.', 'mail.', 'meet.', 'translate.', 'play.',
        'accounts.', 'myaccount.', 'support.', 'cloud.',
        'apis.', 'fonts.', 'firebase.', 'storage.'];
      if (allowedPrefixes.some(p => hostname.startsWith(p))) {
        return false;
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Check if URL is the Google homepage (root or webhp)
export function isGoogleHomePage(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const path = urlObj.pathname.toLowerCase();

    // Homepage is root '/' or '/webhp'
    // Also check for empty path if it's just the domain
    return path === '/' || path === '/webhp';
  } catch {
    return false;
  }
}

// ====================================================================
//  Check if URL is a blocked Google section (videos, shorts, images)
// ====================================================================
export function isBlockedGoogleSection(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');

    // ALWAYS allow Auth URLs to bypass section blocking
    if (isGoogleAuthUrl(url)) {
      return false;
    }

    if (!domain.includes('google.')) {
      return false;
    }

    const path = urlObj.pathname.toLowerCase();
    const searchParams = urlObj.searchParams;
    const fullUrl = url.toLowerCase();

    // Block Google Images - check all possible indicators
    // Configurable via App Config
    if (isGoogleImagesBlockingEnabled()) {
      if (path.includes('/imghp') || path.includes('/images') ||
        searchParams.get('tbm') === 'isch' ||
        searchParams.get('udm') === '2' ||
        fullUrl.includes('tbm=isch') || fullUrl.includes('udm=2')) {
        return true;
      }
    }

    // Block Google Videos - ALWAYS BLOCKED (Hidden via UI, blocked via Navigation)
    if (path.includes('/videohp') || path.includes('/videos') ||
      searchParams.get('tbm') === 'vid' ||
      searchParams.get('udm') === '7' ||
      fullUrl.includes('tbm=vid') || fullUrl.includes('udm=7')) {
      return true;
    }

    // Block Google Shorts - ALWAYS BLOCKED
    if (path.includes('/shorts') ||
      searchParams.get('udm') === '39' ||
      fullUrl.includes('tbm=shs') || fullUrl.includes('udm=39')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Generate CSS/JS to hide blocked Google sections
export function getGoogleUiCleanupScript(): string {
  const blockImages = isGoogleImagesBlockingEnabled();

  return `
    (function() {
      // Create style element
      var style = document.createElement('style');
      style.id = 'google-ui-cleanup';
      style.textContent = \`
        /* Hide Videos Tab & Links */
        a[href*="tbm=vid"],
        a[href*="/videohp"],
        a[href*="udm=7"],
        div[role="navigation"] a:contains("Videos"),
        g-menu-item a[href*="tbm=vid"],
        g-menu-item a[href*="udm=7"],
        
        /* Hide Shorts */
        a[href*="/shorts"],
        a[href*="udm=39"],
        g-section-with-header[data-title*="Shorts"],
        
        /* Hide "Videos" filter chip */
        .hdtb-mitem a[href*="tbm=vid"],
        .hdtb-mitem a[href*="udm=7"] {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          cursor: default !important;
        }

        ${blockImages ? `
        /* Hide Images Tab & Links (Conditional) */
        a[href*="tbm=isch"],
        a[href*="/imghp"],
        a[href*="udm=2"],
        div[role="navigation"] a:contains("Images"),
        g-menu-item a[href*="tbm=isch"],
        g-menu-item a[href*="udm=2"],
        .hdtb-mitem a[href*="tbm=isch"],
        .hdtb-mitem a[href*="udm=2"] {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          cursor: default !important;
        }
        ` : ''}
      \`;
      
      if (document.head) {
        document.head.appendChild(style);
      } else {
        document.documentElement.appendChild(style);
      }
    })();
  `;
}

// ====================================================================
// =============== SAFESEARCH ENFORCEMENT =============================
// ====================================================================
// Enforce Google SafeSearch by adding safe=active parameter
export function enforceGoogleSafeSearch(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();

    // Skip SafeSearch enforcement for Auth URLs
    if (isGoogleAuthUrl(url)) {
      return url;
    }

    if (domain.includes("google.")) {
      urlObj.searchParams.set("safe", "active");
      return urlObj.toString();
    }
    return url;
  } catch {
    return url;
  }
}

// JS to suppress Google search results when SafeSearch is locked
export const GOOGLE_SAFESEARCH_SUPPRESSION_JS = `
(function() {
  var lastQuery = '';
  var isRestricted = false;

  function getQuery() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('q') || '';
    } catch(e) {
      return '';
    }
  }

  function checkSafeSearchLocked() {
    // Check if SAFESEARCH_LOCKED notice exists
    var lockedElement = document.querySelector('[data-notice="SAFESEARCH_LOCKED"]');
    return !!lockedElement;
  }

  function suppressResults() {
    if (isRestricted) return; // Already suppressed
    isRestricted = true;
    console.log('[Google SafeSearch] Suppressing results due to SAFESEARCH_LOCKED');

    // Create or update suppression style
    var style = document.getElementById('safesearch-suppression-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'safesearch-suppression-style';
      document.head.appendChild(style);
    }
    
    style.textContent = \`
      /* Hide all search results */
      #search, #rso, .g, .hlcw0c, .MjjYud, .v7W49e,
      [data-hveid], [data-ved],
      .commercial-unit-desktop-top, .commercial-unit-desktop-rhs,
      .ads-ad, .pla-unit, .cu-container,
      /* Hide featured snippets and knowledge panels */
      .kp-wholepage, .knowledge-panel, .liYKde, .kCrYT,
      .xpdopen, .ifM9O, .c2xzTb,
      /* Hide image packs and video carousels */
      .islrc, .ivg-i, .F0uyec, .RzdJxc,
      [data-lpage], .HD8Pae, .X7NTVe,
      /* Hide People Also Ask */
      .related-question-pair, .wQiwMc,
      /* Hide local results */
      .VkpGBb, .cXedhc,
      /* Hide shopping results */
      .sh-sr__shop-result-group, .commercial-unit-desktop-top,
      /* Hide news results */
      .JJZKK, .ftSUBd,
      /* Hide "More results" and pagination */
      #botstuff, .AaVjTc, #pnnext, #pnprev {
        display: none !important;
        visibility: hidden !important;
      }

      /* Hide Images and Videos tab links */
      a[href*="tbm=isch"], a[href*="tbm=vid"],
      a[href*="udm=2"], a[href*="/search?.*tbm=isch"],
      div[data-hveid] a[href*="images"], 
      div[data-hveid] a[href*="videos"] {
        display: none !important;
        pointer-events: none !important;
      }

      /* Hide image thumbnails and video previews */
      img[data-src*="encrypted"], img[src*="encrypted"],
      .rg_i, .ivg-i, .mNsIhb,
      video, .video-player, .FFFPOX {
        display: none !important;
      }
    \`;

    // Remove specific elements from DOM
    var selectorsToRemove = [
      '#search', '#rso', '.g', '.MjjYud',
      '.kp-wholepage', '.knowledge-panel',
      '.islrc', '.ivg-i', '.HD8Pae',
      '.related-question-pair',
      'a[href*="tbm=isch"]', 'a[href*="tbm=vid"]'
    ];

    selectorsToRemove.forEach(function(selector) {
      try {
        document.querySelectorAll(selector).forEach(function(el) {
          el.remove();
        });
      } catch(e) {}
    });

    // Display controlled message
    showRestrictedMessage();
  }

  function showRestrictedMessage() {
    var existingMessage = document.getElementById('safesearch-restricted-message');
    if (existingMessage) return;

    var container = document.querySelector('#center_col') || document.querySelector('#main') || document.body;
    
    var messageDiv = document.createElement('div');
    messageDiv.id = 'safesearch-restricted-message';
    messageDiv.style.cssText = \`
      padding: 40px 20px;
      text-align: center;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      margin: 20px auto;
      max-width: 600px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    \`;
    
    messageDiv.innerHTML = \`
      <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
      <h2 style="color: #856404; margin: 0 0 12px 0; font-size: 20px;">This search is restricted</h2>
      <p style="color: #856404; margin: 0 0 20px 0; font-size: 14px;">
        This search has been blocked due to SafeSearch policy.<br>
        Please try a different search term.
      </p>
      <button id="safesearch-new-search-btn" style="
        background: #007bff;
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
      ">New Search</button>
    \`;

    if (container.firstChild) {
      container.insertBefore(messageDiv, container.firstChild);
    } else {
      container.appendChild(messageDiv);
    }

    // Add click handler for new search button
    var newSearchBtn = document.getElementById('safesearch-new-search-btn');
    if (newSearchBtn) {
      newSearchBtn.addEventListener('click', function() {
        // Focus the search input
        var searchInput = document.querySelector('input[name="q"], textarea[name="q"]');
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        } else {
          // Navigate to Google homepage
          window.location.href = 'https://www.google.com';
        }
      });
    }
  }

  function resetSuppression() {
    if (!isRestricted) return;
    isRestricted = false;
    console.log('[Google SafeSearch] Resetting suppression');

    // Remove suppression style
    var style = document.getElementById('safesearch-suppression-style');
    if (style) style.remove();

    // Remove message
    var message = document.getElementById('safesearch-restricted-message');
    if (message) message.remove();
  }

  function blockImagesVideosNavigation() {
    // Intercept clicks on Images and Videos tabs
    document.addEventListener('click', function(e) {
      if (!isRestricted) return;
      
      var link = e.target.closest('a');
      if (!link) return;

      var href = link.href || '';
      if (href.includes('tbm=isch') || href.includes('tbm=vid') || 
          href.includes('udm=2') || href.includes('/images?') || href.includes('/videos?')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Google SafeSearch] Blocked navigation to images/videos');
        return false;
      }
    }, true);
  }

  function checkAndUpdate() {
    var currentQuery = getQuery();
    var locked = checkSafeSearchLocked();

    // Check if query changed
    if (currentQuery !== lastQuery) {
      lastQuery = currentQuery;
      // Reset and re-check when query changes
      if (!locked) {
        resetSuppression();
      }
    }

    // Apply or reset suppression based on locked state
    if (locked) {
      suppressResults();
    } else if (isRestricted && !locked) {
      resetSuppression();
    }
  }

  // Initial check
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      checkAndUpdate();
      blockImagesVideosNavigation();
    });
  } else {
    checkAndUpdate();
    blockImagesVideosNavigation();
  }

  // Monitor DOM changes
  var observer = new MutationObserver(function(mutations) {
    checkAndUpdate();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-notice']
  });

  // Also check periodically for SPA navigation
  setInterval(checkAndUpdate, 1000);

  // Monitor URL changes for SPA navigation
  var lastUrl = window.location.href;
  setInterval(function() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[Google SafeSearch] URL changed, re-checking');
      // Small delay to let DOM update
      setTimeout(checkAndUpdate, 100);
    }
  }, 500);

  console.log('[Google SafeSearch] Suppression script loaded');
})();
true;
`;

// ===== GOOGLE SECTIONS BLOCKING (Images, Videos, Shorts) - SIMPLE CSS ONLY =====
export const GOOGLE_SECTIONS_BLOCK_JS = `
(function() {
  function applyBlocking() {
    var style = document.getElementById('google-sections-block-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'google-sections-block-style';
      // Use pointer-events: none to make unclickable, opacity to hide
      style.textContent = 
        'a[href*="tbm=isch"],a[href*="udm=2"],a[href*="/imghp"],a[href*="/images"],' +
        'a[href*="tbm=vid"],a[href*="/videohp"],a[href*="/videos"],a[href*="/shorts"],' +
        'div[data-lpage],.islrc,.ivg-i,.rg_i,.HD8Pae,.X7NTVe,.JJZKK,' +
        '.F0uyec,.RzdJxc,g-scrolling-carousel {' +
          'display: none !important;' +
          'pointer-events: none !important;' +
          'cursor: default !important;' +
        '}';
      (document.head||document.documentElement).appendChild(style);
    }
  }
  
  // Apply immediately
  applyBlocking();
  
  // Re-apply on changes
  var observer = new MutationObserver(function() {
    applyBlocking();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();true;
`;

/**
 * Check if URL is a Google search page
 */
export function isGoogleSearchUrl(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    const domain = urlObj.hostname.toLowerCase();
    // Check if it's a Google search page (not other Google services like YouTube, Maps, etc.)
    return (domain.includes("google.") || domain === "google.com") &&
      (urlObj.pathname.includes("/search") || urlObj.pathname === "/" || urlObj.pathname === "");
  } catch {
    return false;
  }
}

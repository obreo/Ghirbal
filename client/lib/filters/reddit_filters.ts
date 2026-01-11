// ====================================================================
// =============== REDDIT FILTERS AND CONSTANTS =======================
// ====================================================================

// Specific Reddit paths to block
export const BLOCKED_REDDIT_PATHS = [
  "/settings",
  "/search",
];

// Helper for safe JSON parsing
function safeParseArray(jsonString: string | undefined): string[] {
  if (!jsonString) return [];
  try {
    return JSON.parse(jsonString) as string[];
  } catch {
    return [];
  }
}

// Subreddit keywords for wildcard matching
export const WILDCARD_REDDIT_KEYWORDS = safeParseArray(process.env.WILDCARD_REDDIT_BLOCKED_LIST);

// Subreddit patterns for exact matching
export const NSFW_REDDIT_PATTERNS = safeParseArray(process.env.SUBREDDIT_PATTERNS_BLOCKED_LIST);

/**
 * Check if Reddit URL is NSFW based on patterns and keywords
 */
export function isNsfwRedditUrl(url: string): boolean {
  const lowercaseUrl = url.toLowerCase();
  if (!lowercaseUrl.includes("reddit.com")) {
    return false;
  }

  if (NSFW_REDDIT_PATTERNS.some((pattern) =>
    lowercaseUrl.includes(pattern.toLowerCase()),
  )) {
    return true;
  }

  const subredditMatch = lowercaseUrl.match(/\/r\/([a-z0-9_]+)/i);
  if (subredditMatch) {
    const subredditName = subredditMatch[1].toLowerCase();
    if (WILDCARD_REDDIT_KEYWORDS.some((keyword) =>
      subredditName.includes(keyword),
    )) {
      return true;
    }
  }

  return false;
}

/**
 * Check if Reddit URL matches blocked paths
 */
export function isBlockedRedditPath(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    const domain = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();

    if (!domain.includes("reddit.com")) {
      return false;
    }

    return BLOCKED_REDDIT_PATHS.some((blockedPath) =>
      path === blockedPath || path.startsWith(blockedPath + "/"),
    );
  } catch {
    return false;
  }
}

/**
 * Check if URL is a subreddit page
 */
export function isSubredditPage(url: string): boolean {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.toLowerCase().includes("reddit.com")) {
      return false;
    }
    // Check if path matches /r/subreddit-name
    // But it could also be /r/subreddit-name/comments/...
    return /^\/r\/[a-z0-9_]+/i.test(urlObj.pathname);
  } catch {
    return false;
  }
}

/**
 * Extract subreddit name from URL
 */
export function getSubredditName(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/^\/r\/([a-z0-9_]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}


/**
 * Enforce Reddit Safe Browsing by adding over18=0 parameter
 */
export function enforceRedditSafe(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();

    if (domain.includes("reddit.com")) {
      // Don't modify search URLs as over18=0 can interfere with search results
      if (urlObj.pathname.includes("/search")) {
        return url;
      }
      urlObj.searchParams.set("over18", "0");
      return urlObj.toString();
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Check if URL is a Reddit URL
 */
export function isRedditUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase().includes("reddit.com");
  } catch {
    return false;
  }
}

/**
 * Lightweight early CSS injection for Reddit - runs before content loads
 */
export const REDDIT_EARLY_CSS_JS = `
(function() {
  // Inject CSS immediately to hide NSFW content before it renders
  var style = document.createElement('style');
  style.id = 'reddit-early-filter';
  style.textContent = \`
    /* Hide NSFW posts immediately via CSS */
    shreddit-post[nsfw],
    shreddit-post[over-18],
    [data-over18="true"] {
      display: none !important;
    }
    
    /* Hide search bar elements (will be shown on search pages by JS) */
    reddit-search-large,
    faceplate-search-input,
    shreddit-search-large,
    #expand-search-button,
    #header-search-bar {
      display: none !important;
    }
  \`;
  
  // Inject as early as possible
  if (document.head) {
    document.head.appendChild(style);
  } else if (document.documentElement) {
    document.documentElement.appendChild(style);
  }
  
  // Show search bar on search pages
  if (window.location.pathname.includes('/search')) {
    style.textContent = style.textContent.replace(
      /reddit-search-large[\\s\\S]*?#header-search-bar \\{[^}]+\\}/,
      ''
    );
  }

  // Aggressive Shadow DOM piercing via polling
  // This is necessary because MutationObserver misses some deep/late shadow roots
  // especially in overlays (shreddit-overlay-display)
  function injectShadowStyle(root) {
    if (!root || root.hasAttribute('data-safebrowse-styled')) return;
    try {
      const style = document.createElement('style');
      style.textContent = 'img, video, shreddit-player, faceplate-img, .media-element, shreddit-aspect-ratio, shreddit-media-lightbox { display: none !important; opacity: 0 !important; width: 0 !important; height: 0 !important; pointer-events: none !important; }';
      root.appendChild(style);
      root.setAttribute('data-safebrowse-styled', 'true');
      console.log('[SafeBrowse] Injected style into shadow root');
    } catch(e) {}
  }

  // 1. Check all elements in the document
  function scanForShadowRoots() {
    // efficient selector for elements likely to have shadow roots
    // IMPORTANT: Exclude iframes to avoid interfering with Google Sign-In and OAuth flows
    const candidates = document.querySelectorAll('shreddit-post, shreddit-comment, shreddit-overlay-display, shreddit-gallery-carousel, shreddit-aspect-ratio, shreddit-media-lightbox, [shadow-root]');
    candidates.forEach(el => {
      // Skip iframes and Google-related elements to avoid OAuth issues
      if (el.tagName === 'IFRAME') return;
      if (el.id && (el.id.includes('google') || el.id.includes('gsi'))) return;
      if (el.className && typeof el.className === 'string' && (el.className.includes('google') || el.className.includes('gsi'))) return;
      if (el.shadowRoot) {
        injectShadowStyle(el.shadowRoot);
      }
    });
    
    // NEW: Global fallback for overlay content that might bypass Shadow DOM logic or be slotted
    const overlayMedia = document.querySelectorAll('shreddit-overlay-display img, shreddit-overlay-display video, shreddit-media-lightbox img, shreddit-media-lightbox video');
    overlayMedia.forEach(el => {
       // Force hide manually
       if (el.style.display !== 'none') {
         el.style.display = 'none';
         el.style.opacity = '0';
         el.style.width = '0';
         el.style.height = '0';
         console.log('[SafeBrowse] Hidden overlay media element:', el);
       }
    });
  }

  // Run frequently to catch new content (overlays, popups)
  setInterval(scanForShadowRoots, 500);
  
  // Also run immediately
  scanForShadowRoots();
})();
true;
`;

/**
 * NSFW filter JavaScript for Reddit
 */
export const REDDIT_NSFW_FILTER_JS = `
(function() {
  // Check if we're on a search results page - recompute on each check
  function checkIsSearchPage() {
    return window.location.pathname.includes('/search');
  }
  
  function hideSearchBar() {
    var isSearchPage = checkIsSearchPage();
    var style = document.getElementById('safebrowse-hide-search');
    
    // On search pages, REMOVE the hiding CSS and don't hide anything
    if (isSearchPage) {
      if (style) {
        style.remove();
      }
      return;
    }
    
    // Not on search page - hide search bars
    if (!style) {
      style = document.createElement('style');
      style.id = 'safebrowse-hide-search';
      style.textContent = \`
        /* Only hide the search INPUT elements, not results containers */
        #expand-search-button,
        reddit-search-large,
        faceplate-search-input,
        shreddit-search-large,
        #header-search-bar,
        /* Be specific - only input elements with search placeholder */
        input[placeholder*="Search Reddit"],
        input[placeholder="Search"] {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
        }
      \`;
      document.head.appendChild(style);
    }
    
    var searchSelectors = [
      '#expand-search-button',
      'reddit-search-large',
      'faceplate-search-input',
      'shreddit-search-large',
      '#header-search-bar',
    ];
    
    searchSelectors.forEach(function(selector) {
      try {
        document.querySelectorAll(selector).forEach(function(el) {
          el.style.cssText = 'display:none!important;visibility:hidden!important;';
        });
      } catch(e) {}
    });
    
    // Hide expand search button and search icon buttons, but NOT result links
    document.querySelectorAll('button').forEach(function(el) {
      var id = (el.id || '').toLowerCase();
      var ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      var text = (el.textContent || '').toLowerCase().trim();
      var shouldHide = false;
      
      // Only hide if it's clearly a search trigger button (not navigation/result elements)
      if (id === 'expand-search-button' || 
          ariaLabel === 'search' || 
          (text === 'search' && el.closest('header, nav'))) {
        shouldHide = true;
      }
      
      if (shouldHide) {
        el.style.cssText = 'display:none!important;visibility:hidden!important;';
      }
    });
    
    // Hide search icon in header only
    document.querySelectorAll('header svg, nav svg').forEach(function(svg) {
      var iconName = svg.getAttribute('icon-name');
      if (iconName === 'search') {
        var parent = svg.closest('button, a');
        if (parent) {
          parent.style.cssText = 'display:none!important;visibility:hidden!important;';
        }
      }
    });
  }
  
  function hideNsfwContent() {
    // Hide posts with NSFW markers
    var nsfwSelectors = [
      'shreddit-post[nsfw]',
      'shreddit-post[over-18]',
      '[data-over18="true"]',
    ];
    
    nsfwSelectors.forEach(function(selector) {
      try {
        document.querySelectorAll(selector).forEach(function(el) {
          el.style.display = 'none';
        });
      } catch(e) {}
    });
    
    // Check posts/articles for NSFW content
    document.querySelectorAll('shreddit-post, article, [data-testid="post-container"]').forEach(function(post) {
      var text = (post.textContent || '').toLowerCase();
      var ariaLabel = (post.getAttribute('aria-label') || '').toLowerCase();
      
      if (/\\bnsfw\\b|\\bover.?18\\b|\\b18\\+|\\[nsfw\\]|\\(nsfw\\)/i.test(text + ' ' + ariaLabel)) {
        post.style.display = 'none';
      }
    });
    
    // Hide NSFW/explicit user badges and profiles
    document.querySelectorAll('[data-testid*="user"], a[href*="/user/"]').forEach(function(userEl) {
      var userText = (userEl.textContent || '').toLowerCase();
      var userAriaLabel = (userEl.getAttribute('aria-label') || '').toLowerCase();
      
      if (/\\bnsfw\\b|\\bexplicit\\b|\\bover.?18\\b|\\badult\\b|\\b18\\+/i.test(userText + ' ' + userAriaLabel)) {
        userEl.style.display = 'none';
        var userContainer = userEl.closest('[data-testid*="thing"], article, div[role="article"]');
        if (userContainer) userContainer.style.display = 'none';
      }
    });
    
    // Hide NSFW/explicit subreddits and communities
    document.querySelectorAll('a[href*="/r/"], [data-testid*="subreddit"]').forEach(function(communityEl) {
      var communityText = (communityEl.textContent || '').toLowerCase();
      var communityAriaLabel = (communityEl.getAttribute('aria-label') || '').toLowerCase();
      
      if (/\\bnsfw\\b|\\bexplicit\\b|\\bover.?18\\b|\\badult\\b|\\b18\\+/i.test(communityText + ' ' + communityAriaLabel)) {
        communityEl.style.display = 'none';
        var communityContainer = communityEl.closest('[data-testid*="thing"], article, [role="article"], li');
        if (communityContainer) communityContainer.style.display = 'none';
      }
    });
    
    // Hide posts that link to or mention NSFW subreddits
    document.querySelectorAll('shreddit-post, article, [data-testid*="thing"]').forEach(function(post) {
      var postHTML = post.innerHTML || '';
      var postText = (post.textContent || '').toLowerCase();
      
      // Check for common NSFW subreddit names in post content
      var nsfwSubreddits = ['gonewild', 'nsfw', 'porn', 'xxx', 'adult', 'sex', 'nude', 'explicit'];
      var containsNsfwLink = nsfwSubreddits.some(function(sub) {
        return /\/r\//i.test(postHTML) && postHTML.toLowerCase().includes('/' + sub);
      });
      
      if (containsNsfwLink || /\\[nsfw\\]|\\(nsfw\\)|explicit|over.?18|\\b18\\+/i.test(postText)) {
        post.style.display = 'none';
      }
    });
  }
  
  function forceMatureContentOff() {
    // Hide mature content toggles in settings
    document.querySelectorAll('faceplate-switch-input').forEach(function(toggle) {
      var ariaLabel = (toggle.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes('mature') || ariaLabel.includes('nsfw') || ariaLabel.includes('18')) {
        toggle.setAttribute('aria-checked', 'false');
        toggle.style.display = 'none';
        var row = toggle.closest('li, div[role="option"], section, shreddit-experience-tree');
        if (row) row.style.display = 'none';
      }
    });
  }
  
  function filterNsfwByDataAttributes() {
    var isOnSearchPage = checkIsSearchPage();
    
    // Helper function to recursively check for nsfw:true in objects
    function checkNsfw(obj) {
      if (typeof obj !== 'object' || obj === null) return false;
      if (obj.nsfw === true) return true;
      for (var key in obj) {
        if (checkNsfw(obj[key])) return true;
      }
      return false;
    }
    
    // First, remove all shreddit-post elements with nsfw attribute (most common case)
    try {
      document.querySelectorAll('shreddit-post[nsfw]').forEach(function(el) {
        el.remove();
      });
    } catch(e) {
      console.log('[Reddit Filter] Error removing shreddit-post[nsfw]:', e);
    }
    
    // Find all elements with data attributes that might contain NSFW info
    // NOTE: search-telemetry-tracker is EXCLUDED because it wraps ALL search results
    // and removing it would remove the entire search results container
    var selectors = [
      '[data-testid="post-container"]',
      'shreddit-post',
      'article',
      '[data-testid*="post"]'
    ];
    
    // On non-search pages, we can target more elements
    if (!isOnSearchPage) {
      selectors.push('[data-faceplate-tracking-context]');
      selectors.push('a[href*="/r/"]');
      selectors.push('a[href*="/user/"]');
      selectors.push('[data-testid*="subreddit"]');
    }
    
    selectors.forEach(function(selector) {
      try {
        document.querySelectorAll(selector).forEach(function(el) {
          // Check if element has nsfw="" attribute (even if empty)
          if (el.hasAttribute('nsfw')) {
            el.remove();
            return;
          }
          
          // Check data-faceplate-tracking-context attribute
          var trackingContext = el.getAttribute('data-faceplate-tracking-context');
          if (trackingContext) {
            try {
              // Decode HTML entities and parse JSON
              var decoded = trackingContext.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
              var data = JSON.parse(decoded);
              
              // Check if post has nsfw:true
              if (data.post && data.post.nsfw === true) {
                el.remove();
                return;
              }
              
              // Check if subreddit has nsfw:true
              if (data.subreddit && data.subreddit.nsfw === true) {
                el.remove();
                return;
              }
              
              // Check nested objects for nsfw:true
              if (checkNsfw(data)) {
                el.remove();
                return;
              }
            } catch(e) {
              // If JSON parsing fails, try simple string check
              if (trackingContext.includes('"nsfw":true') || trackingContext.includes('&quot;nsfw&quot;:true')) {
                el.remove();
                return;
              }
            }
          }
          
          // Check all data attributes for nsfw:true
          Array.from(el.attributes).forEach(function(attr) {
            if (attr.name.startsWith('data-') && attr.value) {
              var value = attr.value;
              // Check for nsfw:true in JSON strings
              if (value.includes('"nsfw":true') || value.includes('&quot;nsfw&quot;:true')) {
                try {
                  var decoded = value.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                  var data = JSON.parse(decoded);
                  if (checkNsfw(data)) {
                    el.remove();
                    return;
                  }
                } catch(e) {
                  // Simple string match - if it contains nsfw:true, remove it
                  if (value.includes('"nsfw":true') || value.includes('&quot;nsfw&quot;:true')) {
                    el.remove();
                    return;
                  }
                }
              }
            }
          });
        });
      } catch(e) {
        console.log('[Reddit Filter] Error filtering NSFW:', e);
      }
    });
  }
  
  // Track last URL to detect navigation
  var lastUrl = window.location.href;
  
  hideSearchBar();
  hideNsfwContent();
  forceMatureContentOff();
  filterNsfwByDataAttributes();
  
  // Use a less aggressive observer - only re-run specific functions
  var lastCheck = 0;
  var observer = new MutationObserver(function() {
    var now = Date.now();
    // Re-check URL to detect navigation (including search)
    var currentUrl = window.location.href;
    var urlChanged = currentUrl !== lastUrl;
    if (urlChanged) {
      lastUrl = currentUrl;
      // URL changed - immediately re-run hideSearchBar to update CSS
      hideSearchBar();
    }
    
    // Throttle to once per 2 seconds to avoid excessive re-filtering
    if (now - lastCheck > 2000) {
      lastCheck = now;
      hideSearchBar();
      hideNsfwContent();
      forceMatureContentOff();
      filterNsfwByDataAttributes();
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  setInterval(function() {
    // Check for URL changes (Reddit uses SPA navigation)
    var currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
    }
    hideSearchBar();
    forceMatureContentOff();
    filterNsfwByDataAttributes();
  }, 500);
})();
true;
`;

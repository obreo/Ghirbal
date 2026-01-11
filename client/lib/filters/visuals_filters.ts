import { isMediaBlockingEnabled } from '../app-config';

// ====================================================================
// ==== AGGRESSIVE MEDIA BLOCKING for IMAGES/VIDEOS in all pages ======
// ====================================================================

// Prevents images and videos from loading entirely (not just hiding)
// This script intercepts at the prototype level BEFORE content loads

export const MEDIA_BLOCK_PRELOAD_JS = `
(function() {
  'use strict';
  if (window.__mediaBlockedPreload) return;
  window.__mediaBlockedPreload = true;
  
  // Immediately inject CSS to hide all media while we process
  var style = document.createElement('style');
  style.id = 'media-block-preload';
  style.textContent = 
    'img:not([data-allow]),picture:not([data-allow]),video,audio,iframe[src*="youtube"],iframe[src*="youtu.be"],iframe[src*="vimeo"],iframe[src*="dailymotion"],iframe[src*="video"],iframe[src*="player"],source{opacity:0!important;visibility:hidden!important;pointer-events:none!important}' +
    'video,audio{display:none!important}';
  (document.head||document.documentElement).appendChild(style);
  
  // Store original setters
  var imgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  var imgSrcsetDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset');
  var videoSrcDesc = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'src');
  var audioSrcDesc = Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype, 'src');
  var sourceSrcDesc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'src');
  
  // Helper: check if element is allowed (logo, icon, small UI element)
  function isAllowedMedia(el) {
    if (!el || el.hasAttribute('data-blocked')) return false;
    if (el.hasAttribute('data-allow')) return true;
    
    var tag = el.tagName;
    var cls = (el.className || '').toString().toLowerCase();
    var src = (el.getAttribute('src') || '').toLowerCase();
    var alt = (el.getAttribute('alt') || '').toLowerCase();
    var id = (el.id || '').toLowerCase();
    var w = el.width || el.getAttribute('width') || 0;
    var h = el.height || el.getAttribute('height') || 0;
    
    // Allow small images (likely icons/logos)
    if (tag === 'IMG' && ((w > 0 && w <= 64) || (h > 0 && h <= 64))) return true;
    
    // Allow logos and icons by class/id/src/alt
    var logoPatterns = ['logo', 'icon', 'favicon', 'brand', 'avatar', 'profile-pic', 'sprite'];
    for (var i = 0; i < logoPatterns.length; i++) {
      var p = logoPatterns[i];
      if (cls.indexOf(p) !== -1 || src.indexOf(p) !== -1 || alt.indexOf(p) !== -1 || id.indexOf(p) !== -1) return true;
    }
    
    // Allow if in header/nav/footer
    var parent = el.parentElement;
    var depth = 0;
    while (parent && depth < 6) {
      var pTag = parent.tagName;
      var pCls = (parent.className || '').toString().toLowerCase();
      var pRole = (parent.getAttribute('role') || '').toLowerCase();
      if (pTag === 'HEADER' || pTag === 'NAV' || pTag === 'FOOTER' ||
          pRole === 'banner' || pRole === 'navigation' || pRole === 'contentinfo' ||
          pCls.indexOf('header') !== -1 || pCls.indexOf('navbar') !== -1 || 
          pCls.indexOf('nav-') !== -1 || pCls.indexOf('footer') !== -1 ||
          pCls.indexOf('menu') !== -1 || pCls.indexOf('topbar') !== -1) {
        return true;
      }
      parent = parent.parentElement;
      depth++;
    }
    
    return false;
  }
  
  // Block image src setter
  if (imgSrcDesc && imgSrcDesc.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      get: imgSrcDesc.get,
      set: function(val) {
        if (!isAllowedMedia(this)) {
          this.setAttribute('data-blocked', 'true');
          this.setAttribute('data-original-src', val || '');
          return;
        }
        this.setAttribute('data-allow', 'true');
        imgSrcDesc.set.call(this, val);
      },
      configurable: true
    });
  }
  
  // Block image srcset setter
  if (imgSrcsetDesc && imgSrcsetDesc.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'srcset', {
      get: imgSrcsetDesc.get,
      set: function(val) {
        if (!isAllowedMedia(this)) {
          this.setAttribute('data-blocked', 'true');
          this.setAttribute('data-original-srcset', val || '');
          return;
        }
        imgSrcsetDesc.set.call(this, val);
      },
      configurable: true
    });
  }
  
  // Block video src setter
  if (videoSrcDesc && videoSrcDesc.set) {
    Object.defineProperty(HTMLVideoElement.prototype, 'src', {
      get: videoSrcDesc.get,
      set: function(val) {
        this.setAttribute('data-blocked', 'true');
        return; // Never allow video
      },
      configurable: true
    });
  }
  
  // Block audio src setter
  if (audioSrcDesc && audioSrcDesc.set) {
    Object.defineProperty(HTMLAudioElement.prototype, 'src', {
      get: audioSrcDesc.get,
      set: function(val) {
        this.setAttribute('data-blocked', 'true');
        return; // Never allow audio
      },
      configurable: true
    });
  }
  
  // Block source element src setter
  if (sourceSrcDesc && sourceSrcDesc.set) {
    Object.defineProperty(HTMLSourceElement.prototype, 'src', {
      get: sourceSrcDesc.get,
      set: function(val) {
        this.setAttribute('data-blocked', 'true');
        return;
      },
      configurable: true
    });
  }
  
  // Override video/audio play methods
  HTMLVideoElement.prototype.play = function() { return Promise.reject(new Error('Blocked')); };
  HTMLVideoElement.prototype.load = function() { };
  HTMLAudioElement.prototype.play = function() { return Promise.reject(new Error('Blocked')); };
  HTMLAudioElement.prototype.load = function() { };
  
  // Block Web Audio API (used by YouTube and other players)
  if (window.AudioContext) {
    var OrigAudioContext = window.AudioContext;
    window.AudioContext = function() {
      var ctx = new OrigAudioContext();
      ctx.suspend();
      Object.defineProperty(ctx, 'state', { get: function() { return 'suspended'; } });
      ctx.resume = function() { return Promise.reject(new Error('Blocked')); };
      ctx.createMediaElementSource = function() { return { connect: function(){} }; };
      ctx.createMediaStreamSource = function() { return { connect: function(){} }; };
      return ctx;
    };
  }
  if (window.webkitAudioContext) {
    var OrigWebkitAudioContext = window.webkitAudioContext;
    window.webkitAudioContext = function() {
      var ctx = new OrigWebkitAudioContext();
      ctx.suspend();
      ctx.resume = function() { return Promise.reject(new Error('Blocked')); };
      return ctx;
    };
  }
  
  // Block MediaSource Extensions (used for streaming video)
  if (window.MediaSource) {
    window.MediaSource = function() {
      throw new Error('MediaSource blocked');
    };
    window.MediaSource.isTypeSupported = function() { return false; };
  }
  
  // Block volume changes to ensure muting
  Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    get: function() { return 0; },
    set: function() { },
    configurable: true
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
    get: function() { return true; },
    set: function() { },
    configurable: true
  });
  
})();true;
`;

export const MEDIA_BLOCK_POSTLOAD_JS = `
(function() {
  'use strict';
  if (window.__mediaBlockedPostload) return;
  window.__mediaBlockedPostload = true;
  
  function isAllowedMedia(el) {
    if (!el) return false;
    if (el.hasAttribute('data-allow')) return true;
    if (el.hasAttribute('data-blocked')) return false;
    
    var tag = el.tagName;
    var cls = (el.className || '').toString().toLowerCase();
    var src = (el.getAttribute('src') || el.currentSrc || '').toLowerCase();
    var alt = (el.getAttribute('alt') || '').toLowerCase();
    var id = (el.id || '').toLowerCase();
    
    // Get computed dimensions
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    var w = rect ? rect.width : (el.width || parseInt(el.getAttribute('width')) || 0);
    var h = rect ? rect.height : (el.height || parseInt(el.getAttribute('height')) || 0);
    
    // Allow small images (icons/logos) - max 80px
    if (tag === 'IMG' && w > 0 && h > 0 && w <= 80 && h <= 80) return true;
    
    // Allow by patterns
    var patterns = ['logo', 'icon', 'favicon', 'brand', 'avatar', 'profile', 'sprite', 'emoji', 'badge'];
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      if (cls.indexOf(p) !== -1 || src.indexOf(p) !== -1 || alt.indexOf(p) !== -1 || id.indexOf(p) !== -1) return true;
    }
    
    // Check parent containers
    var parent = el.parentElement;
    var depth = 0;
    while (parent && depth < 8) {
      var pTag = parent.tagName;
      var pCls = (parent.className || '').toString().toLowerCase();
      var pRole = (parent.getAttribute('role') || '').toLowerCase();
      if (pTag === 'HEADER' || pTag === 'NAV' || pTag === 'FOOTER' ||
          pRole === 'banner' || pRole === 'navigation' || pRole === 'contentinfo' ||
          pCls.indexOf('header') !== -1 || pCls.indexOf('navbar') !== -1 || 
          pCls.indexOf('-nav') !== -1 || pCls.indexOf('nav-') !== -1 || 
          pCls.indexOf('footer') !== -1 || pCls.indexOf('menu') !== -1 || 
          pCls.indexOf('topbar') !== -1 || pCls.indexOf('sidebar') !== -1 ||
          pCls.indexOf('toolbar') !== -1) {
        return true;
      }
      parent = parent.parentElement;
      depth++;
    }
    
    return false;
  }
  
  function blockElement(el) {
    if (!el || el.hasAttribute('data-blocked')) return;
    var tag = el.tagName;
    
    if (tag === 'IMG') {
      if (isAllowedMedia(el)) {
        el.setAttribute('data-allow', 'true');
        el.style.opacity = '';
        el.style.visibility = '';
        return;
      }
      el.setAttribute('data-blocked', 'true');
      if (el.src) el.setAttribute('data-original-src', el.src);
      if (el.srcset) el.setAttribute('data-original-srcset', el.srcset);
      el.removeAttribute('src');
      el.removeAttribute('srcset');
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
    }
    else if (tag === 'VIDEO' || tag === 'AUDIO') {
      el.setAttribute('data-blocked', 'true');
      el.pause && el.pause();
      el.muted = true;
      el.removeAttribute('src');
      el.removeAttribute('autoplay');
      el.load && el.load(); // Reset to clear buffered data
      el.style.display = 'none';
      // Remove all source children
      var sources = el.querySelectorAll('source');
      sources.forEach(function(s) { s.removeAttribute('src'); });
    }
    else if (tag === 'SOURCE') {
      el.setAttribute('data-blocked', 'true');
      el.removeAttribute('src');
      el.removeAttribute('srcset');
    }
    else if (tag === 'IFRAME') {
      var src = (el.src || '').toLowerCase();
      // Block all video-related iframes
      if (src.indexOf('youtube') !== -1 || src.indexOf('youtu.be') !== -1 || 
          src.indexOf('vimeo') !== -1 || src.indexOf('dailymotion') !== -1 ||
          src.indexOf('video') !== -1 || src.indexOf('player') !== -1 ||
          src.indexOf('embed') !== -1 || src.indexOf('twitch') !== -1 ||
          src.indexOf('reddit') !== -1 || src.indexOf('redd.it') !== -1 ||
          src.indexOf('gfycat') !== -1 || src.indexOf('imgur') !== -1 ||
          src.indexOf('streamable') !== -1 || src.indexOf('v.redd.it') !== -1 ||
          src.indexOf('media') !== -1 || src.indexOf('cdn') !== -1) {
        el.setAttribute('data-blocked', 'true');
        el.setAttribute('data-original-src', el.src);
        el.removeAttribute('src');
        el.style.display = 'none';
      }
    }
    // Block Reddit's shreddit-player component
    else if (tag === 'SHREDDIT-PLAYER' || tag === 'SHREDDIT-PLAYER-2' || el.tagName.indexOf('PLAYER') !== -1) {
      el.setAttribute('data-blocked', 'true');
      el.style.display = 'none';
      // Remove all video/source children
      el.querySelectorAll('video,source,audio').forEach(function(child) { blockElement(child); });
    }
    else if (tag === 'PICTURE') {
      el.querySelectorAll('source').forEach(function(s) {
        s.setAttribute('data-blocked', 'true');
        s.removeAttribute('srcset');
        s.removeAttribute('src');
      });
      var img = el.querySelector('img');
      if (img) blockElement(img);
    }
  }
  
  // Process all existing media
  function processAllMedia() {
    document.querySelectorAll('img:not([data-blocked]):not([data-allow])').forEach(blockElement);
    document.querySelectorAll('video:not([data-blocked]),audio:not([data-blocked])').forEach(blockElement);
    document.querySelectorAll('iframe:not([data-blocked])').forEach(blockElement);
    document.querySelectorAll('picture:not([data-blocked])').forEach(blockElement);
    document.querySelectorAll('source:not([data-blocked])').forEach(blockElement);
    // Reddit and custom video players
    document.querySelectorAll('shreddit-player,shreddit-player-2,[class*="player"]:not([data-blocked])').forEach(function(el) {
      if (el.querySelector('video') || el.tagName.indexOf('PLAYER') !== -1) {
        blockElement(el);
      }
    });
    // Force mute and pause all existing video/audio elements again
    document.querySelectorAll('video,audio').forEach(function(el) {
      try {
        el.pause();
        el.muted = true;
        el.volume = 0;
        el.src = '';
        el.removeAttribute('src');
        el.removeAttribute('autoplay');
      } catch(e) {}
    });
  }
  
  // Run immediately
  processAllMedia();
  
  // Run again after short delays to catch late-loading content
  setTimeout(processAllMedia, 100);
  setTimeout(processAllMedia, 500);
  setTimeout(processAllMedia, 1500);
  
  // MutationObserver for dynamically added content
  var observer = new MutationObserver(function(mutations) {
    var shouldProcess = false;
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
      if (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'srcset')) {
        var el = m.target;
        if (el && !el.hasAttribute('data-allow')) {
          blockElement(el);
        }
      }
    }
    if (shouldProcess) {
      processAllMedia();
    }
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset']
  });
  
  // Update CSS to show allowed images and hide everything else
  var style = document.getElementById('media-block-preload');
  if (style) {
    style.textContent = 
      'img:not([data-allow]):not([data-blocked]),picture:not([data-allow]):not([data-blocked]){opacity:0!important;visibility:hidden!important}' +
      'img[data-blocked],picture[data-blocked]{display:none!important}' +
      'video,audio,video[data-blocked],audio[data-blocked]{display:none!important;width:0!important;height:0!important;position:absolute!important;left:-9999px!important}' +
      'iframe[data-blocked]{display:none!important}' +
      'shreddit-player,shreddit-player-2,[data-blocked]{display:none!important}' +
      '[class*="video-player"],[class*="VideoPlayer"],[class*="media-player"]{display:none!important}';
  }
  
  // Extra: periodically check for new videos and mute them
  setInterval(function() {
    document.querySelectorAll('video,audio').forEach(function(el) {
      try {
        if (!el.paused) el.pause();
        if (!el.muted) el.muted = true;
        if (el.volume > 0) el.volume = 0;
      } catch(e) {}
    });
  }, 500);
  
})();true;
`;

/**
 * Generate media filter script with whitelist status
 */
export function getMediaFilterScript(isWhitelisted: boolean): string {
    // Check if media blocking is globally enabled
    if (!isMediaBlockingEnabled()) {
        return 'true;'; // Media blocking is disabled globally
    }

    if (isWhitelisted) {
        return 'true;'; // No filtering for whitelisted sites
    }
    return MEDIA_BLOCK_POSTLOAD_JS;
}

/**
 * Get preload script (runs before page content loads)
 */
export function getMediaFilterPreloadScript(isWhitelisted: boolean): string {
    // Check if media blocking is globally enabled
    if (!isMediaBlockingEnabled()) {
        return 'true;'; // Media blocking is disabled globally
    }

    if (isWhitelisted) {
        return 'true;';
    }
    return MEDIA_BLOCK_PRELOAD_JS;
}

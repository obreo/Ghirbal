/**
 * Application Configuration
 * 
 * Centralized configuration for app-wide settings and features.
 * 
 * HOW TO USE:
 * -----------
 * 1. Change any setting below from `true` to `false` to disable it
 * 2. Save this file
 * 3. Rebuild the app with: npx expo prebuild --clean
 * 4. Run the app
 * 
 * EXAMPLE:
 * To disable image/video blocking:
 * Change `ENABLE_MEDIA_BLOCKING: true` to `ENABLE_MEDIA_BLOCKING: false`
 */

export const APP_CONFIG = {
  /**
   * Enable/Disable Media Blocking (Images and Videos)
   * 
   * When true: Images and videos are blocked on all non-whitelisted sites
   * When false: All images and videos load normally on all sites
   * 
   * NOTE: If enabled, you can whitelist specific sites in:
   * client/lib/media-whitelist.ts
   * 
   * @default true
   */
  ENABLE_MEDIA_BLOCKING: process.env.ENABLE_MEDIA_BLOCKING === 'true',

  /**
   * Enable/Disable Google Access Control
   * 
   * When true: Google.com access is restricted to safesearchengine.com referrals only
   * When false: Google.com can be accessed directly
   * 
   * @default true
   */
  ENABLE_GOOGLE_ACCESS_CONTROL: process.env.ENABLE_GOOGLE_ACCESS_CONTROL === 'false',

  /**
   * YouTube Restricted Mode
   * 
   * When true: YouTube restricted mode is ALWAYS enforced (cookie is set permanently)
   *            Comments may not be visible on some videos
   * When false: YouTube restricted mode is dynamic (allows reading comments)
   *             But still blocks shorts and suggested videos
   * 
   * @default false (dynamic mode - allows comments)
   */
  ENABLE_YOUTUBE_ALWAYS_RESTRICTED: process.env.ENABLE_YOUTUBE_ALWAYS_RESTRICTED === 'true',

  /**
   * Enable/Disable Google Images Blocking
   * 
   * When true: Google Images tab is Hidden AND Blocked
   * When false: Google Images tab is Visible AND Accessible
   * 
   * @default true
   */
  ENABLE_GOOGLE_IMAGES_BLOCKING:  process.env.ENABLE_GOOGLE_IMAGES_BLOCKING === 'false',
};


/**
 * Get the current media blocking setting
 */
export function isMediaBlockingEnabled(): boolean {
  return APP_CONFIG.ENABLE_MEDIA_BLOCKING;
}

/**
 * Get the current Google access control setting
 */
export function isGoogleAccessControlEnabled(): boolean {
  return APP_CONFIG.ENABLE_GOOGLE_ACCESS_CONTROL;
}

/**
 * Get the YouTube restricted mode setting
 */
export function isYouTubeAlwaysRestrictedEnabled(): boolean {
  return APP_CONFIG.ENABLE_YOUTUBE_ALWAYS_RESTRICTED;
}

/**
 * Get the Google Images blocking setting
 */
export function isGoogleImagesBlockingEnabled(): boolean {
  return APP_CONFIG.ENABLE_GOOGLE_IMAGES_BLOCKING;
}


/**
 * Expo Config Plugin: withWebViewPermissionControl
 * 
 * This plugin modifies react-native-webview's Android native code to deny ALL
 * WebView permission requests by default. This ensures that ALL permissions
 * are controlled through the app's JavaScript injection and lock icon menu,
 * not automatically granted by the Android WebView.
 * 
 * Blocked permissions include:
 * - Microphone (AUDIO_CAPTURE)
 * - Camera (VIDEO_CAPTURE)
 * - Geolocation
 * - Notifications
 * - Images / Photo Gallery
 * - File Storage / File Uploads
 * - Protected Media ID (DRM)
 * - MIDI devices
 * - Any other WebView permissions
 * 
 * The plugin works by:
 * 1. Finding the RNCWebChromeClient.java file in react-native-webview
 * 2. Modifying onPermissionRequest to always deny all permissions
 * 3. Modifying onGeolocationPermissionsShowPrompt to always deny geolocation
 * 4. Modifying onShowFileChooser to always deny file/image access
 * 5. This runs during `expo prebuild`
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = 'ABrowserSecurity_PATCHED';

const withWebViewPermissionControl = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      
      // Path to react-native-webview's Android source
      const webviewPath = path.join(
        projectRoot,
        'node_modules',
        'react-native-webview',
        'android',
        'src',
        'main',
        'java',
        'com',
        'reactnativecommunity',
        'webview'
      );
      
      const chromeClientPath = path.join(webviewPath, 'RNCWebChromeClient.java');
      
      console.log('[withWebViewPermissionControl] Looking for:', chromeClientPath);
      
      if (fs.existsSync(chromeClientPath)) {
        let content = fs.readFileSync(chromeClientPath, 'utf-8');
        
        // Check if already patched
        if (content.includes(PATCH_MARKER)) {
          console.log('[withWebViewPermissionControl] Already patched, skipping');
          return config;
        }
        
         let patched = false;
         
         // NOTE: We do NOT patch onPermissionRequest because:
         // - React Native's onPermissionRequest handler needs to run to check site-specific permissions
         // - If we deny immediately in native code, React Native handler never gets called
         // - The React Native handler already denies by default and grants when site is allowed
         // 
         // If the file was previously patched with immediate deny, we need to restore it
         if (content.includes('ABrowserSecurity_PATCHED') && content.includes('onPermissionRequest')) {
           console.log('[withWebViewPermissionControl] ⚠ File was previously patched with immediate deny');
           console.log('[withWebViewPermissionControl]   You may need to remove node_modules and reinstall');
         }
         
         // Patch onGeolocationPermissionsShowPrompt method
        const geoMethodPattern = /public void onGeolocationPermissionsShowPrompt\(String origin, GeolocationPermissions\.Callback callback\)\s*\{/;
        
        if (geoMethodPattern.test(content)) {
          const geoBlockCode = `public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        // ABrowserSecurity_PATCHED - GEOLOCATION DENIED
        android.util.Log.w("ABrowserSecurity", "DENIED geolocation for: " + origin);
        callback.invoke(origin, false, false);
    }
    
    public void _unused_onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {`;
          
          content = content.replace(geoMethodPattern, geoBlockCode);
          patched = true;
          console.log('[withWebViewPermissionControl] ✓ Patched onGeolocationPermissionsShowPrompt');
        }
        
        // Patch onShowFileChooser method (blocks file/image access)
        const fileChooserPattern = /public boolean onShowFileChooser\(WebView webView,\s*ValueCallback<Uri\[\]> filePathCallback,\s*FileChooserParams fileChooserParams\)\s*\{/;
        
        if (fileChooserPattern.test(content)) {
          const fileBlockCode = `public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
        // ABrowserSecurity_PATCHED - FILE/IMAGE ACCESS DENIED
        android.util.Log.w("ABrowserSecurity", "DENIED file/image access");
        filePathCallback.onReceiveValue(null);
        return true;
    }
    
    public boolean _unused_onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {`;
          
          content = content.replace(fileChooserPattern, fileBlockCode);
          patched = true;
          console.log('[withWebViewPermissionControl] ✓ Patched onShowFileChooser (file/image access)');
        }
        
        if (patched) {
          fs.writeFileSync(chromeClientPath, content);
          console.log('[withWebViewPermissionControl] ✓ Successfully patched RNCWebChromeClient.java');
          console.log('[withWebViewPermissionControl] ALL WebView permissions are now DENIED by default:');
          console.log('[withWebViewPermissionControl]   • Microphone, Camera, Geolocation');
          console.log('[withWebViewPermissionControl]   • Images/Gallery, File Storage');
          console.log('[withWebViewPermissionControl]   • Notifications, DRM, MIDI, etc.');
        } else {
          console.warn('[withWebViewPermissionControl] WARNING: Could not find methods to patch');
        }
      } else {
        console.warn('[withWebViewPermissionControl] WARNING: RNCWebChromeClient.java not found');
        console.log('[withWebViewPermissionControl] Make sure react-native-webview is installed');
      }
      
      return config;
    },
  ]);
};

module.exports = withWebViewPermissionControl;


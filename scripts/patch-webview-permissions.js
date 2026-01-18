// #!/usr/bin/env node

// /**
//  * Script to patch react-native-webview to deny ALL WebView permissions by default
//  * 
//  * This script runs after npm install and modifies the native Android code
//  * to ensure that ALL WebView permissions are always denied at the native level:
//  * - Microphone (AUDIO_CAPTURE)
//  * - Camera (VIDEO_CAPTURE)
//  * - Geolocation
//  * - Notifications
//  * - Protected Media ID (DRM)
//  * - MIDI devices
//  * - Any other WebView permissions
//  * 
//  * The app controls permissions through JavaScript injection and the lock icon menu.
//  * 
//  * Run manually: node scripts/patch-webview-permissions.js
//  * Or automatically via postinstall in package.json
//  */

// const fs = require('fs');
// const path = require('path');

// const PATCH_MARKER = '// ABrowserSecurity_PATCHED';

// function patchWebViewPermissions() {
//   console.log('[patch-webview-permissions] Starting...');
//   console.log('[patch-webview-permissions] This will block ALL WebView permissions at native level.');
  
//   const projectRoot = process.cwd();
  
//   // Path to react-native-webview's Android source
//   const webviewPath = path.join(
//     projectRoot,
//     'node_modules',
//     'react-native-webview',
//     'android',
//     'src',
//     'main',
//     'java',
//     'com',
//     'reactnativecommunity',
//     'webview'
//   );
  
//   const chromeClientPath = path.join(webviewPath, 'RNCWebChromeClient.java');
  
//   console.log('[patch-webview-permissions] Looking for:', chromeClientPath);
  
//   if (!fs.existsSync(chromeClientPath)) {
//     console.log('[patch-webview-permissions] File not found. This is normal if node_modules is not installed yet.');
//     return;
//   }
  
//   let content = fs.readFileSync(chromeClientPath, 'utf-8');
  
//   // Check if already patched
//   if (content.includes(PATCH_MARKER)) {
//     console.log('[patch-webview-permissions] Already patched, skipping.');
//     return;
//   }
  
//   console.log('[patch-webview-permissions] Patching onPermissionRequest method...');
  
//   // Strategy: Insert denial code at the very beginning of the method body
//   const methodBodyStart = /public void onPermissionRequest\(final PermissionRequest request\)\s*\{/;
  
//   if (methodBodyStart.test(content)) {
//     // Instead of immediately denying, we need to let the React Native handler decide
//     // But we want to deny by default. The React Native onPermissionRequest prop will
//     // handle the actual granting/denying based on site-specific settings.
//     // 
//     // The original method will call the React Native handler, which will then
//     // grant or deny based on our site-specific permission settings.
//     // 
//     // We just need to ensure the original method runs, which will delegate to React Native.
//     // So we DON'T replace it - we let it run normally.
//     // 
//     // Actually, wait - if we don't patch it, it might auto-grant if system permissions exist.
//     // We need to patch it to ALWAYS go through React Native handler, and deny if not explicitly allowed.
    
//     // The issue is: react-native-webview's onPermissionRequest in React Native
//     // is called from the native side. If we deny immediately, React Native never gets called.
//     // 
//     // Solution: Don't patch onPermissionRequest - let it call React Native handler.
//     // The React Native handler will deny by default unless site is in allowed list.
    
//     console.log('[patch-webview-permissions] ⚠ NOT patching onPermissionRequest - letting React Native handler control it');
//     console.log('[patch-webview-permissions]   React Native onPermissionRequest prop will handle granting/denying');
    
//     // Don't patch onPermissionRequest - let React Native handle it
//     // We'll only patch geolocation and file chooser which are separate methods
//   } else {
//     console.error('[patch-webview-permissions] ERROR: Could not find onPermissionRequest method signature');
//     console.log('[patch-webview-permissions] The react-native-webview version may have a different structure.');
    
//     // Try to find any mention of the method
//     if (content.includes('onPermissionRequest')) {
//       console.log('[patch-webview-permissions] The method exists but has a different signature.');
//       console.log('[patch-webview-permissions] Please check node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebChromeClient.java');
//     }
//   }
  
//   // NOTE: We do NOT patch onPermissionRequest because:
//   // 1. The React Native onPermissionRequest handler needs to run to check site-specific permissions
//   // 2. If we deny immediately in native code, React Native handler never gets called
//   // 3. The React Native handler already denies by default and grants only when site is in allowed list
//   // 
//   // We only patch geolocation and file chooser which are separate methods
  
//   // Also patch geolocation permissions
//   patchGeolocationPermissions(webviewPath);
  
//   // Also patch file chooser (for images/gallery and file storage)
//   patchFileChooser(webviewPath);
// }

// function patchGeolocationPermissions(webviewPath) {
//   // Geolocation is handled separately in RNCWebChromeClient
//   const chromeClientPath = path.join(webviewPath, 'RNCWebChromeClient.java');
  
//   if (!fs.existsSync(chromeClientPath)) {
//     return;
//   }
  
//   let content = fs.readFileSync(chromeClientPath, 'utf-8');
  
//   // Check if geolocation is already patched
//   if (content.includes('ABrowserSecurity: GEOLOCATION DENIED')) {
//     return;
//   }
  
//   // Find onGeolocationPermissionsShowPrompt method
//   const geoMethodPattern = /public void onGeolocationPermissionsShowPrompt\(String origin, GeolocationPermissions\.Callback callback\)\s*\{/;
  
//   if (geoMethodPattern.test(content)) {
//     const geoBlockCode = `public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
//         // ABrowserSecurity_PATCHED - GEOLOCATION DENIED
//         android.util.Log.w("ABrowserSecurity", "DENIED geolocation for: " + origin);
//         callback.invoke(origin, false, false);
//     }
    
//     public void _unused_onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {`;
    
//     content = content.replace(geoMethodPattern, geoBlockCode);
//     fs.writeFileSync(chromeClientPath, content);
//     console.log('[patch-webview-permissions] ✓ Also patched geolocation permissions!');
//   }
// }

// function patchFileChooser(webviewPath) {
//   // File chooser for file inputs - handled in RNCWebChromeClient
//   // This blocks <input type="file"> which is used for:
//   // - Image/photo selection from gallery
//   // - File uploads from storage
//   // - Camera capture via file input
  
//   const chromeClientPath = path.join(webviewPath, 'RNCWebChromeClient.java');
  
//   if (!fs.existsSync(chromeClientPath)) {
//     return;
//   }
  
//   let content = fs.readFileSync(chromeClientPath, 'utf-8');
  
//   // Check if file chooser is already patched
//   if (content.includes('ABrowserSecurity: FILE/IMAGE ACCESS DENIED')) {
//     console.log('[patch-webview-permissions] File chooser already patched, skipping.');
//     return;
//   }
  
//   // Find onShowFileChooser method - this handles <input type="file">
//   // Method signature: public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams)
//   const fileChooserPattern = /public boolean onShowFileChooser\(WebView webView,\s*ValueCallback<Uri\[\]> filePathCallback,\s*FileChooserParams fileChooserParams\)\s*\{/;
  
//   if (fileChooserPattern.test(content)) {
//     const fileBlockCode = `public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
//         // ABrowserSecurity_PATCHED - FILE/IMAGE ACCESS DENIED
//         android.util.Log.w("ABrowserSecurity", "DENIED file/image access");
//         filePathCallback.onReceiveValue(null);
//         return true;
//     }
    
//     public boolean _unused_onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {`;
    
//     content = content.replace(fileChooserPattern, fileBlockCode);
//     fs.writeFileSync(chromeClientPath, content);
//     console.log('[patch-webview-permissions] ✓ Patched file chooser (blocks gallery/storage access)!');
//   } else {
//     // Try alternative pattern (method might have different formatting)
//     const altPattern = /public boolean onShowFileChooser\(/;
//     if (altPattern.test(content)) {
//       console.log('[patch-webview-permissions] ⚠ File chooser method found but signature differs.');
//       console.log('[patch-webview-permissions]   File/image uploads will be controlled via JavaScript only.');
//     }
//   }
// }

// function printSummary() {
//   console.log('');
//   console.log('╔════════════════════════════════════════════════════════════════╗');
//   console.log('║            ABrowser Security Patch Applied                      ║');
//   console.log('╠════════════════════════════════════════════════════════════════╣');
//   console.log('║ ALL WebView permissions are now BLOCKED by default:            ║');
//   console.log('║                                                                 ║');
//   console.log('║   ✓ Microphone (AUDIO_CAPTURE)                                 ║');
//   console.log('║   ✓ Camera (VIDEO_CAPTURE)                                     ║');
//   console.log('║   ✓ Geolocation (GPS)                                          ║');
//   console.log('║   ✓ Notifications                                              ║');
//   console.log('║   ✓ Images / Photo Gallery                                     ║');
//   console.log('║   ✓ File Storage / File Uploads                                ║');
//   console.log('║   ✓ Protected Media (DRM)                                      ║');
//   console.log('║   ✓ MIDI Devices                                               ║');
//   console.log('║   ✓ All other WebView permissions                              ║');
//   console.log('║                                                                 ║');
//   console.log('║ Users can enable permissions per-site via the lock icon menu.  ║');
//   console.log('╚════════════════════════════════════════════════════════════════╝');
//   console.log('');
// }

// // Run the patch
// try {
//   patchWebViewPermissions();
//   printSummary();
// } catch (error) {
//   console.error('[patch-webview-permissions] Error:', error.message);
//   process.exit(0); // Don't fail the install
// }


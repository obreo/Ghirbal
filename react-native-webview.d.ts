// react-native-webview.d.ts - Updated version (optional)
declare module 'react-native-webview' {
  export interface WebViewStatic {
    clearCookies(): Promise<void>;
  }
  
  export const WebView: React.ComponentType<any> & WebViewStatic;
}
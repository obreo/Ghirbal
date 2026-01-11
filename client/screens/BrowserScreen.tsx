import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  Keyboard,
  Share,
  BackHandler,
  Linking,
  ActionSheetIOS,
  NativeModules,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// ✅ FIXED: Import WebView as a named export to access static methods
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
const CookieManager = Constants.executionEnvironment !== 'storeClient' ? require('@react-native-cookies/cookies').default : null;
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useBrowser } from '@/lib/browser-context';
import { Spacing, BorderRadius } from '@/constants/theme';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import {
  isRedditUrl,
  REDDIT_NSFW_FILTER_JS,
  REDDIT_EARLY_CSS_JS,
} from '@/lib/filters/reddit_filters';
import {
  isYouTubeUrl,
  isBlockedYouTubeShortsUrl,
  YOUTUBE_CONTENT_FILTER_JS,
  getYouTubeContentFilterScript,
} from '@/lib/filters/youtube_filter';
import {
  getMediaFilterScript,
  getMediaFilterPreloadScript,
} from '@/lib/filters/visuals_filters';
import {
  processUrl,
  isApkDownload,
  getUrlOrSearch,
  isSubredditPage,
  getSubredditName,
  isMediaWhitelisted,
  isOAuthCallbackUrl,
  isReferrerFromSafeSearch,
} from '@/lib/content-filter';
import {
  isGoogleSearchUrl,
  GOOGLE_SAFESEARCH_SUPPRESSION_JS,
  GOOGLE_SECTIONS_BLOCK_JS,
  isGoogleSearchDomain,
  isGoogleAuthUrl,
  isBlockedGoogleSection,
  isGoogleHomePage,
  enforceGoogleSafeSearch,
  getGoogleUiCleanupScript,
} from '@/lib/search_engine_restrictions';
import { isYouTubeAlwaysRestrictedEnabled } from '@/lib/app-config';

const DEBUG_CONSOLE_PROXY_JS = `
(function() {
  var oldLog = console.log;
  var oldWarn = console.warn;
  var oldError = console.error;

  function sendLog(level, args) {
    try {
      var msg = args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        } catch(e) {
          return String(arg);
        }
      }).join(' ');

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'consoleLog',
          level: level,
          message: msg,
          url: window.location.href
        }));
      }
    } catch(e) {}
  }

  console.log = function() { sendLog('log', Array.from(arguments)); if(oldLog) oldLog.apply(console, arguments); };
  console.warn = function() { sendLog('warn', Array.from(arguments)); if(oldWarn) oldWarn.apply(console, arguments); };
  console.error = function() { sendLog('error', Array.from(arguments)); if(oldError) oldError.apply(console, arguments); };



  window.addEventListener('unhandledrejection', function(e) {
    sendLog('error', ['[Unhandled Promise]', e.reason]);
  });
})();
`;

type BrowserScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

const HEADER_HEIGHT = 56;
const TOOLBAR_HEIGHT = 44;
const HIDE_THRESHOLD = 30;

// Function to detect if a URL has an associated app scheme
const getAppSchemeForUrl = (url: string): { scheme: string; name: string; deepLink: string } | null => {
  try {
    if (!url || typeof url !== 'string') return null;

    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;
    const search = urlObj.search;

    if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('m.youtube.com')) {
      // YouTube uses vnd.youtube scheme
      let videoId = urlObj.searchParams.get('v');
      if (!videoId && host.includes('youtu.be')) {
        videoId = pathname.substring(1).split('?')[0];
      }
      const deepLink = videoId ? `vnd.youtube://${videoId}` : url;
      return { scheme: 'vnd.youtube://', name: 'YouTube', deepLink };
    }
    if (host.includes('twitter.com') || host.includes('x.com')) {
      return { scheme: 'twitter://', name: 'Twitter', deepLink: `twitter://twitter.com${pathname}${search}` };
    }
    if (host.includes('instagram.com')) {
      return { scheme: 'instagram://', name: 'Instagram', deepLink: `instagram://instagram.com${pathname}` };
    }
    if (host.includes('github.com')) {
      return { scheme: 'github://', name: 'GitHub', deepLink: `github://github.com${pathname}` };
    }
    if (host.includes('reddit.com')) {
      return { scheme: 'reddit://', name: 'Reddit', deepLink: `reddit://reddit.com${pathname}${search}` };
    }
    if (host.includes('linkedin.com')) {
      return { scheme: 'linkedin://', name: 'LinkedIn', deepLink: `linkedin://linkedin.com${pathname}${search}` };
    }
    if (host.includes('tiktok.com')) {
      return { scheme: 'tiktok://', name: 'TikTok', deepLink: `tiktok://tiktok.com${pathname}${search}` };
    }
    if (host.includes('spotify.com')) {
      // Spotify uses specific URI format like spotify:track:ID
      return { scheme: 'spotify://', name: 'Spotify', deepLink: `spotify:${pathname.replace(/\//g, ':').substring(1)}` };
    }
    return null;
  } catch (error) {
    console.log('Error parsing URL:', url, error);
    return null;
  }
};

// Function to perform full data clear
export default function BrowserScreen() {
  const navigation = useNavigation<BrowserScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const webViewRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {
    tabs,
    activeTabId,
    getActiveTab,
    updateTab,
    createTab,
    addBookmark,
    removeBookmark,
    isBookmarked,
    bookmarks,
    addToHistory,
    pendingCacheClear,
    acknowledgeCacheClear,
    pendingDataClear,
    acknowledgeDataClear,
    referringApp,
    clearReferringApp,
  } = useBrowser();

  const [urlInputValue, setUrlInputValue] = useState('https://safesearchengine.com/');
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);
  const ytPendingStopThenReloadRef = useRef(false);
  const [isUrlFocused, setIsUrlFocused] = useState(false);
  const [appAvailable, setAppAvailable] = useState<{ scheme: string; name: string; deepLink: string } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isSubreddit, setIsSubreddit] = useState(false);
  const [subredditSearchValue, setSubredditSearchValue] = useState('');
  const [subredditName, setSubredditName] = useState<string | null>(null);
  const [showSubredditSearchModal, setShowSubredditSearchModal] = useState(false);
  const [allowMicCamera, setAllowMicCamera] = useState(false);
  const [allowedMicCameraSites, setAllowedMicCameraSites] = useState<Set<string>>(new Set());
  const [allowedGPSSites, setAllowedGPSSites] = useState<Set<string>>(new Set());
  const [allowedStorageSites, setAllowedStorageSites] = useState<Set<string>>(new Set());
  const [allowedNotificationsSites, setAllowedNotificationsSites] = useState<Set<string>>(new Set());
  const [allowedImagesSites, setAllowedImagesSites] = useState<Set<string>>(new Set());

  // Navigation-based permission control: { origin: boolean }
  // true = camera/mic allowed, false = blocked, undefined = prompt user
  const [sitePermissions, setSitePermissions] = useState<Record<string, boolean>>({});
  const sitePermissionsRef = useRef<Record<string, boolean>>({});

  // YouTube referrer tracking for shorts blocking
  const youtubeReferrerRef = useRef<string | null>(null);

  // Authorized Google Session URLS (Session Memory)
  // Stores URLs that have been successfully visited/validated in this session
  // Allows "Back" button to work even if referrer is lost
  const authorizedGoogleUrls = useRef<Set<string>>(new Set());

  // Track previous URL for Google referrer checking
  const previousUrlRef = useRef<string | null>(null);
  const [pendingPermissionOrigin, setPendingPermissionOrigin] = useState<string | null>(null);

  // Counter to force WebView navigation when we need to redirect
  const [forceNavCounter, setForceNavCounter] = useState(0);

  // Keep ref in sync
  useEffect(() => {
    sitePermissionsRef.current = sitePermissions;
  }, [sitePermissions]);

  // Initialize previousUrlRef when active tab changes
  useEffect(() => {
    const activeTab = getActiveTab();
    console.log('[previousUrlRef Init] Active tab changed');
    console.log('  Active Tab ID:', activeTabId);
    console.log('  Active Tab URL:', activeTab?.url);
    if (activeTab && activeTab.url) {
      previousUrlRef.current = activeTab.url;
      console.log('  ✓ Set previousUrlRef to:', activeTab.url);
    } else {
      console.log('  ⚠️ No URL to set');
    }
  }, [activeTabId, getActiveTab]);

  // Helper: Extract origin from URL (e.g., "https://meet.google.com")
  const extractOrigin = useCallback((url: string): string | null => {
    try {
      const urlObj = new URL(url);
      return urlObj.origin;
    } catch (error) {
      return null;
    }
  }, []);

  const [permissionCounter, setPermissionCounter] = useState(0); // For forcing re-mount when permissions change
  const [systemPermissionsGranted, setSystemPermissionsGranted] = useState<{
    camera?: boolean;
    microphone?: boolean;
    gps?: boolean;
    storage?: boolean;
    notifications?: boolean;
  }>({
    camera: false,
    microphone: false,
    gps: false,
    storage: false,
    notifications: false,
  });

  // Refs to always have access to latest permission values in callbacks
  const allowedMicCameraSitesRef = useRef<Set<string>>(new Set());
  const allowedGPSSitesRef = useRef<Set<string>>(new Set());
  const allowedStorageSitesRef = useRef<Set<string>>(new Set());
  const allowedNotificationsSitesRef = useRef<Set<string>>(new Set());
  const allowedImagesSitesRef = useRef<Set<string>>(new Set());

  // Keep refs in sync with state
  useEffect(() => {
    allowedMicCameraSitesRef.current = allowedMicCameraSites;
  }, [allowedMicCameraSites]);

  useEffect(() => {
    allowedGPSSitesRef.current = allowedGPSSites;
  }, [allowedGPSSites]);

  useEffect(() => {
    allowedStorageSitesRef.current = allowedStorageSites;
  }, [allowedStorageSites]);

  useEffect(() => {
    allowedNotificationsSitesRef.current = allowedNotificationsSites;
  }, [allowedNotificationsSites]);

  useEffect(() => {
    allowedImagesSitesRef.current = allowedImagesSites;
  }, [allowedImagesSites]);

  const loadingProgress = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const headerVisible = useSharedValue(1);
  const activeTab = getActiveTab();

  // Permission persistence functions
  const PERMISSION_STORAGE_KEYS = {
    mic: '@safebrowse_permissions_mic',
    gps: '@safebrowse_permissions_gps',
    storage: '@safebrowse_permissions_storage',
    notifications: '@safebrowse_permissions_notifications',
    images: '@safebrowse_permissions_images',
  };

  // Normalize hostname (remove www. prefix for consistent matching)
  const normalizeHostname = useCallback((host: string): string => {
    if (!host || host === 'unknown') return host;
    // Remove www. prefix for matching (www.google.com -> google.com)
    if (host.startsWith('www.')) {
      return host.substring(4);
    }
    return host;
  }, []);

  const askToRemember = useCallback(async (permissionType: 'mic' | 'gps' | 'storage' | 'notifications' | 'images', hostname: string) => {
    try {
      // Normalize hostname before saving
      const normalized = normalizeHostname(hostname);
      const key = PERMISSION_STORAGE_KEYS[permissionType];
      const existing = await AsyncStorage.getItem(key);
      const sites = existing ? JSON.parse(existing) : [];
      if (!sites.includes(normalized)) {
        sites.push(normalized);
        await AsyncStorage.setItem(key, JSON.stringify(sites));
      }
    } catch (error) {
      console.error('Error saving permission:', error);
    }
  }, [normalizeHostname]);

  const removePersistedPermission = useCallback(async (permissionType: 'mic' | 'gps' | 'storage' | 'notifications' | 'images', hostname: string) => {
    try {
      const key = PERMISSION_STORAGE_KEYS[permissionType];
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        const sites = JSON.parse(existing);
        const filtered = sites.filter((site: string) => site !== hostname);
        await AsyncStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch (error) {
      console.error('Error removing permission:', error);
    }
  }, []);

  const loadPersistedPermissions = useCallback(async () => {
    try {
      const [micData, gpsData, storageData, notificationsData, imagesData] = await Promise.all([
        AsyncStorage.getItem(PERMISSION_STORAGE_KEYS.mic),
        AsyncStorage.getItem(PERMISSION_STORAGE_KEYS.gps),
        AsyncStorage.getItem(PERMISSION_STORAGE_KEYS.storage),
        AsyncStorage.getItem(PERMISSION_STORAGE_KEYS.notifications),
        AsyncStorage.getItem(PERMISSION_STORAGE_KEYS.images),
      ]);

      if (micData) {
        const sites = new Set<string>(JSON.parse(micData));
        setAllowedMicCameraSites(sites);
        allowedMicCameraSitesRef.current = sites;
      }
      if (gpsData) {
        const sites = new Set<string>(JSON.parse(gpsData));
        setAllowedGPSSites(sites);
        allowedGPSSitesRef.current = sites;
      }
      if (storageData) {
        const sites = new Set<string>(JSON.parse(storageData));
        setAllowedStorageSites(sites);
        allowedStorageSitesRef.current = sites;
      }
      if (notificationsData) {
        const sites = new Set<string>(JSON.parse(notificationsData));
        setAllowedNotificationsSites(sites);
        allowedNotificationsSitesRef.current = sites;
      }
      if (imagesData) {
        const sites = new Set<string>(JSON.parse(imagesData));
        setAllowedImagesSites(sites);
        allowedImagesSitesRef.current = sites;
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  }, []);

  // Load persisted permissions on mount
  // Load persistence logic
  useEffect(() => {
    loadPersistedPermissions();
  }, [loadPersistedPermissions]);

  // Load site permissions (navigation-based) on mount
  const SITE_PERMISSIONS_KEY = '@safebrowse_site_permissions';

  const loadSitePermissions = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SITE_PERMISSIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSitePermissions(parsed);
        sitePermissionsRef.current = parsed;
      }
    } catch (error) {
      console.error('Error loading site permissions:', error);
    }
  }, []);

  const saveSitePermissions = useCallback(async (newPermissions: Record<string, boolean>) => {
    try {
      await AsyncStorage.setItem(SITE_PERMISSIONS_KEY, JSON.stringify(newPermissions));
      setSitePermissions(newPermissions);
      sitePermissionsRef.current = newPermissions;
    } catch (error) {
      console.error('Error saving site permissions:', error);
    }
  }, []);

  useEffect(() => {
    loadSitePermissions();
  }, [loadSitePermissions]);

  // Show permission prompt for a new site
  const showPermissionPrompt = useCallback((origin: string, onDecision: (allowed: boolean) => void) => {
    Alert.alert(
      'Camera/Microphone Access',
      `Allow "${origin}" to access your camera and microphone?`,
      [
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            const newPerms = { ...sitePermissionsRef.current, [origin]: false };
            saveSitePermissions(newPerms);
            onDecision(false);
          }
        },
        {
          text: 'Allow',
          onPress: () => {
            const newPerms = { ...sitePermissionsRef.current, [origin]: true };
            saveSitePermissions(newPerms);
            onDecision(true);
          }
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => onDecision(false)
        }
      ],
      { cancelable: false }
    );
  }, [saveSitePermissions]);


  // Configure notification behavior
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  // Handle notification taps - navigate to the site that sent the notification
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.url) {
        // Navigate to the URL that sent the notification
        if (activeTabId) {
          updateTab(activeTabId, { url: data.url, sourceUrl: data.url });
        } else {
          createTab(data.url);
        }
      }
    });

    return () => subscription.remove();
  }, [activeTabId, updateTab, createTab]);

  // Function to display a notification from a website
  const showWebsiteNotification = useCallback(async (title: string, options: { body?: string; icon?: string; tag?: string; url?: string }) => {
    try {
      const activeTab = getActiveTab();
      const url = options.url || activeTab?.url || 'https://safesearchengine.com/';

      // Get current hostname for the notification
      let hostname = 'Unknown';
      try {
        hostname = new URL(url).hostname;
      } catch {
        console.log('Error parsing URL for notification:', url);
        return;
      }

      // Check if notifications are allowed for this site
      if (!allowedNotificationsSites.has(hostname)) {
        console.log(`[Notification] Blocked notification from ${hostname} - not enabled`);
        return;
      }

      // Request notification permissions if not already granted
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return;
      }

      // Display the notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title || 'Notification',
          body: options.body || '',
          data: {
            url: url,
            hostname: hostname,
          },
          sound: true,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [allowedNotificationsSites, getActiveTab]);

  // Check if system has granted permissions to the app
  useEffect(() => {
    if (Platform.OS === 'android') {
      const checkPermissions = async () => {
        try {
          const PermissionsModule = NativeModules.PermissionsModule;
          if (PermissionsModule && typeof PermissionsModule.checkPermissions === 'function') {
            const result = await PermissionsModule.checkPermissions();
            console.log('📋 System Permissions Status:', result);
            setSystemPermissionsGranted(result);
          } else {
            console.log('ℹ️ Permissions check: Module not available, assuming default state');
            setSystemPermissionsGranted({
              camera: false,
              microphone: false,
              gps: false,
              storage: false,
              notifications: false,
            });
          }
        } catch (error) {
          console.log('Permission check error:', error);
        }
      };

      // Check permissions on mount and every 5 seconds
      checkPermissions();
      const interval = setInterval(checkPermissions, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  const showChrome = useCallback(() => {
    headerVisible.value = withTiming(1, { duration: 200 });
    lastScrollY.value = 0;
    setKeyboardVisible(false);
  }, [headerVisible, lastScrollY]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates?.height || 0);
      // Only hide header if URL is not focused
      if (!isUrlFocused) {
        headerVisible.value = withTiming(0, { duration: 150 });
      }
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      showChrome();
    });
    const willHideSub = Keyboard.addListener('keyboardWillHide', () => {
      showChrome();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      willHideSub.remove();
    };
  }, [headerVisible, showChrome, isUrlFocused]);

  useEffect(() => {
    if (pendingCacheClear && webViewRef.current && typeof webViewRef.current.clearCache === 'function') {
      try {
        webViewRef.current.clearCache(true);
        acknowledgeCacheClear();
      } catch {
        acknowledgeCacheClear();
      }
    }
  }, [pendingCacheClear, acknowledgeCacheClear]);

  useEffect(() => {
    if (pendingDataClear) {
      performFullDataClear();
      authorizedGoogleUrls.current.clear();
    }
  }, [pendingDataClear]);

  useFocusEffect(
    useCallback(() => {
      if (pendingCacheClear && webViewRef.current && typeof webViewRef.current.clearCache === 'function') {
        try {
          webViewRef.current.clearCache(true);
          acknowledgeCacheClear();
        } catch {
          acknowledgeCacheClear();
        }
      }

      const onBackPress = () => {
        if (activeTab?.canGoBack) {
          webViewRef.current?.goBack();
          return true;
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [activeTab?.canGoBack, pendingCacheClear, acknowledgeCacheClear])
  );

  useEffect(() => {
    if (activeTab && !isUrlFocused) {
      setUrlInputValue(activeTab.url);
    }
  }, [activeTab?.url, isUrlFocused]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${interpolate(loadingProgress.value, [0, 1], [0, 100])}%`,
    opacity: loadingProgress.value > 0 && loadingProgress.value < 1 ? 1 : 0,
  }));

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          headerVisible.value,
          [0, 1],
          [-(HEADER_HEIGHT + insets.top), 0],
          Extrapolation.CLAMP
        ),
      },
    ],
    opacity: headerVisible.value,
  }));

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          headerVisible.value,
          [0, 1],
          [TOOLBAR_HEIGHT + insets.bottom, 0],
          Extrapolation.CLAMP
        ),
      },
    ],
    opacity: headerVisible.value,
  }));

  const webViewContainerAnimatedStyle = useAnimatedStyle(() => ({
    paddingTop: interpolate(
      headerVisible.value,
      [0, 1],
      [insets.top, HEADER_HEIGHT + insets.top + Spacing.xs],
      Extrapolation.CLAMP
    ),
    paddingBottom: interpolate(
      headerVisible.value,
      [0, 1],
      [insets.bottom, TOOLBAR_HEIGHT + insets.bottom + Spacing.xs],
      Extrapolation.CLAMP
    ),
  }));

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    'worklet';
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.value;

    if (currentY <= 0) {
      headerVisible.value = withTiming(1, { duration: 200 });
    } else if (diff > HIDE_THRESHOLD) {
      headerVisible.value = withTiming(0, { duration: 200 });
      lastScrollY.value = currentY;
    } else if (diff < -HIDE_THRESHOLD) {
      headerVisible.value = withTiming(1, { duration: 200 });
      lastScrollY.value = currentY;
    }

    scrollY.value = currentY;
  }, []);

  const scrollTrackingJS = `
    (function() {
      let lastY = 0;
      window.addEventListener('scroll', function() {
        const currentY = window.scrollY;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'scroll',
          y: currentY
        }));
        lastY = currentY;
      }, { passive: true });
      
      // Long press detection for links
      let longPressTimer = null;
      let longPressTarget = null;
      
      document.addEventListener('touchstart', function(e) {
        const link = e.target.closest('a');
        if (link && link.href) {
          longPressTarget = link;
          longPressTimer = setTimeout(function() {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'longPressLink',
              url: link.href,
              text: link.textContent || link.href
            }));
            longPressTarget = null;
          }, 500);
        }
      }, { passive: false });
      
      document.addEventListener('touchend', function() {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      });
      
      document.addEventListener('touchmove', function() {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      });
    })();
    true;
  `;

  // JavaScript to intercept Web Notification API
  const notificationInterceptionJS = `
    (function() {
      if (typeof window.Notification === 'undefined') {
        return;
      }

      // Store original Notification constructor
      const OriginalNotification = window.Notification;
      const notificationInstances = new Map();

      // Override Notification constructor
      window.Notification = function(title, options) {
        options = options || {};
        
        // Get current page URL
        const currentUrl = window.location.href;
        const hostname = window.location.hostname;
        
        // Send notification request to React Native
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'webNotification',
          title: title,
          body: options.body || '',
          icon: options.icon || '',
          tag: options.tag || '',
          url: currentUrl,
          hostname: hostname
        }));

        // Create a mock notification object for the website
        const mockNotification = {
          title: title,
          body: options.body || '',
          icon: options.icon || '',
          tag: options.tag || '',
          onclick: null,
          onclose: null,
          onerror: null,
          onshow: null,
          close: function() {
            // Notify React Native that notification was closed
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'webNotificationClose',
              tag: options.tag || ''
            }));
          },
          addEventListener: function(event, handler) {
            if (event === 'click') {
              this.onclick = handler;
            } else if (event === 'close') {
              this.onclose = handler;
            } else if (event === 'error') {
              this.onerror = handler;
            } else if (event === 'show') {
              this.onshow = handler;
            }
          },
          removeEventListener: function(event, handler) {
            if (event === 'click') {
              this.onclick = null;
            } else if (event === 'close') {
              this.onclose = null;
            } else if (event === 'error') {
              this.onerror = null;
            } else if (event === 'show') {
              this.onshow = null;
            }
          }
        };

        // Store instance if it has a tag
        if (options.tag) {
          notificationInstances.set(options.tag, mockNotification);
        }

        // Trigger show event
        if (mockNotification.onshow) {
          setTimeout(function() {
            mockNotification.onshow();
          }, 0);
        }

        return mockNotification;
      };

      // Copy static properties
      window.Notification.permission = 'default';
      window.Notification.maxActions = 2;

      // Override requestPermission
      window.Notification.requestPermission = function(callback) {
        const currentUrl = window.location.href;
        const hostname = window.location.hostname;
        
        // Send permission request to React Native
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'webNotificationPermission',
          url: currentUrl,
          hostname: hostname
        }));

        // Return a promise that resolves based on permission
        return new Promise(function(resolve) {
          // We'll resolve this when React Native responds
          // For now, assume permission is granted if site is in allowed list
          // The actual permission check happens in React Native
          setTimeout(function() {
            const permission = 'granted'; // Will be checked in React Native
            window.Notification.permission = permission;
            if (callback) {
              callback(permission);
            }
            resolve(permission);
          }, 100);
        });
      };
    })();
    true;
  `;
  const SAFE_SEARCH_HOMEPAGE = 'https://www.safesearchengine.com/';
  const [linkContextMenu, setLinkContextMenu] = useState<{ url: string; text: string } | null>(null);

  const [lockIconMenu, setLockIconMenu] = useState(false);
  const [lockMenuHostname, setLockMenuHostname] = useState('');
  const [showFindInPage, setShowFindInPage] = useState(false);
  const [findSearchText, setFindSearchText] = useState('');
  const [findResultsCount, setFindResultsCount] = useState(0);
  const [findCurrentIndex, setFindCurrentIndex] = useState(0);

  const showLinkContextMenu = useCallback((url: string, text: string) => {
    const options = Platform.OS === 'ios'
      ? ['Open in New Tab', 'Copy Link', 'Cancel']
      : ['Open in New Tab', 'Copy Link'];
    const cancelButtonIndex = Platform.OS === 'ios' ? 2 : undefined;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex, title: text.length > 50 ? text.substring(0, 50) + '...' : text },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            const result = processUrl(url);
            if (!result.blocked) {
              createTab(result.url);
            } else {
              Alert.alert('Content Blocked', result.reason || 'This content is blocked');
            }
          } else if (buttonIndex === 1) {
            Clipboard.setStringAsync(url);
          }
        }
      );
    } else {
      // Show custom modal instead of Alert.alert
      setLinkContextMenu({ url, text });
    }
  }, [createTab]);

  const handleUrlSubmit = useCallback(() => {
    Keyboard.dismiss();
    const input = urlInputValue.trim();
    if (!input) return;

    const targetUrl = getUrlOrSearch(input);

    console.log('[handleUrlSubmit] Input:', input);
    console.log('[handleUrlSubmit] Target URL:', targetUrl);

    // Check if trying to access Google directly from URL bar
    // BUT allow Google auth/OAuth URLs without restriction
    if (isGoogleSearchDomain(targetUrl) && !isGoogleAuthUrl(targetUrl)) {
      console.log('[handleUrlSubmit] ❌ Direct Google access from URL bar - redirecting to SafeSearch');
      previousUrlRef.current = null;
      if (activeTabId) {
        updateTab(activeTabId, {
          url: SAFE_SEARCH_HOMEPAGE,
          sourceUrl: SAFE_SEARCH_HOMEPAGE
        });
        setForceNavCounter(c => c + 1);
      }
      setUrlInputValue(SAFE_SEARCH_HOMEPAGE);
      return;
    }

    // Clear previous URL (no referrer for URL bar input)
    console.log('[handleUrlSubmit] Clearing previousUrlRef for URL bar input');
    previousUrlRef.current = null;

    const result = processUrl(targetUrl);

    if (result.blocked) {
      if (result.redirect) {
        if (activeTabId) {
          updateTab(activeTabId, { url: result.redirect, sourceUrl: result.redirect });
        }
        setUrlInputValue(result.redirect);
      } else {
        Alert.alert('Content Blocked', result.reason || 'This content is blocked');
      }
      return;
    }

    if (activeTabId) {
      updateTab(activeTabId, { url: result.url, sourceUrl: result.url });
    }
    setUrlInputValue(result.url);
  }, [urlInputValue, activeTabId, updateTab]);

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scroll') {
        const currentY = data.y;
        const diff = currentY - lastScrollY.value;

        // Use increased threshold to prevent bounce jitter at bottom of page
        // This prevents the header from flashing during natural scroll bounce behavior
        const scrollThreshold = HIDE_THRESHOLD * 1.5;

        if (diff < -scrollThreshold) {
          headerVisible.value = withTiming(1, { duration: 200 });
          lastScrollY.value = currentY;
        } else if (diff > scrollThreshold) {
          headerVisible.value = withTiming(0, { duration: 200 });
          lastScrollY.value = currentY;
        }
      } else if (data.type === 'ytStopThenReload') {
        // YouTube: deterministic ordered stopLoading -> reload (no arbitrary timeouts)
        ytPendingStopThenReloadRef.current = true;

        // Stop any in-flight navigation; onLoadEnd will then perform the reload.
        try {
          const anyRef: any = webViewRef.current;
          if (anyRef && typeof anyRef.stopLoading === 'function') {
            anyRef.stopLoading();
          }
        } catch { }

        // If nothing is loading, reload immediately.
        if (!isLoadingRef.current) {
          webViewRef.current?.reload();
          ytPendingStopThenReloadRef.current = false;
        }
      } else if (data.type === 'reload') {
        // Back-compat: older injected scripts request reload directly
        webViewRef.current?.reload();
      } else if (data.type === 'longPressLink') {
        showLinkContextMenu(data.url, data.text);
      } else if (data.type === 'findInPageResult') {
        setFindResultsCount(data.count);
        setFindCurrentIndex(0);
      } else if (data.type === 'webNotification') {
        // Website is trying to show a notification
        const activeTab = getActiveTab();
        const url = data.url || activeTab?.url || SAFE_SEARCH_HOMEPAGE;
        showWebsiteNotification(data.title, {
          body: data.body,
          icon: data.icon,
          tag: data.tag,
          url: url,
        });
      } else if (data.type === 'webNotificationPermission') {
        // Website is requesting notification permission
        // Permission is already checked in onPermissionRequest handler
        // This is just for logging
        console.log(`[Notification] Permission request from ${data.hostname}`);
      } else if (data.type === 'permissionBlocked') {
        // A website tried to access a permission API and was blocked by JS
        // This is a backup block, main block is in onPermissionRequest
        console.log(`[Permission] Blocked ${data.permission} for ${data.hostname}`);

        // Only show alert if we haven't shown one recently (debounce)
        // (For simplicity we just show it, but in production we might want to debounce)
        Alert.alert(
          'Permission Blocked',
          `${data.hostname} tried to access ${data.permission}. ` +
          'Enable it in the lock icon menu if needed.',
          [{ text: 'OK' }]
        );
      } else if (data.type === 'permissionGatekeeperBlocked') {
        // Explicit Gatekeeper action (e.g. file input intercepted)
        let permissionDescription = 'Files';
        if (data.fileType === 'images') {
          permissionDescription = 'Photos/Images';
        } else if (data.fileType === 'documents') {
          permissionDescription = 'Documents';
        } else if (data.fileType === 'videos') {
          permissionDescription = 'Videos';
        } else if (data.fileType === 'audio') {
          permissionDescription = 'Audio files';
        } else {
          permissionDescription = 'Files';
        }

        Alert.alert(
          'Access Blocked',
          `This site tried to access your ${permissionDescription}. ` +
          'You must enable this permission in the lock menu first.\n\nTap the lock icon in the address bar to adjust permissions.',
          [
            {
              text: 'OK',
              style: 'cancel'
            },
            {
              text: 'Open Lock Menu',
              onPress: () => {
                // Close the alert and open the lock menu
                setTimeout(() => {
                  handleLockIconPress();
                }, 100);
              }
            }
          ]
        );
      } else if (data.type === 'permissionGatekeeperCheck') {
        // Just a log or pre-check. The actual blocking happens at onPermissionRequest.
        console.log(`[Gatekeeper] Page pre-checked ${data.permission}`);
      } else if (data.type === 'permissionBlockingActive') {
        // Confirmation that permission blocking script is active
        console.log(`[Permission] Blocking active for ${data.hostname}:`, {
          micCamera: data.micCameraAllowed ? 'ALLOWED' : 'BLOCKED',
          gps: data.gpsAllowed ? 'ALLOWED' : 'BLOCKED',
          notifications: data.notificationsAllowed ? 'ALLOWED' : 'BLOCKED'
        });
      } else if (data.type === 'permissionActive') {
        // Permission is actively being used
        setActivePermissions(prev => ({
          ...prev,
          [data.permission]: data.active
        }));
      } else if (data.type === 'pageLoadStart') {
        // Page load started
        console.log(`[Page] Load started for ${data.hostname}`);
      } else if (data.type === 'shortsBlocked') {
        // YouTube shorts navigation was blocked by injected JS
        console.log(`[YouTube] Shorts blocked: ${data.url}`);
        // Optional: show a brief toast/message (the JS already blocks the navigation)
      } else if (data.type === 'blockedGoogleSection') {
        // Google Images/Videos/Shorts section was accessed - redirect to safesearchengine
        console.log(`[Google] Blocked section accessed: ${data.url}`);
        if (activeTabId) {
          updateTab(activeTabId, {
            url: SAFE_SEARCH_HOMEPAGE,
            sourceUrl: SAFE_SEARCH_HOMEPAGE
          });
        }
      } else if (data.type === 'consoleLog') {
        // Forwarded console log from WebView
        const prefix = `[WebView ${data.level.toUpperCase()}]`;
        if (data.level === 'error') {
          console.error(prefix, data.message, data.url ? `(${data.url})` : '');
        } else if (data.level === 'warn') {
          console.warn(prefix, data.message, data.url ? `(${data.url})` : '');
        } else {
          console.log(prefix, data.message, data.url ? `(${data.url})` : '');
        }
      }
    } catch { }
  }, [headerVisible, lastScrollY, showLinkContextMenu, showWebsiteNotification, getActiveTab, activeTabId, updateTab]);

  // Helper to check if a Google URL is authorized (Exact match OR Same Query)
  const checkGoogleUrlAuthorization = useCallback((targetUrl: string) => {
    // 1. Check exact match
    if (authorizedGoogleUrls.current.has(targetUrl)) return true;

    // 2. Check Query Parameter Match (Relaxed Check)
    try {
      const targetObj = new URL(targetUrl);
      const targetQ = targetObj.searchParams.get('q');

      // If no query, we require exact match (which failed above)
      if (!targetQ) return false;

      // Check against all authorized URLs
      for (const authUrl of authorizedGoogleUrls.current) {
        try {
          const authObj = new URL(authUrl);
          const authQ = authObj.searchParams.get('q');
          if (authQ === targetQ) return true;
        } catch { } // Ignore malformed stored URLs
      }
    } catch { } // Ignore malformed target URL

    return false;
  }, []);

  const handleNavigationStateChange = useCallback((navState: any) => {
    if (!activeTabId) return;

    // Check Google access - must come from safesearchengine.com
    // BUT always allow Google auth/OAuth URLs
    if (isGoogleAuthUrl(navState.url)) {
      console.log('[Google Auth Check] NavigationStateChange: ALLOWING auth URL:', navState.url);
    }

    // Get current page URL as referrer (where we're navigating FROM)
    const activeTab = getActiveTab();
    const currentReferrer = activeTab?.url || previousUrlRef.current;

    // CRITICAL: If we're coming FROM a Google Auth URL, allow the NEXT navigation unconditionally
    // This is essential for OAuth flows where accounts.google.com redirects back to the app
    const isFromGoogleAuth = currentReferrer && isGoogleAuthUrl(currentReferrer);

    if (isGoogleSearchDomain(navState.url) && !isGoogleAuthUrl(navState.url) && !isFromGoogleAuth) {

      console.log('[Google Access Check - NavigationStateChange]');
      console.log('  Target URL:', navState.url);
      console.log('  Active Tab URL:', activeTab?.url);
      console.log('  previousUrlRef:', previousUrlRef.current);
      console.log('  Current Referrer:', currentReferrer);

      // If we're already ON Google OR coming from ANY Google domain (including auth), allow all Google navigations
      // This is critical for OAuth flows where accounts.google.com redirects to google.com
      const isFromGoogleDomain = currentReferrer && currentReferrer.includes('google.com');
      const alreadyOnGoogle = currentReferrer && (isGoogleSearchDomain(currentReferrer) || isGoogleAuthUrl(currentReferrer) || isFromGoogleDomain);
      console.log('  Already on Google?', alreadyOnGoogle);

      const isHomepage = isGoogleHomePage(navState.url);
      const isAuthorized = checkGoogleUrlAuthorization(navState.url);

      // 1. BLOCK HOMEPAGE ALWAYS (unless auth flow)
      if (isHomepage) {
        console.log('  ❌ BLOCKING: Google Homepage accessed -> Redirecting to SafeSearch');
        previousUrlRef.current = null;
        updateTab(activeTabId, {
          url: SAFE_SEARCH_HOMEPAGE,
          sourceUrl: SAFE_SEARCH_HOMEPAGE
        });
        setForceNavCounter(c => c + 1);
        return;
      }

      // 2. CHECK FOR BLOCKED GOOGLE SECTIONS - AND STOP IF BLOCKED (No Redirect)
      if (isBlockedGoogleSection(navState.url)) {
        console.log('  ❌ BLOCKING: Restricted Google Section (Images/Videos/Shorts)');
        // Stop loading immediately - do not redirect
        webViewRef.current?.stopLoading();
        return;
      }

      // 3. VERIFY SAFE SEARCH ENFORCEMENT
      // Ensure "safe=active" is present if we are on a search result page
      const enforcedUrl = enforceGoogleSafeSearch(navState.url);
      if (enforcedUrl !== navState.url) {
        console.log('  ⚠️ Enforcing SafeSearch: Redirecting to safe URL');
        // We only redirect if we need to add ?safe=active, which preserves the user's intended destination
        updateTab(activeTabId, { url: enforcedUrl, sourceUrl: enforcedUrl });
        return;
      }

      // 4. CHECK AUTHORIZATION (SafeSearch Referrer OR Already On Google OR Session Memory)
      if (alreadyOnGoogle || isReferrerFromSafeSearch(currentReferrer) || isAuthorized) {
        console.log('  ✓ ALLOWING: Authorized Google Access');
        // Add to authorized list for future "Back" actions
        authorizedGoogleUrls.current.add(navState.url);
      } else {
        // Not from safesearchengine - redirect
        console.log('  ❌ BLOCKING: Referrer is NOT from safesearchengine.com');
        previousUrlRef.current = null;
        updateTab(activeTabId, {
          url: SAFE_SEARCH_HOMEPAGE,
          sourceUrl: SAFE_SEARCH_HOMEPAGE
        });
        setForceNavCounter(c => c + 1); // Force WebView to navigate
        return;
      }
    }

    const result = processUrl(navState.url);

    if (result.blocked) {
      // Handle redirect if specified (e.g., redirect to safesearchengine.com)
      if (result.redirect) {
        updateTab(activeTabId, { url: result.redirect, sourceUrl: result.redirect });
        // Update previousUrl to null when blocking/redirecting
        previousUrlRef.current = null;
      } else {
        webViewRef.current?.goBack();
        Alert.alert('Content Blocked', result.reason || 'This content is blocked');
      }
      return;
    }

    // Update previous URL for next navigation's referrer check (MUST be after all checks)
    console.log('[previousUrlRef Update] Setting to:', navState.url);
    previousUrlRef.current = navState.url;

    updateTab(activeTabId, {
      url: navState.url,
      title: navState.title || 'Untitled',
      canGoBack: navState.canGoBack,
      canGoForward: navState.canGoForward,
    });

    // Update URL input only if not focused and URL actually changed - prevents rapid flickering during navigation
    if (!isUrlFocused && navState.url && navState.url !== urlInputValue) {
      setUrlInputValue(navState.url);
    }

    // Check if we're on a subreddit page
    const isSubredditURL = isSubredditPage(navState.url);
    setIsSubreddit(isSubredditURL);
    if (isSubredditURL) {
      const subName = getSubredditName(navState.url);
      setSubredditName(subName);
      setSubredditSearchValue('');
    }

    if (navState.title && navState.url) {
      addToHistory(navState.url, navState.title);
    }

    // Show header when navigation completes
    headerVisible.value = withTiming(1, { duration: 200 });
    lastScrollY.value = 0;
  }, [activeTabId, getActiveTab, updateTab, addToHistory, isUrlFocused, headerVisible, lastScrollY, urlInputValue]);

  const handleLoadStart = useCallback((_event?: any) => {
    setIsLoading(true);
    isLoadingRef.current = true;
    loadingProgress.value = 0.1;

    // Immediately inject permission blocking script
    if (webViewRef.current && activeTabId) {
      // Get hostname from current URL
      let hostname = 'unknown';
      try {
        const activeTab = getActiveTab();
        const url = activeTab?.url || SAFE_SEARCH_HOMEPAGE;
        hostname = new URL(url).hostname;
      } catch { }

      // Generate script inline to avoid dependency issues
      const normalizedHostname = normalizeHostname(hostname);
      const micCameraAllowed = allowedMicCameraSitesRef.current.has(normalizedHostname);
      const gpsAllowed = allowedGPSSitesRef.current.has(normalizedHostname);
      const notificationsAllowed = allowedNotificationsSitesRef.current.has(normalizedHostname);

      // Use injectJavaScript for immediate execution with simplified blocking
      setTimeout(() => {
        if (webViewRef.current) {
          // Inject Google UI Cleanup (Hide blocked tabs)
          if (isGoogleSearchDomain(activeTab?.url || '')) {
            webViewRef.current.injectJavaScript(getGoogleUiCleanupScript());
          }

          webViewRef.current.injectJavaScript(`
            (function() {
              const hostname = '${hostname}';
              const micCameraAllowed = ${micCameraAllowed};
              const gpsAllowed = ${gpsAllowed};
              
              // Quick blocking for immediate protection
              if (!micCameraAllowed && navigator.mediaDevices) {
                try {
                  navigator.mediaDevices.getUserMedia = function() {
                    return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
                  };
                } catch(e) {}
              }
              
              if (!gpsAllowed && navigator.geolocation) {
                try {
                  navigator.geolocation.getCurrentPosition = function(s, e) {
                    if (e) e({ code: 1, message: 'Permission denied' });
                  };
                } catch(e) {}
              }
            })();
            
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pageLoadStart',
                hostname: '${hostname}'
              }));
            }
          `);
        }
      }, 50);
    }
  }, [loadingProgress, activeTabId, getActiveTab, normalizeHostname]);

  // Function to detect when permissions are actively being used
  const detectPermissionUsage = useCallback((hostname: string) => {
    const script = `
      (function() {
        // Track active streams
        let activeStreams = [];
        
        // Override getUserMedia to track usage
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
          navigator.mediaDevices.getUserMedia = function(constraints) {
            return originalGetUserMedia.call(this, constraints)
              .then(stream => {
                // Check what kind of stream we have
                const hasAudio = stream.getAudioTracks().length > 0;
                const hasVideo = stream.getVideoTracks().length > 0;
                
                // Notify React Native
                if (window.ReactNativeWebView) {
                  if (hasAudio) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'permissionActive',
                      permission: 'microphone',
                      active: true
                    }));
                  }
                  if (hasVideo) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'permissionActive',
                      permission: 'camera',
                      active: true
                    }));
                  }
                }
                
                // Track the stream
                activeStreams.push(stream);
                
                // When stream stops, notify
                stream.getTracks().forEach(track => {
                  track.onended = function() {
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'permissionActive',
                        permission: track.kind === 'audioinput' ? 'microphone' : 'camera',
                        active: false
                      }));
                    }
                  };
                });
                
                return stream;
              })
              .catch(err => {
                throw err;
              });
          };
        }
        
        // Monitor geolocation usage
        if (navigator.geolocation) {
          const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
          const originalWatchPosition = navigator.geolocation.watchPosition;
          
          navigator.geolocation.getCurrentPosition = function(success, error, options) {
            // Notify React Native
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'permissionActive',
                permission: 'geolocation',
                active: true
              }));
            }
            
            // Wrap success callback to detect when location is retrieved
            const wrappedSuccess = function(position) {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'permissionActive',
                  permission: 'geolocation',
                  active: false
                }));
              }
              success(position);
            };
            
            return originalGetCurrentPosition.call(this, wrappedSuccess, error, options);
          };
          
          // Similarly for watchPosition
          navigator.geolocation.watchPosition = function(success, error, options) {
            const watchId = originalWatchPosition.call(this, success, error, options);
            
            // Notify React Native
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'permissionActive',
                permission: 'geolocation',
                active: true
              }));
            }
            
            return watchId;
          };
        }
      })();
    `;

    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(script);
    }
  }, []);

  const handleLoadEnd = useCallback((_event?: any) => {
    setIsLoading(false);
    isLoadingRef.current = false;
    loadingProgress.value = withTiming(1, { duration: 200 }, () => {
      loadingProgress.value = 0;
    });

    // YouTube ordered stop->reload: once the load has ended/stopped, perform the reload.
    if (ytPendingStopThenReloadRef.current) {
      ytPendingStopThenReloadRef.current = false;
      webViewRef.current?.reload();
      return;
    }

    if (pendingCacheClear && webViewRef.current && typeof webViewRef.current.clearCache === 'function') {
      try {
        webViewRef.current.clearCache(true);
        acknowledgeCacheClear();
      } catch {
        acknowledgeCacheClear();
      }
    }

    // Re-inject permission blocking script on every load to ensure permissions are enforced
    // This handles cases where pages might be cached or restored
    if (webViewRef.current && activeTab) {
      let hostname = 'unknown';
      try {
        hostname = new URL(activeTab.url || SAFE_SEARCH_HOMEPAGE).hostname;
      } catch { }

      const normalizedHostname = normalizeHostname(hostname);
      const micCameraAllowed = allowedMicCameraSitesRef.current.has(normalizedHostname);
      const gpsAllowed = allowedGPSSitesRef.current.has(normalizedHostname);
      const storageAllowed = allowedStorageSitesRef.current.has(normalizedHostname);
      const notificationsAllowed = allowedNotificationsSitesRef.current.has(normalizedHostname);
      const imagesAllowed = allowedImagesSitesRef.current.has(normalizedHostname);

      // Check if this is a Google Auth or OAuth callback URL - if so, SKIP injection
      const isAuthUrl = activeTab.url && (isGoogleAuthUrl(activeTab.url) || isOAuthCallbackUrl(activeTab.url));

      // Force re-inject permission blocking if any permission is disabled AND NOT an auth URL
      if (!isAuthUrl && (!micCameraAllowed || !gpsAllowed || !storageAllowed || !notificationsAllowed || !imagesAllowed)) {
        const blockingScript = `
          (function() {
            console.log('[ABrowser] Re-enforcing permission blocks for ${hostname}');
            ${!micCameraAllowed ? `
              if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia = function() {
                  console.log('[ABrowser] BLOCKED: getUserMedia');
                  return Promise.reject(new DOMException('Permission denied by ABrowser', 'NotAllowedError'));
                };
              }
            ` : ''}
            ${!gpsAllowed ? `
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition = function(s, e) {
                  console.log('[ABrowser] BLOCKED: getCurrentPosition');
                  if (e) e({ code: 1, message: 'Permission denied by ABrowser' });
                };
                navigator.geolocation.watchPosition = function(s, e) {
                  console.log('[ABrowser] BLOCKED: watchPosition');
                  if (e) e({ code: 1, message: 'Permission denied by ABrowser' });
                  return -1;
                };
              }
            ` : ''}
          })();
          true;
        `;
        webViewRef.current.injectJavaScript(blockingScript);
      }

      // Always inject permission detection to track active usage
      setTimeout(() => {
        detectPermissionUsage(hostname);
      }, 500);
    }
  }, [loadingProgress, pendingCacheClear, acknowledgeCacheClear, activeTab, normalizeHostname, detectPermissionUsage]);

  const handleLoadProgress = useCallback(({ nativeEvent }: { nativeEvent: { progress: number } }) => {
    loadingProgress.value = nativeEvent.progress;
  }, [loadingProgress]);

  const handleShouldStartLoadWithRequest = useCallback((request: { url: string }) => {
    const { url } = request;

    // Handle special schemes and intents
    const scheme = url.split(':')[0].toLowerCase();
    const specialSchemes = ['intent', 'market', 'tel', 'mailto', 'sms', 'geo', 'whatsapp', 'fb', 'facebook', 'sfbfi'];

    if (specialSchemes.includes(scheme)) {
      Linking.openURL(url).catch(err => {
        console.log('Failed to open URL:', url, err);
      });
      return false;
    }

    if (isApkDownload(url)) {
      Alert.alert('Download Blocked', 'APK downloads are not allowed for security reasons.');
      return false;
    }

    // === GOOGLE ACCESS CHECK ===
    // Google is only allowed if referrer is safesearchengine.com
    // BUT always allow Google auth/OAuth URLs without restriction

    // Get current page URL as referrer (where we're navigating FROM)
    const activeTab = getActiveTab();
    const currentReferrer = activeTab?.url || previousUrlRef.current;

    // CRITICAL: If we're coming FROM a Google Auth URL, allow the NEXT navigation unconditionally
    const isFromGoogleAuth = currentReferrer && isGoogleAuthUrl(currentReferrer);

    if (isGoogleSearchDomain(url) && !isGoogleAuthUrl(url) && !isFromGoogleAuth) {

      console.log('[Google Access Check - ShouldStartLoad]');
      console.log('  Target URL:', url);
      console.log('  Active Tab URL:', activeTab?.url);
      console.log('  previousUrlRef:', previousUrlRef.current);
      console.log('  Current Referrer:', currentReferrer);

      // If we're already ON Google OR coming from ANY Google domain (including auth), allow all Google navigations
      // This is critical for OAuth flows where accounts.google.com redirects to google.com
      const isFromGoogleDomain = currentReferrer && currentReferrer.includes('google.com');
      const alreadyOnGoogle = currentReferrer && (isGoogleSearchDomain(currentReferrer) || isGoogleAuthUrl(currentReferrer) || isFromGoogleDomain);
      console.log('  Already on Google?', alreadyOnGoogle);

      const isHomepage = isGoogleHomePage(url);
      const isAuthorized = checkGoogleUrlAuthorization(url);

      console.log('  isHomepage:', isHomepage);
      console.log('  isAuthorized:', isAuthorized);

      // 1. BLOCK HOMEPAGE ALWAYS (unless auth flow)
      if (isHomepage) {
        console.log('  ❌ BLOCKING: Google Homepage accessed -> Redirecting to SafeSearch');
        if (activeTabId) {
          updateTab(activeTabId, {
            url: SAFE_SEARCH_HOMEPAGE,
            sourceUrl: SAFE_SEARCH_HOMEPAGE
          });
          setForceNavCounter(c => c + 1);
        }
        return false;
      }

      // 2. CHECK AUTHORIZATION (SafeSearch Referrer OR Already On Google OR Session Memory)
      if (alreadyOnGoogle || isReferrerFromSafeSearch(currentReferrer) || isAuthorized) {
        console.log('  ✓ ALLOWING: Authorized Google Access');
        // Add to authorized list for future "Back" actions
        authorizedGoogleUrls.current.add(url);
      } else {
        console.log('  ❌ BLOCKING: Referrer is NOT from safesearchengine.com');
        // Not from safesearchengine - redirect
        if (activeTabId) {
          updateTab(activeTabId, {
            url: SAFE_SEARCH_HOMEPAGE,
            sourceUrl: SAFE_SEARCH_HOMEPAGE
          });
          setForceNavCounter(c => c + 1); // Force WebView to navigate
        }
        return false;
      }
    }

    // Block Google Images/Videos/Shorts sections
    if (isBlockedGoogleSection(url)) {
      console.log('[Google] Blocked section accessed (Navigation blocked):', url);
      // HIDE AND BLOCK strategy: Just return false, do not redirect.
      // This effectively makes the link unclickable if the CSS hiding failed/was delayed.
      return false;
    }

    // === YOUTUBE SHORTS BLOCKING ===
    // Block /shorts/ URLs unless coming from a channel page
    if (isBlockedYouTubeShortsUrl(url, youtubeReferrerRef.current)) {
      Alert.alert(
        'Shorts Blocked',
        'YouTube Shorts are blocked for focused browsing. You can access shorts from channel pages.',
        [{ text: 'OK' }]
      );
      return false;
    }

    // Update referrer for YouTube navigation
    if (isYouTubeUrl(url)) {
      const activeTab = getActiveTab();
      youtubeReferrerRef.current = activeTab?.url || null;
    }

    const result = processUrl(request.url);
    if (result.blocked) {
      // Handle redirect if specified (e.g., redirect to safesearchengine.com)
      if (result.redirect) {
        // Automatically redirect to safesearchengine.com without prompting
        if (activeTabId) {
          updateTab(activeTabId, { url: result.redirect, sourceUrl: result.redirect });
        }
      } else {
        Alert.alert('Content Blocked', result.reason || 'This content is blocked');
      }
      return false;
    }

    // === NAVIGATION-BASED PERMISSION CONTROL ===
    // Block sites where camera/mic is explicitly disabled
    const origin = extractOrigin(url);
    if (origin && origin.startsWith('http')) {
      const permissionStatus = sitePermissionsRef.current[origin];

      if (permissionStatus === false) {
        // // Site is explicitly blocked - prevent navigation
        // Alert.alert(
        //   'Permissions Disabled',
        //   `Camera/Microphone access is disabled for this site. Enable it in the lock icon menu.`,
        //   [
        //     {
        //       text: 'Enable & Reload',
        //       onPress: () => {
        //         const newPerms = { ...sitePermissionsRef.current, [origin]: true };
        //         saveSitePermissions(newPerms);
        //         setTimeout(() => webViewRef.current?.reload(), 100);
        //       }
        //     },
        //     {
        //       text: 'Continue Anyway',
        //       onPress: () => {
        //         // Allow navigation without changing permissions (for sites that don't need camera/mic)
        //         // This is a UX improvement - user can visit the site even if permissions are off
        //       }
        //     },
        //     { text: 'Cancel', style: 'cancel' }
        //   ]
        // );
        // Note: We return true here to allow navigation. The blocking happens at 
        // the permission request level (onPermissionRequest) not navigation level.
        // This is because blocking navigation for camera/mic would block ALL pages
        // on that origin, even pages that don't use camera/mic.
      }
      // For new sites (undefined) and allowed sites (true), allow navigation
    }

    return true;
  }, [extractOrigin, saveSitePermissions, getActiveTab, activeTabId, updateTab]);

  const handleGoBack = useCallback(() => {
    webViewRef.current?.goBack();
  }, []);

  const handleGoForward = useCallback(() => {
    webViewRef.current?.goForward();
  }, []);

  const handleRefresh = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  const handleSubredditSearch = useCallback(() => {
    if (!subredditName || !subredditSearchValue.trim()) return;

    Keyboard.dismiss();
    const searchTerm = subredditSearchValue.trim();
    const searchUrl = `https://reddit.com/r/${subredditName}/search?q=${encodeURIComponent(searchTerm)}&restrict_sr=on&sort=relevance&t=all`;

    if (activeTabId) {
      updateTab(activeTabId, { url: searchUrl, sourceUrl: searchUrl });
    }
    setSubredditSearchValue('');
    setShowSubredditSearchModal(false);
  }, [subredditName, subredditSearchValue, activeTabId, updateTab]);

  const handleToggleBookmark = useCallback(() => {
    if (!activeTab) return;

    if (isBookmarked(activeTab.url)) {
      const bookmark = bookmarks?.find((b) => b.url === activeTab.url);
      if (bookmark) {
        removeBookmark(bookmark.id);
      }
    } else {
      addBookmark(activeTab.url, activeTab.title || 'Untitled');
    }
  }, [activeTab, isBookmarked, addBookmark, removeBookmark, bookmarks]);

  const handleShare = useCallback(async () => {
    if (!activeTab) return;

    try {
      await Share.share({
        url: activeTab.url,
        title: activeTab.title,
        message: Platform.OS === 'android' ? activeTab.url : undefined,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [activeTab]);

  const handleFindInPage = useCallback(() => {
    setShowFindInPage(!showFindInPage);
    if (showFindInPage) {
      setFindSearchText('');
      // Clear the highlight
      const clearHighlight = `
        (function() {
          const spans = document.querySelectorAll('span[data-safesearch-highlight]');
          spans.forEach(span => {
            const parent = span.parentNode;
            while (span.firstChild) {
              parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
          });
        })();
        true;
      `;
      webViewRef.current?.injectJavaScript(clearHighlight);
    }
  }, [showFindInPage]);

  const handleSearchInPage = useCallback((text: string) => {
    setFindSearchText(text);
    setFindCurrentIndex(0);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (!text) {
        setFindResultsCount(0);
        // Clear highlight if search is empty
        const clearHighlight = `
          (function() {
            const spans = document.querySelectorAll('span[data-safesearch-highlight]');
            spans.forEach(span => {
              const parent = span.parentNode;
              while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
              }
              parent.removeChild(span);
            });
          })();
          true;
        `;
        webViewRef.current?.injectJavaScript(clearHighlight);
        return;
      }

      // Escape the text for the script string itself
      const searchScript = `
        (function() {
          try {
            // Clear previous highlights
            const oldSpans = document.querySelectorAll('span[data-safesearch-highlight]');
            oldSpans.forEach(span => {
              const parent = span.parentNode;
              while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
              }
              parent.removeChild(span);
              // Normalize the parent to merge adjacent text nodes
              if (parent) parent.normalize();
            });

            // Also normalize body just in case
            document.body.normalize();

            const rawText = ${JSON.stringify(text)};
            if (!rawText) return;

            // Escape special regex characters
            const escapedText = rawText.replace(/[.*+?^$\{}{|[\\]\\\\]/g, '\\\\$&');
            const regex = new RegExp(escapedText, 'gi');
            
            let count = 0;

            function walkNodes(node) {
              if (node.nodeType === Node.TEXT_NODE) {
                const nodeText = node.textContent;
                if (nodeText && regex.test(nodeText)) {
                  const span = document.createElement('span');
                  // Use replace with a callback to handle complex replacements safely
                  span.innerHTML = nodeText.replace(regex, function(match) {
                    count++;
                    return '<span style="background-color: #FFFF00; color: #000; font-weight: bold; border-radius: 2px; padding: 0 2px;" data-safesearch-highlight="' + (count - 1) + '">' + match + '</span>';
                  });
                  node.parentNode.replaceChild(span, node);
                }
              } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE' && node.nodeName !== 'TEXTAREA' && node.nodeName !== 'INPUT') {
                const childNodes = Array.from(node.childNodes);
                childNodes.forEach(child => walkNodes(child));
              }
            }

            walkNodes(document.body);
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'findInPageResult',
              count: count,
              searchText: rawText
            }));
          } catch (e) {
            console.error('Find in page error:', e);
          }
        })();
        true;
      `;

      webViewRef.current?.injectJavaScript(searchScript);
    }, 500); // 500ms debounce
  }, []);

  const handleFindNext = useCallback(() => {
    if (findResultsCount === 0) return;
    const nextIndex = (findCurrentIndex + 1) % findResultsCount;
    setFindCurrentIndex(nextIndex);

    const scrollScript = `
      (function() {
        const highlights = document.querySelectorAll('span[data-safesearch-highlight]');
        if (highlights.length > 0) {
          const currentIndex = ${nextIndex};
          highlights.forEach((el, i) => {
            if (i === currentIndex) {
              el.style.backgroundColor = '#FF6B6B';
              el.style.color = '#FFF';
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              el.style.backgroundColor = '#FFFF00';
              el.style.color = '#000';
            }
          });
        }
      })();
      true;
    `;

    webViewRef.current?.injectJavaScript(scrollScript);
  }, [findCurrentIndex, findResultsCount]);

  const handleFindPrevious = useCallback(() => {
    if (findResultsCount === 0) return;
    const prevIndex = (findCurrentIndex - 1 + findResultsCount) % findResultsCount;
    setFindCurrentIndex(prevIndex);

    const scrollScript = `
      (function() {
        const highlights = document.querySelectorAll('span[data-safesearch-highlight]');
        if (highlights.length > 0) {
          const currentIndex = ${prevIndex};
          highlights.forEach((el, i) => {
            if (i === currentIndex) {
              el.style.backgroundColor = '#FF6B6B';
              el.style.color = '#FFF';
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              el.style.backgroundColor = '#FFFF00';
              el.style.color = '#000';
            }
          });
        }
      })();
      true;
    `;

    webViewRef.current?.injectJavaScript(scrollScript);
  }, [findCurrentIndex, findResultsCount]);

  const performFullDataClear = useCallback(async () => {
    try {
      // 1. Clear ALL cookies using the native library (more reliable than JavaScript)
      try {
        await CookieManager.clearAll(true);
      } catch (cookieError) {
        console.warn('CookieManager.clearAll failed (likely due to Expo Go limitations):', cookieError);
      }

      // 2. Clear WebView cache
      if (webViewRef.current?.clearCache) {
        webViewRef.current.clearCache(true);
      }

      // 3. Clear session cookies (Android only, but harmless to call on iOS)
      try {
        await CookieManager.removeSessionCookies();
      } catch (cookieError) {
        console.warn('CookieManager.removeSessionCookies failed (likely due to Expo Go limitations):', cookieError);
      }

      // 4. Flush cookies on Android
      if (Platform.OS === 'android') {
        try {
          await CookieManager.flush();
        } catch (cookieError) {
          console.warn('CookieManager.flush failed (likely due to Expo Go limitations):', cookieError);
        }
      }

      // 5. Clear localStorage and sessionStorage via JavaScript injection
      const clearStorageJS = `
      (function() {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch(e) { console.log('Error clearing storage:', e); }
        
        // Clear IndexedDB
        try {
          if (window.indexedDB && window.indexedDB.databases) {
            window.indexedDB.databases().then(function(databases) {
              databases.forEach(function(db) {
                window.indexedDB.deleteDatabase(db.name);
              });
            });
          }
        } catch(e) { console.log('Error clearing IndexedDB:', e); }
        
        // Signal that storage is cleared
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'storageCleared'
        }));
        
        return true;
      })();
    `;

      // Inject and wait a moment before reloading
      webViewRef.current?.injectJavaScript(clearStorageJS);

      // 6. Reload the page AFTER clearing data (keeps same URL)
      setTimeout(() => {
        webViewRef.current?.reload();
      }, 500);

    } catch (error) {
      console.error('Error clearing site data:', error);
    } finally {
      acknowledgeDataClear();
    }
  }, [acknowledgeDataClear]);

  const clearAllCookies = useCallback(async () => {
    try {
      // Show loading state
      setIsLoading(true);

      // 1. Clear ALL cookies using the native library (more reliable than JavaScript)
      try {
        await CookieManager.clearAll(true);
      } catch (cookieError) {
        console.warn('CookieManager.clearAll failed (likely due to Expo Go limitations):', cookieError);
      }

      // 2. Clear WebView cache
      if (webViewRef.current?.clearCache) {
        webViewRef.current.clearCache(true);
      }

      // 3. Clear session cookies (Android only, but harmless to call on iOS)
      try {
        await CookieManager.removeSessionCookies();
      } catch (cookieError) {
        console.warn('CookieManager.removeSessionCookies failed (likely due to Expo Go limitations):', cookieError);
      }

      // 4. Flush cookies on Android
      if (Platform.OS === 'android') {
        try {
          await CookieManager.flush();
        } catch (cookieError) {
          console.warn('CookieManager.flush failed (likely due to Expo Go limitations):', cookieError);
        }
      }

      // 5. Clear localStorage and sessionStorage via JavaScript injection
      const clearStorageJS = `
      (function() {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch(e) { console.log('Error clearing storage:', e); }
        
        // Clear IndexedDB
        try {
          if (window.indexedDB && window.indexedDB.databases) {
            window.indexedDB.databases().then(function(databases) {
              databases.forEach(function(db) {
                window.indexedDB.deleteDatabase(db.name);
              });
            });
          }
        } catch(e) { console.log('Error clearing IndexedDB:', e); }
        
        // Signal that storage is cleared
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'storageCleared'
        }));
        
        return true;
      })();
    `;

      // Inject and wait a moment before reloading
      webViewRef.current?.injectJavaScript(clearStorageJS);

      // 6. Reload the page AFTER clearing data (keeps same URL)
      setTimeout(() => {
        webViewRef.current?.reload();
        setIsLoading(false);

        Alert.alert(
          'Success',
          'Site data has been cleared. You should be logged out of all websites.',
          [{ text: 'OK' }]
        );
      }, 500);

    } catch (error) {
      console.error('Error clearing site data:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to clear site data.');
    }
  }, []);

  const handleLockIconPress = useCallback(() => {
    if (!activeTab) return;

    let hostname = 'Unknown';
    try {
      hostname = new URL(activeTab.url).hostname;
    } catch { }

    const options = Platform.OS === 'ios'
      ? ['Clear Site Data', 'Mic/Camera', 'GPS/Location', 'File Storage', 'Notifications', 'Images', 'Copy URL', 'Cancel']
      : ['Clear Site Data', 'Mic/Camera', 'GPS/Location', 'File Storage', 'Notifications', 'Copy URL'];
    const cancelButtonIndex = Platform.OS === 'ios' ? 7 : undefined;
    const destructiveButtonIndex = 0;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
          title: hostname,
          message: 'Site privacy and data options',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            Alert.alert(
              'Clear All Site Data?',
              'This will log you out of ALL websites by clearing cookies, cache, and local storage. The current page will reload.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear All',
                  style: 'destructive',
                  onPress: clearAllCookies,
                },
              ]
            );
          } else if (buttonIndex === 1) {
            Alert.alert(
              'Microphone & Camera',
              `${allowedMicCameraSites.has(hostname) ? 'Disable' : 'Enable'} mic and camera access for this site?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: allowedMicCameraSites.has(hostname) ? 'Disable' : 'Enable',
                  onPress: () => {
                    const newSites = new Set(allowedMicCameraSites);
                    if (newSites.has(hostname)) {
                      newSites.delete(hostname);
                      removePersistedPermission('mic', hostname);
                    } else {
                      newSites.add(hostname);
                      askToRemember('mic', hostname);
                    }
                    // Update both state and ref immediately
                    setAllowedMicCameraSites(newSites);
                    allowedMicCameraSitesRef.current = newSites;

                    // SYNC: Notify WebView live
                    syncGatekeeperPermissions(hostname);

                    // Prompt reload
                    Alert.alert(
                      'Permissions Changed',
                      'Reload page to apply changes?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reload', onPress: () => reloadWithPermissionDetection(hostname) }
                      ]
                    );
                  },
                },
              ]
            );
          } else if (buttonIndex === 2) {
            Alert.alert(
              'GPS/Location',
              `${allowedGPSSites.has(hostname) ? 'Disable' : 'Enable'} location access for this site?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: allowedGPSSites.has(hostname) ? 'Disable' : 'Enable',
                  onPress: () => {
                    const newSites = new Set(allowedGPSSites);
                    if (newSites.has(hostname)) {
                      newSites.delete(hostname);
                      removePersistedPermission('gps', hostname);
                    } else {
                      newSites.add(hostname);
                      askToRemember('gps', hostname);
                    }
                    // Update both state and ref immediately
                    setAllowedGPSSites(newSites);
                    allowedGPSSitesRef.current = newSites;

                    // SYNC: Notify WebView live
                    syncGatekeeperPermissions(hostname);

                    // Prompt reload
                    Alert.alert(
                      'Permissions Changed',
                      'Reload page to apply changes?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reload', onPress: () => reloadWithPermissionDetection(hostname) }
                      ]
                    );
                  },
                },
              ]
            );
          } else if (buttonIndex === 3) {
            Alert.alert(
              'File Storage',
              `${allowedStorageSites.has(hostname) ? 'Disable' : 'Enable'} file storage access for this site?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: allowedStorageSites.has(hostname) ? 'Disable' : 'Enable',
                  onPress: () => {
                    const newSites = new Set(allowedStorageSites);
                    if (newSites.has(hostname)) {
                      newSites.delete(hostname);
                      removePersistedPermission('storage', hostname);
                    } else {
                      newSites.add(hostname);
                      askToRemember('storage', hostname);
                    }
                    // Update both state and ref immediately
                    setAllowedStorageSites(newSites);
                    allowedStorageSitesRef.current = newSites;

                    // SYNC: Notify WebView live
                    syncGatekeeperPermissions(hostname);

                    // Prompt reload
                    Alert.alert(
                      'Permissions Changed',
                      'Reload page to apply changes?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reload', onPress: () => reloadWithPermissionDetection(hostname) }
                      ]
                    );
                  },
                },
              ]
            );
          } else if (buttonIndex === 4) {
            Alert.alert(
              'Notifications',
              `${allowedNotificationsSites.has(hostname) ? 'Disable' : 'Enable'} notifications for this site?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: allowedNotificationsSites.has(hostname) ? 'Disable' : 'Enable',
                  onPress: () => {
                    const newSites = new Set(allowedNotificationsSites);
                    if (newSites.has(hostname)) {
                      newSites.delete(hostname);
                      removePersistedPermission('notifications', hostname);
                    } else {
                      newSites.add(hostname);
                      askToRemember('notifications', hostname);
                    }
                    // Update both state and ref immediately
                    setAllowedNotificationsSites(newSites);
                    allowedNotificationsSitesRef.current = newSites;

                    // SYNC: Notify WebView live (optional for notifications but good for consistency)
                    syncGatekeeperPermissions(hostname);

                    // Prompt reload
                    Alert.alert(
                      'Permissions Changed',
                      'Reload page to apply changes?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reload', onPress: () => reloadWithPermissionDetection(hostname) }
                      ]
                    );
                  },
                },
              ]
            );
          } else if (buttonIndex === 5) {
            Alert.alert(
              'Images',
              `${allowedImagesSites.has(hostname) ? 'Disable' : 'Enable'} image access for this site?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: allowedImagesSites.has(hostname) ? 'Disable' : 'Enable',
                  onPress: () => {
                    const newSites = new Set(allowedImagesSites);
                    if (newSites.has(hostname)) {
                      newSites.delete(hostname);
                      removePersistedPermission('images', hostname);
                    } else {
                      newSites.add(hostname);
                      askToRemember('images', hostname);
                    }
                    // Update both state and ref immediately
                    setAllowedImagesSites(newSites);
                    allowedImagesSitesRef.current = newSites;

                    // SYNC: Notify WebView live
                    syncGatekeeperPermissions(hostname);

                    // Prompt reload
                    Alert.alert(
                      'Permissions Changed',
                      'Reload page to apply changes?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reload', onPress: () => reloadWithPermissionDetection(hostname) }
                      ]
                    );
                  },
                },
              ]
            );
          } else if (buttonIndex === 6) {
            Clipboard.setStringAsync(activeTab.url);
          }
        }
      );
    } else {
      // Show custom modal on Android
      setLockMenuHostname(hostname);
      setLockIconMenu(true);
    }
  }, [activeTab, allowMicCamera, askToRemember, removePersistedPermission]);

  const handleOpenBookmarks = useCallback(() => {
    navigation.dispatch(DrawerActions.jumpTo('Bookmarks'));
  }, [navigation]);

  const handleOpenDrawer = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const handleOpenTabSwitcher = useCallback(() => {
    navigation.navigate('TabSwitcher');
  }, [navigation]);

  const handleUrlFocus = useCallback(() => {
    setIsUrlFocused(true);
    headerVisible.value = withTiming(1, { duration: 200 });
  }, [headerVisible]);

  const handleUrlBlur = useCallback(() => {
    setIsUrlFocused(false);
    showChrome();
  }, [showChrome]);

  const handleOpenInApp = useCallback(async () => {
    if (!activeTab || !appAvailable) return;
    try {
      // Android 11+ restriction: canOpenURL often returns false even if installed,
      // unless listed in <queries>. It's better to just try opening it.
      // If it fails, the catch block handles it.
      await Linking.openURL(appAvailable.deepLink);
    } catch (error) {
      console.log('Failed to open app deep link directly, trying fallback or alerting:', error);

      Alert.alert(
        'App Not Detected',
        `${appAvailable.name} could not be opened. It might not be installed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Get ${appAvailable.name}`,
            onPress: () => {
              const appName = appAvailable.name.toLowerCase().replace(/ /g, '');
              const storeUrl = Platform.OS === 'ios'
                ? `https://apps.apple.com/app/${appName}`
                : `https://play.google.com/store/search?q=${appAvailable.name}`;
              Linking.openURL(storeUrl).catch(() => { });
            }
          }
        ]
      );
    }
  }, [activeTab, appAvailable]);

  useEffect(() => {
    if (activeTab?.url) {
      const app = getAppSchemeForUrl(activeTab.url);
      console.log('URL:', activeTab.url);
      console.log('App found:', app);
      console.log('Platform.OS:', Platform.OS);
      if (app && Platform.OS !== 'web') {
        // Show the button for known apps regardless of whether they're installed
        // This gives users the option to install the app
        setAppAvailable(app);
      } else {
        setAppAvailable(null);
      }
    }
  }, [activeTab?.url]);

  const currentUrl = activeTab?.url || 'https://safesearchengine.com/';
  const bookmarked = activeTab ? isBookmarked(activeTab.url) : false;
  const isReddit = isRedditUrl(activeTab?.url || '');
  const isYouTube = activeTab?.url?.includes('youtube.com') || activeTab?.url?.includes('youtu.be') || activeTab?.url?.includes('m.youtube.com');

  // Check if current site has permissions
  let currentHostname = 'unknown';
  try {
    currentHostname = new URL(currentUrl).hostname;
  } catch { }
  const isMicCameraAllowed = allowedMicCameraSites.has(currentHostname);
  const isGPSAllowed = allowedGPSSites.has(currentHostname);
  const isStorageAllowed = allowedStorageSites.has(currentHostname);
  const isNotificationsAllowed = allowedNotificationsSites.has(currentHostname);
  const isImagesAllowed = allowedImagesSites.has(currentHostname);

  // Set user agent for specific sites
  const getUserAgent = (): string => {
    // OLD: Android 13 / Chrome 120
    // const defaultUA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

    // NEW: Android 14 / Chrome 130 (Modern, less likely to be flagged)
    const defaultUA = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.102 Mobile Safari/537.36';

    if (currentUrl.includes('chatgpt.com')) {
      // ChatGPT: Use desktop user agent but allow mobile responsiveness
      // This helps with file attachment compatibility
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    } else if (currentUrl.includes('gmail.com') || currentUrl.includes('drive.google.com')) {
      // Google services: Use desktop user agent for better file attachment support
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    } else if (currentUrl.includes('dropbox.com') || currentUrl.includes('onedrive')) {
      // Cloud storage services: Use desktop user agent for better file handling
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    }

    return defaultUA;
  };

  // YouTube pre-load script to set PREF cookie before page loads
  const alwaysRestricted = isYouTubeAlwaysRestrictedEnabled();
  const youtubePreloadJS = `
    (function() {
      console.log('[YT Preload] Setting PREF cookie IMMEDIATELY');
      console.log('[YT Preload] URL:', window.location.href);
      console.log('[YT Preload] Cookies before:', document.cookie);

      // Config: always restricted mode
      var alwaysRestricted = ${alwaysRestricted};
      var isVideoPage = window.location.pathname.includes('/watch');

      var targetPref;
      // If alwaysRestricted=true, always include f2=8000000 (even on video pages)
      // If alwaysRestricted=false, only include f2=8000000 on non-video pages (allows comments)
      var shouldUseRestricted = alwaysRestricted ? true : !isVideoPage;
      
      if (shouldUseRestricted) {
        // Force f2=8000000 (restricted mode)
        targetPref = 'f6=40000000&tz=Asia.Karachi&f5=30000&f7=100&f4=4000000&f2=8000000';
        console.log('[YT Preload] Setting PREF WITH f2=8000000 (restricted mode)');
      } else {
        // No f2=8000000 (comments visible)
        targetPref = 'f6=40000000&tz=Asia.Karachi&f5=30000&f7=100&f4=4000000';
        console.log('[YT Preload] Setting PREF WITHOUT f2=8000000 (comments visible)');
      }

      // Set cookie aggressively with multiple methods
      var cookieValue = "PREF=" + encodeURIComponent(targetPref) + "; path=/; expires=Fri, 31 Dec 9999 23:59:59 GMT; SameSite=Lax";

      // Try all domain variations
      document.cookie = cookieValue + "; domain=.youtube.com";
      document.cookie = cookieValue + "; domain=.m.youtube.com";
      document.cookie = cookieValue + "; domain=youtube.com";
      document.cookie = cookieValue + "; domain=m.youtube.com";
      document.cookie = cookieValue; // no domain

      console.log('[YT Preload] Set PREF to:', targetPref);
      console.log('[YT Preload] Cookies after:', document.cookie);

      // Also try to override any existing PREF in localStorage/sessionStorage
      try {
        localStorage.setItem('PREF', targetPref);
        sessionStorage.setItem('PREF', targetPref);
        console.log('[YT Preload] Also set in storage');
      } catch(e) {
        console.log('[YT Preload] Storage set failed:', e);
      }
    })();
  `;

  // YouTube customization script - now uses comprehensive filter from content-filter.ts
  // Get YouTube filter script with config-based restricted mode setting
  const youtubeFixJS = getYouTubeContentFilterScript(alwaysRestricted);

  const chatGPTFixJS = `
    (function() {
      // Add padding to bottom when keyboard might be open
      const style = document.createElement('style');
      style.textContent = \`
        @media (max-height: 500px) {
          main form {
            padding-bottom: 20px !important;
            margin-bottom: 20px !important;
          }
           /* Force scroll to view */
          .composer-parent {
            padding-bottom: 50px !important;
          }
        }
      \`;
      document.head.appendChild(style);

      // Listen for focus on textareas
      document.addEventListener('focus', function(e) {
        if (e.target.tagName === 'TEXTAREA') {
          setTimeout(function() {
             e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
             window.scrollBy(0, 50); // Small nudge up
          }, 300);
        }
      }, true);
    })();
    true;
  `;

  const isChatGPT = activeTab?.url?.includes('chatgpt.com');

  // State to track active permission usage
  const [activePermissions, setActivePermissions] = useState<{
    microphone: boolean;
    camera: boolean;
    geolocation: boolean;
    storage: boolean;
  }>({
    microphone: false,
    camera: false,
    geolocation: false,
    storage: false,
  });

  // Centralized permission blocking and Gatekeeper script generator
  const getPermissionBlockingScript = useCallback((hostname: string) => {
    const normalizedHostname = normalizeHostname(hostname);
    const micCameraAllowed = allowedMicCameraSitesRef.current.has(normalizedHostname);
    const gpsAllowed = allowedGPSSitesRef.current.has(normalizedHostname);
    const storageAllowed = allowedStorageSitesRef.current.has(normalizedHostname);
    const imagesAllowed = allowedImagesSitesRef.current.has(normalizedHostname);

    return `
    (function() {
      'use strict';

      const hostname = ${JSON.stringify(hostname)};

      // Gatekeeper State - This will be updated by messages from React Native
      window.__gatekeeperPermissions = {
        micCamera: ${micCameraAllowed},
        gps: ${gpsAllowed},
        storage: ${storageAllowed},
        images: ${imagesAllowed}
      };

      // Listen for permission updates from React Native
      window.addEventListener('message', function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'updatePermissions') {
            window.__gatekeeperPermissions = data.permissions;
            console.log('[Gatekeeper] Permissions updated:', window.__gatekeeperPermissions);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // ========== 1. MEDIA (Mic/Camera) GATEKEEPER ==========
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
         const originalGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
         navigator.mediaDevices.getUserMedia = function(constraints) {
           // Check current permission state (not the cached one)
           if (!window.__gatekeeperPermissions.micCamera) {
             window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'permissionGatekeeperBlocked',
               permission: 'micCamera',
               hostname: hostname
             }));
             console.log('[Gatekeeper] Blocked media access: micCamera');
             return Promise.reject(new DOMException('Permission denied by user', 'NotAllowedError'));
           } else {
             const hasVideo = constraints && (constraints.video === true || (typeof constraints.video === 'object'));
             const hasAudio = constraints && (constraints.audio === true || (typeof constraints.audio === 'object'));

             if (hasVideo) {
               window.ReactNativeWebView.postMessage(JSON.stringify({
                 type: 'permissionActive',
                 permission: 'camera',
                 active: true
               }));
             }
             if (hasAudio) {
               window.ReactNativeWebView.postMessage(JSON.stringify({
                 type: 'permissionActive',
                 permission: 'microphone',
                 active: true
               }));
             }

             return originalGUM(constraints).then(function(stream) {
               stream.getTracks().forEach(function(track) {
                 track.addEventListener('ended', function() {
                   if (track.kind === 'video') {
                     window.ReactNativeWebView.postMessage(JSON.stringify({
                       type: 'permissionActive',
                       permission: 'camera',
                       active: false
                     }));
                   } else if (track.kind === 'audio') {
                     window.ReactNativeWebView.postMessage(JSON.stringify({
                       type: 'permissionActive',
                       permission: 'microphone',
                       active: false
                     }));
                   }
                 });
               });
               return stream;
             }).catch(function(err) {
               // Hide indicators on error
               if (hasVideo) {
                 window.ReactNativeWebView.postMessage(JSON.stringify({
                   type: 'permissionActive',
                   permission: 'camera',
                   active: false
                 }));
               }
               if (hasAudio) {
                 window.ReactNativeWebView.postMessage(JSON.stringify({
                   type: 'permissionActive',
                   permission: 'microphone',
                   active: false
                 }));
               }
               throw err;
             });
           }
         };
      }

      // ========== 1B. WEB SPEECH API GATEKEEPER (for Google voice search) ==========
      if (window.webkitSpeechRecognition) {
        const OriginalSpeechRecognition = window.webkitSpeechRecognition;
        window.webkitSpeechRecognition = function() {
          const instance = new OriginalSpeechRecognition();
          const originalStart = instance.start.bind(instance);

          instance.start = function() {
            if (!window.__gatekeeperPermissions.micCamera) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'permissionGatekeeperBlocked',
                permission: 'micCamera',
                hostname: hostname
              }));
              console.log('[Gatekeeper] Blocked speech recognition');

              // Trigger error event
              const errorEvent = new Event('error');
              errorEvent.error = 'not-allowed';
              errorEvent.message = 'Permission denied by user';
              setTimeout(function() {
                if (instance.onerror) {
                  instance.onerror(errorEvent);
                }
              }, 0);
              return;
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'permissionActive',
                permission: 'microphone',
                active: true
              }));

              // Hide indicator when recognition ends
              const originalOnEnd = instance.onend;
              instance.onend = function(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'permissionActive',
                  permission: 'microphone',
                  active: false
                }));
                if (originalOnEnd) originalOnEnd.call(this, e);
              };

              const originalOnError = instance.onerror;
              instance.onerror = function(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'permissionActive',
                  permission: 'microphone',
                  active: false
                }));
                if (originalOnError) originalOnError.call(this, e);
              };

              return originalStart();
            }
          };

          return instance;
        };
      }

      // Also handle standard SpeechRecognition API
      if (window.SpeechRecognition && !window.webkitSpeechRecognition) {
        const OriginalSpeechRecognition = window.SpeechRecognition;
        window.SpeechRecognition = function() {
          const instance = new OriginalSpeechRecognition();
          const originalStart = instance.start.bind(instance);

          instance.start = function() {
            if (!window.__gatekeeperPermissions.micCamera) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'permissionGatekeeperBlocked',
                permission: 'micCamera',
                hostname: hostname
              }));
              console.log('[Gatekeeper] Blocked speech recognition');

              const errorEvent = new Event('error');
              errorEvent.error = 'not-allowed';
              errorEvent.message = 'Permission denied by user';
              setTimeout(function() {
                if (instance.onerror) {
                  instance.onerror(errorEvent);
                }
              }, 0);
              return;
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'permissionActive',
                permission: 'microphone',
                active: true
              }));

              const originalOnEnd = instance.onend;
              instance.onend = function(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'permissionActive',
                  permission: 'microphone',
                  active: false
                }));
                if (originalOnEnd) originalOnEnd.call(this, e);
              };

              const originalOnError = instance.onerror;
              instance.onerror = function(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'permissionActive',
                  permission: 'microphone',
                  active: false
                }));
                if (originalOnError) originalOnError.call(this, e);
              };

              return originalStart();
            }
          };

          return instance;
        };
      }

      // ========== 2. GEOLOCATION GATEKEEPER ==========
      if (navigator.geolocation) {
         const originalGCP = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
         const originalWP = navigator.geolocation.watchPosition.bind(navigator.geolocation);

         navigator.geolocation.getCurrentPosition = function(success, error, options) {
           if (!window.__gatekeeperPermissions.gps) {
             window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'permissionGatekeeperBlocked',
               permission: 'geolocation',
               hostname: hostname
             }));
             console.log('[Gatekeeper] Blocked geolocation access');
             if (error) {
               error({
                 code: 1,
                 message: 'Permission denied by user',
                 PERMISSION_DENIED: 1,
                 POSITION_UNAVAILABLE: 2,
                 TIMEOUT: 3
               });
             }
             return;
           } else {
             window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'permissionActive',
               permission: 'geolocation',
               active: true
             }));
             return originalGCP(
               function(position) {
                 window.ReactNativeWebView.postMessage(JSON.stringify({
                   type: 'permissionActive',
                   permission: 'geolocation',
                   active: false
                 }));
                 success(position);
               },
               function(err) {
                 window.ReactNativeWebView.postMessage(JSON.stringify({
                   type: 'permissionActive',
                   permission: 'geolocation',
                   active: false
                 }));
                 if (error) error(err);
               },
               options
             );
           }
         };

         navigator.geolocation.watchPosition = function(success, error, options) {
           if (!window.__gatekeeperPermissions.gps) {
             window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'permissionGatekeeperBlocked',
               permission: 'geolocation',
               hostname: hostname
             }));
             console.log('[Gatekeeper] Blocked geolocation watch');
             if (error) {
               error({
                 code: 1,
                 message: 'Permission denied by user',
                 PERMISSION_DENIED: 1,
                 POSITION_UNAVAILABLE: 2,
                 TIMEOUT: 3
               });
             }
             return -1;
           } else {
             window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'permissionActive',
               permission: 'geolocation',
               active: true
             }));
             return originalWP(
               function(position) {
                 success(position);
               },
               function(err) {
                 if (error) error(err);
               },
               options
             );
           }
         };
      }

      // ========== 3. FILE STORAGE / IMAGES GATEKEEPER ==========
      function enforceFileGatekeeper(event) {
        const target = event.target;
        if (target && target.tagName === 'INPUT' && target.type === 'file') {
           const accept = (target.accept || '').toLowerCase();
           const isImage = accept.includes('image') || accept.includes('.png') || accept.includes('.jpg') || accept.includes('.jpeg') || accept.includes('.gif') || accept.includes('.webp');
           const isDocument = accept.includes('pdf') || accept.includes('.pdf') || accept.includes('document') || accept.includes('.doc') || accept.includes('.docx') || accept.includes('.txt') || accept.includes('.xls') || accept.includes('.xlsx');
           const isVideo = accept.includes('video') || accept.includes('.mp4') || accept.includes('.mov') || accept.includes('.avi') || accept.includes('.mkv');
           const isAudio = accept.includes('audio') || accept.includes('.mp3') || accept.includes('.wav') || accept.includes('.ogg');

           // Determine the most specific file type
           let fileType = 'files';
           let allowed = false;
           let permissionName = '';

           if (isImage && !isVideo && !isAudio) {
             fileType = 'images';
             allowed = window.__gatekeeperPermissions.images;
             permissionName = 'images';
           } else {
             allowed = window.__gatekeeperPermissions.storage;
             permissionName = 'storage';
           }

           if (!allowed) {
             event.preventDefault();
             event.stopImmediatePropagation();
             window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'permissionGatekeeperBlocked',
               permission: permissionName,
               hostname: hostname,
               fileType: fileType
             }));
             console.log('[Gatekeeper] Blocked file input access for ' + fileType + ': ' + permissionName);
             return false;
           } else {
             window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'permissionActive',
               permission: 'storage',
               active: true
             }));
             setTimeout(function() {
               window.ReactNativeWebView.postMessage(JSON.stringify({
                 type: 'permissionActive',
                 permission: 'storage',
                 active: false
               }));
             }, 3000);
           }
        }
      }

      const attachListener = () => {
           document.body.removeEventListener('click', enforceFileGatekeeper, true);
           document.body.addEventListener('click', enforceFileGatekeeper, true);
      };

      if (document.body) attachListener();
      else document.addEventListener('DOMContentLoaded', attachListener);

      window.addEventListener('focus', attachListener);

    })();
  `;
  }, [normalizeHostname]);

  // Helper: Send current permission state to WebView Gatekeeper
  const syncGatekeeperPermissions = useCallback((hostname: string) => {
    const normalizedHostname = normalizeHostname(hostname);
    const micCameraAllowed = allowedMicCameraSitesRef.current.has(normalizedHostname);
    const gpsAllowed = allowedGPSSitesRef.current.has(normalizedHostname);
    const storageAllowed = allowedStorageSitesRef.current.has(normalizedHostname);
    const imagesAllowed = allowedImagesSitesRef.current.has(normalizedHostname);

    const permissions = {
      micCamera: micCameraAllowed,
      gps: gpsAllowed,
      storage: storageAllowed,
      images: imagesAllowed
    };

    console.log('[Gatekeeper] Syncing permissions to WebView:', permissions);

    webViewRef.current?.injectJavaScript(`
      if (window.__gatekeeperPermissions) {
        window.__gatekeeperPermissions = ${JSON.stringify(permissions)};
        console.log('[Gatekeeper] Permissions updated live via syncGatekeeperPermissions');
      }
      true;
    `);
  }, [normalizeHostname]);

  // Helper function to reload page and inject permission detection
  const reloadWithPermissionDetection = useCallback((hostname: string) => {
    webViewRef.current?.reload();
    // After reload, inject usage detection
    setTimeout(() => {
      detectPermissionUsage(hostname);
    }, 1000);
  }, [detectPermissionUsage]);

  // Check if current site is whitelisted for media or is a Google auth page
  const isGoogleAuth = activeTab?.url ? isGoogleAuthUrl(activeTab.url) : false;
  const isCurrentSiteMediaWhitelisted = activeTab?.url ? (isGoogleAuth || isMediaWhitelisted(activeTab.url)) : false;
  const mediaFilterJS = getMediaFilterScript(isCurrentSiteMediaWhitelisted);
  const mediaFilterPreloadJS = getMediaFilterPreloadScript(isCurrentSiteMediaWhitelisted);

  // Always include notification interception and permission blocking for all sites
  // BUT skip ALL injections for Google auth pages (they need to work without interference)
  const injectedJS = isGoogleAuth ? scrollTrackingJS : (
    (isReddit
      ? scrollTrackingJS + REDDIT_NSFW_FILTER_JS
      : isChatGPT
        ? scrollTrackingJS + chatGPTFixJS
        : scrollTrackingJS) + notificationInterceptionJS + getPermissionBlockingScript(currentHostname) + mediaFilterJS
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <ThemedView style={styles.container}>
        <Animated.View
          style={[
            styles.header,
            {
              paddingTop: insets.top,
              backgroundColor: theme.backgroundRoot,
            },
            headerAnimatedStyle,
          ]}
        >
          <Pressable
            onPress={handleOpenDrawer}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Feather name="menu" size={20} color={theme.text} />
          </Pressable>

          <View
            style={[
              styles.urlBarContainer,
              {
                backgroundColor: theme.surface,
                borderColor: isUrlFocused ? theme.primary : theme.border,
              },
            ]}
          >
            <Pressable
              onPress={isLoading ? undefined : handleLockIconPress}
              style={({ pressed }) => [
                styles.lockIconButton,
                !isLoading && pressed && styles.buttonPressed,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="lock" size={14} color={theme.textSecondary} />

                  {/* Permission Usage Indicators - show when active */}
                  {(activePermissions.microphone || activePermissions.camera || activePermissions.geolocation || activePermissions.storage) && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 2,
                      backgroundColor: 'rgba(255, 59, 48, 0.15)',
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      borderRadius: 8,
                    }}>
                      {activePermissions.camera && (
                        <Feather name="camera" size={10} color="#FF3B30" />
                      )}
                      {activePermissions.microphone && (
                        <Feather name="mic" size={10} color="#FF3B30" />
                      )}
                      {activePermissions.geolocation && (
                        <Feather name="map-pin" size={10} color="#FF3B30" />
                      )}
                      {activePermissions.storage && (
                        <Feather name="folder" size={10} color="#FF3B30" />
                      )}
                    </View>
                  )}
                </View>
              )}
            </Pressable>
            <TextInput
              value={urlInputValue}
              onChangeText={setUrlInputValue}
              onSubmitEditing={handleUrlSubmit}
              onFocus={handleUrlFocus}
              onBlur={handleUrlBlur}
              placeholder="Search or enter URL"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
              style={[
                styles.urlInput,
                { color: theme.text },
              ]}
            />
          </View>

          {appAvailable && !referringApp ? (
            <Pressable
              onPress={handleOpenInApp}
              style={({ pressed }) => [
                styles.openAppButton,
                { backgroundColor: theme.primary },
                pressed && styles.buttonPressed,
              ]}
            >
              <Feather name="external-link" size={14} color="#FFFFFF" />
            </Pressable>
          ) : null}

          {isSubreddit && (
            <Pressable
              onPress={() => setShowSubredditSearchModal(true)}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Feather name="search" size={20} color={theme.text} />
            </Pressable>
          )}

          <Pressable
            onPress={handleOpenTabSwitcher}
            style={({ pressed }) => [
              styles.tabCountButton,
              { borderColor: theme.text },
              pressed && styles.buttonPressed,
            ]}
          >
            <ThemedText style={styles.tabCountText}>
              {tabs.length}
            </ThemedText>
          </Pressable>
        </Animated.View>

        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              { backgroundColor: theme.primary },
              progressBarStyle,
            ]}
          />
        </View>

        {showFindInPage && (
          <ThemedView
            style={[
              styles.findInPageContainer,
              { borderBottomColor: theme.border, shadowColor: theme.text },
            ]}
          >
            <View style={[styles.findInPageInputContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="search" size={16} color={theme.textSecondary} style={{ marginLeft: Spacing.sm }} />
              <TextInput
                style={[
                  styles.findInPageInput,
                  { color: theme.text },
                ]}
                placeholder="Find in page..."
                placeholderTextColor={theme.textSecondary}
                value={findSearchText}
                onChangeText={handleSearchInPage}
                autoFocus
                returnKeyType="search"
                autoCapitalize="none"
              />
              {findResultsCount > 0 ? (
                <ThemedText style={styles.findInPageCounter}>
                  {findCurrentIndex + 1}/{findResultsCount}
                </ThemedText>
              ) : findSearchText.length > 0 ? (
                <ThemedText style={[styles.findInPageCounter, { color: theme.error }]}>
                  0/0
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.findInPageControls}>
              <Pressable
                onPress={handleFindPrevious}
                hitSlop={8}
                disabled={findResultsCount === 0}
                style={({ pressed }) => [
                  styles.findInPageNavButton,
                  pressed && styles.buttonPressed,
                  findResultsCount === 0 && styles.buttonDisabled,
                ]}
              >
                <Feather
                  name="chevron-up"
                  size={24}
                  color={findResultsCount > 0 ? theme.text : theme.textSecondary}
                />
              </Pressable>

              <Pressable
                onPress={handleFindNext}
                hitSlop={8}
                disabled={findResultsCount === 0}
                style={({ pressed }) => [
                  styles.findInPageNavButton,
                  pressed && styles.buttonPressed,
                  findResultsCount === 0 && styles.buttonDisabled,
                ]}
              >
                <Feather
                  name="chevron-down"
                  size={24}
                  color={findResultsCount > 0 ? theme.text : theme.textSecondary}
                />
              </Pressable>

              <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

              <Pressable
                onPress={() => setShowFindInPage(false)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.findInPageCloseButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
          </ThemedView>
        )}

        {referringApp && appAvailable && (
          <View style={[
            styles.referringAppBannerContainer,
            { backgroundColor: theme.primary + '20', borderBottomColor: theme.primary }
          ]}>
            <View style={styles.referringAppBannerContent}>
              <Feather name="link-2" size={14} color={theme.primary} />
              <ThemedText style={{ fontSize: 12, color: theme.text }}>
                Opened from {referringApp}
              </ThemedText>
            </View>
            <Pressable
              onPress={handleOpenInApp}
              style={({ pressed }) => [
                styles.referringAppActionButton,
                { backgroundColor: theme.primary },
                pressed && styles.buttonPressed,
              ]}
            >
              <ThemedText style={{ fontSize: 11, fontWeight: '600', color: theme.surface }}>
                {appAvailable.name}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {referringApp && !appAvailable && (
          <Pressable
            onPress={clearReferringApp}
            style={[
              styles.referringAppBanner,
              { backgroundColor: theme.primary + '20', borderBottomColor: theme.primary },
            ]}
          >
            <Feather name="link-2" size={14} color={theme.primary} style={{ marginRight: 8 }} />
            <ThemedText style={{ fontSize: 12, color: theme.primary }}>
              Opened from {referringApp}
            </ThemedText>
          </Pressable>
        )}

        {isSubreddit && showSubredditSearchModal && (
          <Pressable
            style={styles.subredditSearchOverlay}
            onPress={() => {
              setShowSubredditSearchModal(false);
              Keyboard.dismiss();
            }}
          >
            <View style={[styles.subredditSearchModal, { backgroundColor: theme.surface }]}>
              <View style={styles.subredditSearchHeader}>
                <ThemedText style={styles.subredditSearchTitle}>Search /r/{subredditName}</ThemedText>
                <Pressable
                  onPress={() => {
                    setShowSubredditSearchModal(false);
                    Keyboard.dismiss();
                  }}
                  style={({ pressed }) => [styles.subredditSearchClose, pressed && styles.buttonPressed]}
                >
                  <Feather name="x" size={20} color={theme.text} />
                </Pressable>
              </View>

              <View style={styles.subredditSearchInputContainer}>
                <TextInput
                  value={subredditSearchValue}
                  onChangeText={setSubredditSearchValue}
                  onSubmitEditing={handleSubredditSearch}
                  placeholder={`Search posts in /r/${subredditName}`}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  autoFocus
                  style={[
                    styles.subredditSearchModalInput,
                    { color: theme.text, borderColor: theme.border },
                  ]}
                />
              </View>

              <Pressable
                onPress={handleSubredditSearch}
                disabled={!subredditSearchValue.trim()}
                style={({ pressed }) => [
                  styles.subredditSearchSubmitButton,
                  { backgroundColor: subredditSearchValue.trim() ? theme.primary : theme.textSecondary },
                  pressed && subredditSearchValue.trim() && styles.buttonPressed,
                ]}
              >
                <ThemedText style={styles.subredditSearchSubmitText}>Search</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        )}

        {linkContextMenu && Platform.OS !== 'ios' && (
          <Pressable
            style={styles.linkContextMenuOverlay}
            onPress={() => setLinkContextMenu(null)}
          >
            <View style={[styles.linkContextMenuBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText style={[styles.linkContextMenuTitle, { color: theme.textSecondary }]}>
                {linkContextMenu.text.length > 50 ? linkContextMenu.text.substring(0, 50) + '...' : linkContextMenu.text}
              </ThemedText>

              <Pressable
                onPress={() => {
                  setLinkContextMenu(null);
                  const result = processUrl(linkContextMenu.url);
                  if (!result.blocked) {
                    createTab(result.url);
                  } else {
                    Alert.alert('Content Blocked', result.reason || 'This content is blocked');
                  }
                }}
                style={({ pressed }) => [
                  styles.linkContextMenuButton,
                  { borderBottomColor: theme.border },
                  pressed && styles.linkContextMenuButtonPressed,
                ]}
              >
                <ThemedText style={styles.linkContextMenuButtonText}>Open in New Tab</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => {
                  setLinkContextMenu(null);
                  Clipboard.setStringAsync(linkContextMenu.url);
                }}
                style={({ pressed }) => [
                  styles.linkContextMenuButton,
                  pressed && styles.linkContextMenuButtonPressed,
                ]}
              >
                <ThemedText style={styles.linkContextMenuButtonText}>Copy Link</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        )}

        {lockIconMenu && Platform.OS !== 'ios' && activeTab && (
          <Pressable
            style={styles.lockIconMenuOverlay}
            onPress={() => setLockIconMenu(false)}
          >
            <View style={[styles.lockIconMenuBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText style={[styles.lockIconMenuTitle, { color: theme.textSecondary }]}>
                {lockMenuHostname}
              </ThemedText>

              <Pressable
                onPress={() => {
                  setLockIconMenu(false);
                  Alert.alert(
                    'Clear Site Data?',
                    'This will clear cookies and cache for all sites. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Clear',
                        style: 'destructive',
                        onPress: clearAllCookies,
                      },
                    ]
                  );
                }}
                style={({ pressed }) => [
                  styles.lockIconMenuButton,
                  { borderBottomColor: theme.border },
                  pressed && styles.lockIconMenuButtonPressed,
                ]}
              >
                <ThemedText style={[styles.lockIconMenuButtonText, { color: '#d32f2f' }]}>Clear Site Data</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => {
                  setLockIconMenu(false);

                  // Use origin-based permission check
                  const origin = extractOrigin(activeTab.url);
                  if (!origin) return;

                  const isEnabled = sitePermissionsRef.current[origin] === true;
                  const hasSystemPerms = systemPermissionsGranted.camera && systemPermissionsGranted.microphone;

                  let message = `${isEnabled ? 'Disable' : 'Enable'} camera and microphone access for this site?`;
                  if (!isEnabled && !hasSystemPerms) {
                    message += '\n\nNote: System permissions for camera/microphone are not granted. Please enable them in device settings first.';
                  }

                  Alert.alert(
                    'Camera/Microphone',
                    message,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: isEnabled ? 'Disable' : 'Enable',
                        onPress: () => {
                          const newPerms = { ...sitePermissionsRef.current, [origin]: !isEnabled };
                          saveSitePermissions(newPerms);

                          // UNIFY: Also update the hostname-based Set for the Gatekeeper
                          const newMicSites = new Set(allowedMicCameraSitesRef.current);
                          if (!isEnabled) {
                            newMicSites.add(lockMenuHostname);
                          } else {
                            newMicSites.delete(lockMenuHostname);
                          }
                          setAllowedMicCameraSites(newMicSites);
                          allowedMicCameraSitesRef.current = newMicSites;

                          setLockIconMenu(false);

                          // SYNC: Notify WebView live
                          syncGatekeeperPermissions(lockMenuHostname);

                          // Prompt reload
                          setTimeout(() => {
                            Alert.alert(
                              'Permissions Changed',
                              'Reload page to apply changes?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Reload', onPress: () => webViewRef.current?.reload() }
                              ]
                            );
                          }, 200);
                        },
                      },
                    ]
                  );
                }}
                style={({ pressed }) => [
                  styles.lockIconMenuButton,
                  { borderBottomColor: theme.border },
                  pressed && styles.lockIconMenuButtonPressed,
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <ThemedText style={styles.lockIconMenuButtonText}>Camera/Mic</ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {activePermissions.microphone && (
                      <Feather name="mic" size={12} color="#4CAF50" />
                    )}
                    {activePermissions.camera && (
                      <Feather name="camera" size={12} color="#4CAF50" />
                    )}
                    <ThemedText style={[styles.lockIconMenuButtonText, { color: (extractOrigin(activeTab.url) && sitePermissions[extractOrigin(activeTab.url)!]) ? theme.primary : theme.textSecondary }]}>
                      {(extractOrigin(activeTab.url) && sitePermissions[extractOrigin(activeTab.url)!]) ? 'ON' : 'OFF'}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setLockIconMenu(false);
                  const isEnabled = allowedGPSSites.has(lockMenuHostname);
                  const hasSystemPerms = systemPermissionsGranted.gps;

                  let message = `${isEnabled ? 'Disable' : 'Enable'} location access for this site?`;
                  if (!isEnabled && !hasSystemPerms) {
                    message += '\n\nNote: System permissions for location are not granted. Please enable them in device settings for this feature to work.';
                  }

                  Alert.alert(
                    'GPS/Location',
                    message,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: isEnabled ? 'Disable' : 'Enable',
                        onPress: () => {
                          const newSites = new Set(allowedGPSSites);
                          if (newSites.has(lockMenuHostname)) {
                            newSites.delete(lockMenuHostname);
                            removePersistedPermission('gps', lockMenuHostname);
                          } else {
                            newSites.add(lockMenuHostname);
                            askToRemember('gps', lockMenuHostname);
                          }
                          // Update both state and ref immediately
                          setAllowedGPSSites(newSites);
                          allowedGPSSitesRef.current = newSites;

                          setLockIconMenu(false);

                          // SYNC: Notify WebView live
                          syncGatekeeperPermissions(lockMenuHostname);

                          // Prompt reload
                          setTimeout(() => {
                            Alert.alert(
                              'Permissions Changed',
                              'Reload page to apply changes?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Reload', onPress: () => reloadWithPermissionDetection(lockMenuHostname) }
                              ]
                            );
                          }, 200);
                        },
                      },
                    ]
                  );
                }}
                style={({ pressed }) => [
                  styles.lockIconMenuButton,
                  { borderBottomColor: theme.border },
                  pressed && styles.lockIconMenuButtonPressed,
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <ThemedText style={styles.lockIconMenuButtonText}>GPS/Location</ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {activePermissions.geolocation && (
                      <Feather name="map-pin" size={12} color="#4CAF50" />
                    )}
                    <ThemedText style={[styles.lockIconMenuButtonText, { color: allowedGPSSites.has(lockMenuHostname) ? theme.primary : theme.textSecondary }]}>
                      {allowedGPSSites.has(lockMenuHostname) ? 'ON' : 'OFF'}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setLockIconMenu(false);
                  const isEnabled = allowedStorageSites.has(lockMenuHostname);
                  const hasSystemPerms = systemPermissionsGranted.storage;

                  let message = `${isEnabled ? 'Disable' : 'Enable'} file storage access for this site?`;
                  if (!isEnabled && !hasSystemPerms) {
                    message += '\n\nNote: System permissions for storage are not granted. Please enable them in device settings for this feature to work.';
                  }

                  Alert.alert(
                    'File Storage',
                    message,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: isEnabled ? 'Disable' : 'Enable',
                        onPress: () => {
                          const newSites = new Set(allowedStorageSites);
                          if (newSites.has(lockMenuHostname)) {
                            newSites.delete(lockMenuHostname);
                            removePersistedPermission('storage', lockMenuHostname);
                          } else {
                            newSites.add(lockMenuHostname);
                            askToRemember('storage', lockMenuHostname);
                          }
                          // Update both state and ref immediately
                          setAllowedStorageSites(newSites);
                          allowedStorageSitesRef.current = newSites;

                          setLockIconMenu(false);

                          // SYNC: Notify WebView live
                          syncGatekeeperPermissions(lockMenuHostname);

                          // Prompt reload
                          setTimeout(() => {
                            Alert.alert(
                              'Permissions Changed',
                              'Reload page to apply changes?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Reload', onPress: () => reloadWithPermissionDetection(lockMenuHostname) }
                              ]
                            );
                          }, 200);
                        },
                      },
                    ]
                  );
                }}
                style={({ pressed }) => [
                  styles.lockIconMenuButton,
                  { borderBottomColor: theme.border },
                  pressed && styles.lockIconMenuButtonPressed,
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <ThemedText style={styles.lockIconMenuButtonText}>File Storage</ThemedText>
                  <ThemedText style={[styles.lockIconMenuButtonText, { color: allowedStorageSites.has(lockMenuHostname) ? theme.primary : theme.textSecondary }]}>
                    {allowedStorageSites.has(lockMenuHostname) ? 'ON' : 'OFF'}
                  </ThemedText>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setLockIconMenu(false);
                  const isEnabled = allowedNotificationsSites.has(lockMenuHostname);

                  Alert.alert(
                    'Notifications',
                    `${isEnabled ? 'Disable' : 'Enable'} notifications for this site?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: isEnabled ? 'Disable' : 'Enable',
                        onPress: () => {
                          const newSites = new Set(allowedNotificationsSites);
                          if (newSites.has(lockMenuHostname)) {
                            newSites.delete(lockMenuHostname);
                            removePersistedPermission('notifications', lockMenuHostname);
                          } else {
                            newSites.add(lockMenuHostname);
                            askToRemember('notifications', lockMenuHostname);
                          }
                          // Update both state and ref immediately
                          setAllowedNotificationsSites(newSites);
                          allowedNotificationsSitesRef.current = newSites;

                          setLockIconMenu(false);

                          // SYNC: Notify WebView live (optional for notifications but good for consistency)
                          syncGatekeeperPermissions(lockMenuHostname);

                          // Prompt reload
                          setTimeout(() => {
                            Alert.alert(
                              'Permissions Changed',
                              'Reload page to apply changes?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Reload', onPress: () => reloadWithPermissionDetection(lockMenuHostname) }
                              ]
                            );
                          }, 200);
                        },
                      },
                    ]
                  );
                }}
                style={({ pressed }) => [
                  styles.lockIconMenuButton,
                  { borderBottomColor: theme.border },
                  pressed && styles.lockIconMenuButtonPressed,
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <ThemedText style={styles.lockIconMenuButtonText}>Notifications</ThemedText>
                  <ThemedText style={[styles.lockIconMenuButtonText, { color: allowedNotificationsSites.has(lockMenuHostname) ? theme.primary : theme.textSecondary }]}>
                    {allowedNotificationsSites.has(lockMenuHostname) ? 'ON' : 'OFF'}
                  </ThemedText>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setLockIconMenu(false);
                  Alert.alert(
                    'Images',
                    `${allowedImagesSites.has(lockMenuHostname) ? 'Disable' : 'Enable'} image access for this site?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: allowedImagesSites.has(lockMenuHostname) ? 'Disable' : 'Enable',
                        onPress: () => {
                          const newSites = new Set(allowedImagesSites);
                          if (newSites.has(lockMenuHostname)) {
                            newSites.delete(lockMenuHostname);
                            removePersistedPermission('images', lockMenuHostname);
                          } else {
                            newSites.add(lockMenuHostname);
                            askToRemember('images', lockMenuHostname);
                          }
                          // Update both state and ref immediately
                          setAllowedImagesSites(newSites);
                          allowedImagesSitesRef.current = newSites;

                          setLockIconMenu(false);

                          // SYNC: Notify WebView live
                          syncGatekeeperPermissions(lockMenuHostname);

                          // Prompt reload
                          setTimeout(() => {
                            Alert.alert(
                              'Permissions Changed',
                              'Reload page to apply changes?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Reload', onPress: () => reloadWithPermissionDetection(lockMenuHostname) }
                              ]
                            );
                          }, 200);
                        },
                      },
                    ]
                  );
                }}
                style={({ pressed }) => [
                  styles.lockIconMenuButton,
                  { borderBottomColor: theme.border },
                  pressed && styles.lockIconMenuButtonPressed,
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <ThemedText style={styles.lockIconMenuButtonText}>Images</ThemedText>
                  <ThemedText style={[styles.lockIconMenuButtonText, { color: allowedImagesSites.has(lockMenuHostname) ? theme.primary : theme.textSecondary }]}>
                    {allowedImagesSites.has(lockMenuHostname) ? 'ON' : 'OFF'}
                  </ThemedText>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setLockIconMenu(false);
                  Clipboard.setStringAsync(activeTab.url);
                }}
                style={({ pressed }) => [
                  styles.lockIconMenuButton,
                  pressed && styles.lockIconMenuButtonPressed,
                ]}
              >
                <ThemedText style={styles.lockIconMenuButtonText}>Copy URL</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        )}

        {tabs.map(tab => {
          // Determine if this specific tab is YouTube
          const tabIsYouTube = tab.url?.includes('youtube.com') || tab.url?.includes('youtu.be') || tab.url?.includes('m.youtube.com');
          const tabIsReddit = tab.url?.toLowerCase().includes('reddit.com');
          const tabIsGoogleAuth = tab.url ? isGoogleAuthUrl(tab.url) : false;
          const tabIsOAuthCallback = tab.url ? isOAuthCallbackUrl(tab.url) : false;
          const tabIsGoogle = tab.url ? (isGoogleSearchUrl(tab.url) && !tabIsGoogleAuth) : false;
          // Skip heavy scripts for auth/OAuth pages to avoid interfering with authentication flows
          const skipHeavyScripts = tabIsGoogleAuth || tabIsOAuthCallback;

          return (
            <Animated.View key={tab.id} style={[styles.webViewContainer, webViewContainerAnimatedStyle, tab.id === activeTabId ? {} : { display: 'none' }]}>
              <WebView
                ref={tab.id === activeTabId ? webViewRef : null}
                source={{ uri: tab.sourceUrl || tab.url }}
                userAgent={tab.id === activeTabId ? getUserAgent() : undefined}
                onNavigationStateChange={(navState: any) => {
                  if (tab.id === activeTabId) {
                    handleNavigationStateChange(navState);
                  }
                }}
                onLoadStart={(event: any) => {
                  if (tab.id === activeTabId) {
                    handleLoadStart(event);
                  }
                }}
                onLoadEnd={(event: any) => {
                  if (tab.id === activeTabId) {
                    handleLoadEnd(event);
                  }
                }}
                onLoadProgress={(event: any) => {
                  if (tab.id === activeTabId) {
                    handleLoadProgress(event);
                  }
                }}
                onShouldStartLoadWithRequest={(request: any) => {
                  if (tab.id === activeTabId) {
                    if (isGoogleAuthUrl(request.url)) {
                      console.log('[Google Auth Check] onShouldStartLoadWithRequest: ALLOWING auth URL:', request.url);
                    }
                    return handleShouldStartLoadWithRequest(request);
                  }
                  return true;
                }}
                onMessage={(event: any) => {
                  if (tab.id === activeTabId) {
                    handleWebViewMessage(event);
                  }
                }}
                onPermissionRequest={(request: any) => {
                  if (tab.id === activeTabId) {
                    try {
                      // Extract hostname/origin
                      const requestUrl = request.url || request.origin || currentUrl;
                      let requestHostname = 'unknown';
                      try {
                        requestHostname = new URL(requestUrl).hostname;
                      } catch (e) {
                        console.log('Error parsing permission origin:', requestUrl);
                      }

                      // Normalize hostname for consistent matching
                      const normalizedHostname = normalizeHostname(requestHostname);

                      // Get requested resources - standardizing input
                      const resources = request.resources || (request.getResources ? request.getResources() : []);
                      console.log(`[Gatekeeper] Request from ${requestHostname} (normalized: ${normalizedHostname}):`, resources);

                      // Use REFS to get latest permission values
                      const micCameraAllowed = allowedMicCameraSitesRef.current.has(normalizedHostname);
                      const gpsAllowed = allowedGPSSitesRef.current.has(normalizedHostname);
                      const notificationsAllowed = allowedNotificationsSitesRef.current.has(normalizedHostname);

                      // Logic: Strict Gatekeeper
                      // The App has the system permission. We only proxy it if the toggle is ON.

                      let deniedAny = false;
                      const permissionsToGrant: string[] = [];

                      resources.forEach((resource: string) => {
                        if (resource === 'android.webkit.resource.AUDIO_CAPTURE' || resource === 'microphone' ||
                          resource === 'android.webkit.resource.VIDEO_CAPTURE' || resource === 'camera') {
                          if (micCameraAllowed) {
                            permissionsToGrant.push(resource);
                          } else {
                            deniedAny = true;
                            console.log(`[Gatekeeper] BLOCKED: ${resource} for ${requestHostname} - mic/camera toggle OFF`);
                          }
                        } else if (resource === 'notifications') {
                          // Notifications often handled via different channel, but if they come here:
                          if (notificationsAllowed) {
                            permissionsToGrant.push(resource);
                          } else {
                            deniedAny = true;
                            console.log(`[Gatekeeper] BLOCKED: ${resource} for ${requestHostname} - notifications toggle OFF`);
                          }
                        }
                        else if (resource === 'geolocation') {
                          if (gpsAllowed) {
                            permissionsToGrant.push(resource);
                          } else {
                            deniedAny = true;
                            console.log(`[Gatekeeper] BLOCKED: ${resource} for ${requestHostname} - GPS toggle OFF`);
                          }
                        }
                        else if (resource === 'android.webkit.resource.PROTECTED_MEDIA_ID' || resource === 'protected_media_id') {
                          // Always grant protected media (DRM) - innocuous
                          permissionsToGrant.push(resource);
                        }
                        else {
                          // Unknown resource type - deny by default
                          deniedAny = true;
                          console.log(`[Gatekeeper] BLOCKED: Unknown resource ${resource} for ${requestHostname}`);
                        }
                      });

                      if (deniedAny) {
                        // If we are blocking something, we deny the whole request (standard security practice)
                        console.log(`[Gatekeeper] Denying request from ${requestHostname}. Toggles: MicCam=${micCameraAllowed}, GPS=${gpsAllowed}`);
                        request.deny();

                        // Notify user WHY it failed
                        // We can check what was denied to show specific message
                        if (!permissionsToGrant.includes('android.webkit.resource.PROTECTED_MEDIA_ID')) {
                          // Don't alert for background DRM checks if valid
                          Alert.alert(
                            'Permission Blocked',
                            `${requestHostname} requested permissions that are disabled in your settings. Tap the Lock icon to enable.`,
                            [{ text: 'OK' }]
                          );
                        }
                      } else {
                        // All requested permissions are allowed by policy
                        console.log(`[Gatekeeper] Granting access to ${requestHostname}:`, permissionsToGrant);
                        request.grant(permissionsToGrant);
                      }
                    } catch (error) {
                      console.error('Permission request handler error:', error);
                      request.deny();
                    }
                  }
                }}


                injectedJavaScript={`
                (function() {
                  // Expose reload function to JavaScript
                  window.reloadYouTubePage = function() {
                    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ytStopThenReload', url: window.location.href }));
                    }
                  };
                })();
              ` + (skipHeavyScripts ? DEBUG_CONSOLE_PROXY_JS + scrollTrackingJS : injectedJS) + (!skipHeavyScripts && tabIsYouTube ? youtubeFixJS : '') + (!skipHeavyScripts && tabIsReddit ? REDDIT_NSFW_FILTER_JS : '') + (!skipHeavyScripts && tabIsGoogle ? GOOGLE_SAFESEARCH_SUPPRESSION_JS + GOOGLE_SECTIONS_BLOCK_JS : '')}
                injectedJavaScriptBeforeContentLoaded={skipHeavyScripts ? DEBUG_CONSOLE_PROXY_JS : (mediaFilterPreloadJS + (tabIsYouTube ? youtubePreloadJS + ';' + youtubeFixJS : '') + (tabIsReddit ? REDDIT_EARLY_CSS_JS : '') + (tabIsGoogle ? GOOGLE_SAFESEARCH_SUPPRESSION_JS + GOOGLE_SECTIONS_BLOCK_JS : '') + getPermissionBlockingScript(currentHostname))}
                key={`${tab.id}-${permissionCounter}-${forceNavCounter}`}
                originWhitelist={['*']}
                allowsBackForwardNavigationGestures
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                setSupportMultipleWindows={true}
                javaScriptCanOpenWindowsAutomatically={true}
                onOpenWindow={(syntheticEvent: any) => {
                  const { targetUrl } = syntheticEvent.nativeEvent;
                  console.log('[NavDebug] onOpenWindow triggered:', targetUrl);

                  // Check if this is a Google OAuth popup - these need special handling
                  const isGoogleAuthPopup = targetUrl && (
                    targetUrl.includes('accounts.google.com') ||
                    targetUrl.includes('accounts.youtube.com') ||
                    isGoogleAuthUrl(targetUrl)
                  );

                  if (isGoogleAuthPopup) {
                    console.log('  [OAuth] Detected Google auth popup, opening new tab');
                    // Open in new tab to simulate popup and preserve main page context
                    createTab(targetUrl);
                  } else if (webViewRef.current && targetUrl) {
                    console.log('  Redirecting current tab to popup URL');
                    // For other popups, use JS injection
                    const jsCode = `window.location.href = "${targetUrl}";`;
                    webViewRef.current.injectJavaScript(jsCode);
                  }
                }}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo
                allowsLinkPreview={false}
                allowsPictureInPictureMediaPlayback
                automaticallyAdjustContentInsets={false}
                allowsAirPlayForMediaPlayback
                // IMPORTANT: "grantIfSameHostElsePrompt" ensures onPermissionRequest is always called
                // This is crucial for the Gatekeeper pattern to work.
                mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
                geolocationEnabled={isGPSAllowed}
                webviewDebuggingEnabled={__DEV__}
                injectedJavaScriptForMainFrameOnly={false}
                cacheMode="LOAD_NO_CACHE"
                incognito={false}
                mixedContentMode="compatibility"
                thirdPartyCookiesEnabled={true}
                sharedCookiesEnabled={true}
                onFileDownload={(event: any) => {
                  if (isApkDownload(event.nativeEvent.downloadUrl)) {
                    Alert.alert('Download Blocked', 'APK downloads are not allowed.');
                    return;
                  }

                  const url = event.nativeEvent.downloadUrl;
                  let hostname = 'unknown';
                  try {
                    hostname = new URL(url).hostname;
                    if (!hostname) hostname = new URL(currentUrl).hostname;
                  } catch {
                    try { hostname = new URL(currentUrl).hostname; } catch { }
                  }

                  // Use ref to get latest permission value
                  if (allowedStorageSitesRef.current.has(hostname)) {
                    Linking.openURL(url);
                  } else {
                    Alert.alert(
                      'File Storage',
                      `Allow ${hostname} to save files to your device?`,
                      [
                        {
                          text: 'Deny',
                          style: 'cancel',
                          onPress: () => {
                            // Do nothing, download blocked/ignored
                          }
                        },
                        {
                          text: 'Allow',
                          onPress: () => {
                            const newSites = new Set(allowedStorageSites);
                            newSites.add(hostname);
                            setAllowedStorageSites(newSites);

                            // Proceed with download
                            Linking.openURL(url);
                          }
                        }
                      ]
                    );
                  }
                }}
                onReceivedError={(syntheticEvent: any) => {
                  const { nativeEvent } = syntheticEvent;
                  console.log('[NavDebug] Load Error:', nativeEvent.description, 'URL:', nativeEvent.url, 'Code:', nativeEvent.code);
                }}
                onReceivedHttpError={(syntheticEvent: any) => {
                  const { nativeEvent } = syntheticEvent;
                  console.log('[NavDebug] HTTP Error:', nativeEvent.description, 'URL:', nativeEvent.url, 'Status:', nativeEvent.statusCode);
                }}
                renderLoading={() => (
                  <View style={[styles.loadingOverlay, { backgroundColor: theme.backgroundRoot }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                  </View>
                )}
                style={styles.webView}
              />
            </Animated.View>
          );
        })}



        <Animated.View
          style={[
            styles.toolbar,
            {
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.xs,
            },
            toolbarAnimatedStyle,
          ]}
        >
          <Pressable
            onPress={handleGoBack}
            disabled={!activeTab?.canGoBack}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.buttonPressed,
              !activeTab?.canGoBack && styles.buttonDisabled,
            ]}
          >
            <Feather
              name="chevron-left"
              size={22}
              color={activeTab?.canGoBack ? theme.text : theme.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={handleGoForward}
            disabled={!activeTab?.canGoForward}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.buttonPressed,
              !activeTab?.canGoForward && styles.buttonDisabled,
            ]}
          >
            <Feather
              name="chevron-right"
              size={22}
              color={activeTab?.canGoForward ? theme.text : theme.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={handleRefresh}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Feather name="rotate-cw" size={18} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={handleToggleBookmark}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Feather
              name={bookmarked ? 'star' : 'star'}
              size={18}
              color={bookmarked ? theme.primary : theme.text}
            />
          </Pressable>

          <Pressable
            onPress={handleOpenBookmarks}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Feather name="bookmark" size={18} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Feather name="upload" size={18} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={handleFindInPage}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.buttonPressed,
              showFindInPage && { borderTopColor: theme.primary, borderTopWidth: 2 },
            ]}
          >
            <Feather name="search" size={18} color={showFindInPage ? theme.primary : theme.text} />
          </Pressable>
        </Animated.View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: 0,
    gap: Spacing.xs,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urlBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
  },
  urlIcon: {
    marginRight: Spacing.xs,
  },
  lockIconButton: {
    padding: Spacing.xs,
    marginRight: Spacing.xs,
    marginLeft: -Spacing.xs,
  },
  urlInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  openAppButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabCountButton: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabCountText: {
    fontWeight: '700',
    fontSize: 12,
  },
  progressBarContainer: {
    height: 2,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: HEADER_HEIGHT,
    left: 0,
    right: 0,
    zIndex: 9,
  },
  progressBar: {
    height: '100%',
  },
  referringAppBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    marginTop: HEADER_HEIGHT,
  },
  referringAppBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    marginTop: HEADER_HEIGHT,
    gap: Spacing.sm,
  },
  referringAppBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  referringAppActionButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 4,
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  findInPageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1, // Changed from top check
    position: 'absolute',
    top: HEADER_HEIGHT, // Moved to top
    left: 0,
    right: 0,
    zIndex: 100,
    gap: Spacing.xs,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 }, // Shadow down
    shadowOpacity: 0.1,
    shadowRadius: 4,
    backgroundColor: 'white', // Ensure it has background
  },
  findInPageInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: BorderRadius.full,
    paddingRight: Spacing.sm,
  },
  findInPageInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
  },
  findInPageCounter: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.5,
  },
  findInPageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  findInPageNavButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  findInPageCloseButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  verticalDivider: {
    width: 1,
    height: 20,
    marginHorizontal: Spacing.xs,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  toolbarButton: {
    width: 44,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.6,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  subredditSearchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  subredditSearchModal: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    width: '80%',
    maxWidth: 400,
  },
  subredditSearchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  subredditSearchTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  subredditSearchClose: {
    padding: Spacing.xs,
  },
  subredditSearchInputContainer: {
    marginBottom: Spacing.md,
  },
  subredditSearchModalInput: {
    fontSize: 14,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    minHeight: 40,
  },
  subredditSearchSubmitButton: {
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  subredditSearchSubmitText: {
    fontWeight: '600',
    fontSize: 16,
    color: '#FFFFFF',
  },
  linkContextMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  linkContextMenuBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    width: '70%',
    maxWidth: 300,
  },
  linkContextMenuTitle: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 12,
  },
  linkContextMenuButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  linkContextMenuButtonPressed: {
    opacity: 0.7,
  },
  linkContextMenuButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  lockIconMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  lockIconMenuBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    width: '70%',
    maxWidth: 300,
  },
  lockIconMenuTitle: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 12,
  },
  lockIconMenuButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  lockIconMenuButtonPressed: {
    opacity: 0.7,
  },
  lockIconMenuButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { processUrl } from './content-filter';

export interface Tab {
  id: string;
  url: string;
  sourceUrl?: string; // The URL that actually drives the WebView source
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  createdAt: number;
}

export interface PinnedSite {
  id: string;
  url: string;
  title: string;
  favicon?: string;
}

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
}

interface BrowserContextType {
  tabs: Tab[];
  activeTabId: string | null;
  bookmarks: Bookmark[];
  pinnedSites: PinnedSite[];
  history: HistoryItem[];
  pendingCacheClear: boolean;
  pendingDataClear: boolean;
  referringApp: string | null;
  clearReferringApp: () => void;
  createTab: (url?: string) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  addBookmark: (url: string, title: string) => void;
  removeBookmark: (id: string) => void;
  isBookmarked: (url: string) => boolean;
  addPinnedSite: (url: string, title: string) => void;
  removePinnedSite: (id: string) => void;
  addToHistory: (url: string, title: string) => void;
  clearHistory: () => void;
  clearBookmarks: () => void;
  requestCacheClear: () => void;
  acknowledgeCacheClear: () => void;
  clearAllData: () => void;
  acknowledgeDataClear: () => void;
  loadData: () => Promise<void>;
  getActiveTab: () => Tab | undefined;
  resetActiveTab: () => void; // NEW: Force recreate active tab
}

const BrowserContext = createContext<BrowserContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TABS: '@safebrowse_tabs',
  ACTIVE_TAB: '@safebrowse_active_tab',
  BOOKMARKS: '@safebrowse_bookmarks',
  PINNED_SITES: '@safebrowse_pinned_sites',
  HISTORY: '@safebrowse_history',
};

const MAX_TABS = 10;
const MAX_HISTORY = 500;

export function BrowserProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [pinnedSites, setPinnedSites] = useState<PinnedSite[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pendingCacheClear, setPendingCacheClear] = useState(false);
  const [referringApp, setReferringApp] = useState<string | null>(null);
  const isInitialized = useRef(false);
  const pendingUrl = useRef<string | null>(null);
  const isDataLoaded = useRef(false);
  const lastTabCreated = useRef<number>(0);

  const requestCacheClear = useCallback(() => {
    setPendingCacheClear(true);
  }, []);

  const acknowledgeCacheClear = useCallback(() => {
    setPendingCacheClear(false);
  }, []);

  const [pendingDataClear, setPendingDataClear] = useState(false);

  const clearAllData = useCallback(() => {
    setPendingDataClear(true);
  }, []);

  const acknowledgeDataClear = useCallback(() => {
    setPendingDataClear(false);
  }, []);

  const clearReferringApp = useCallback(() => {
    setReferringApp(null);
  }, []);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const saveTabs = useCallback(async (newTabs: Tab[], newActiveId: string | null) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(newTabs));
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, newActiveId || '');
    } catch (error) {
      console.error('Failed to save tabs:', error);
    }
  }, []);

  const saveBookmarks = useCallback(async (newBookmarks: Bookmark[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(newBookmarks));
    } catch (error) {
      console.error('Failed to save bookmarks:', error);
    }
  }, []);

  const saveHistory = useCallback(async (newHistory: HistoryItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    try {
      const [tabsData, activeTabData, bookmarksData, pinnedSitesData, historyData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TABS),
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TAB),
        AsyncStorage.getItem(STORAGE_KEYS.BOOKMARKS),
        AsyncStorage.getItem(STORAGE_KEYS.PINNED_SITES),
        AsyncStorage.getItem(STORAGE_KEYS.HISTORY),
      ]);

      let loadedTabs: Tab[] = [];
      let loadedActiveId: string | null = null;

      if (tabsData) {
        try {
          loadedTabs = JSON.parse(tabsData);
          // Migrate old tabs to have sourceUrl if missing
          loadedTabs = loadedTabs.map((t: Tab) => ({
            ...t,
            sourceUrl: t.sourceUrl || t.url // Default to current url if missing
          }));

          if (activeTabData && activeTabData.length > 0 && loadedTabs.find((t: Tab) => t.id === activeTabData)) {
            loadedActiveId = activeTabData;
          } else if (loadedTabs.length > 0) {
            loadedActiveId = loadedTabs[0].id;
          }
        } catch {
          loadedTabs = [];
        }
      }

      if (loadedTabs.length === 0) {
        const newTabId = generateId();
        const defaultTab: Tab = {
          id: newTabId,
          url: 'https://safesearchengine.com/',
          sourceUrl: 'https://safesearchengine.com/',
          title: 'Safe Search Engine',
          canGoBack: false,
          canGoForward: false,
        };
        loadedTabs = [defaultTab];
        loadedActiveId = newTabId;
        await saveTabs([defaultTab], newTabId);
      }

      setTabs(loadedTabs);
      setActiveTabId(loadedActiveId);

      if (bookmarksData) {
        try {
          setBookmarks(JSON.parse(bookmarksData));
        } catch {
          setBookmarks([]);
        }
      }

      if (pinnedSitesData) {
        try {
          setPinnedSites(JSON.parse(pinnedSitesData));
        } catch {
          setPinnedSites([]);
        }
      }

      if (historyData) {
        try {
          const parsedHistory = JSON.parse(historyData);
          setHistory(parsedHistory.slice(0, MAX_HISTORY));
        } catch {
          setHistory([]);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      const newTabId = generateId();
      const defaultTab: Tab = {
        id: newTabId,
        url: 'https://safesearchengine.com/',
        sourceUrl: 'https://safesearchengine.com/',
        title: 'Safe Search Engine',
        canGoBack: false,
        canGoForward: false,
      };
      setTabs([defaultTab]);
      setActiveTabId(newTabId);
    }
  }, [saveTabs]);

  const createTab = useCallback((url = 'https://safesearchengine.com/') => {
    if (tabs.length >= MAX_TABS) {
      return tabs[tabs.length - 1].id;
    }

    // Prevent rapid tab creation (throttle)
    const now = Date.now();
    if (now - lastTabCreated.current < 1000) {
      console.log('[BrowserContext] Tab creation throttled (cooldown)');
      return activeTabId || tabs[tabs.length - 1]?.id;
    }
    lastTabCreated.current = now;

    const newTabId = generateId();
    const newTab: Tab = {
      id: newTabId,
      url,
      sourceUrl: url,
      title: 'New Tab',
      canGoBack: false,
      canGoForward: false,
    };

    const newTabs = [...tabs, newTab];
    setTabs(newTabs);
    saveTabs(newTabs, activeTabId);
    return newTabId;
  }, [tabs, activeTabId, saveTabs]);

  const closeTab = useCallback((id: string) => {
    const newTabs = tabs.filter(t => t.id !== id);

    if (newTabs.length === 0) {
      const newTabId = generateId();
      const defaultTab: Tab = {
        id: newTabId,
        url: 'https://safesearchengine.com/',
        sourceUrl: 'https://safesearchengine.com/',
        title: 'Safe Search Engine',
        canGoBack: false,
        canGoForward: false,
      };
      setTabs([defaultTab]);
      setActiveTabId(newTabId);
      saveTabs([defaultTab], newTabId);
    } else {
      setTabs(newTabs);
      if (activeTabId === id) {
        const newActiveId = newTabs[newTabs.length - 1].id;
        setActiveTabId(newActiveId);
        saveTabs(newTabs, newActiveId);
      } else {
        saveTabs(newTabs, activeTabId);
      }
    }
  }, [tabs, activeTabId, saveTabs]);

  const setActiveTab = useCallback((id: string) => {
    setActiveTabId(id);
    saveTabs(tabs, id);
  }, [tabs, saveTabs]);

  const updateTab = useCallback((id: string, updates: Partial<Tab>) => {
    const newTabs = tabs.map(t =>
      t.id === id ? { ...t, ...updates } : t
    );
    setTabs(newTabs);
    saveTabs(newTabs, activeTabId);
  }, [tabs, activeTabId, saveTabs]);

  const addBookmark = useCallback((url: string, title: string) => {
    const existing = bookmarks.find(b => b.url === url);
    if (existing) return;

    const newBookmark: Bookmark = {
      id: generateId(),
      url,
      title,
      createdAt: Date.now(),
    };

    const newBookmarks = [newBookmark, ...bookmarks];
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
  }, [bookmarks, saveBookmarks]);

  const removeBookmark = useCallback((id: string) => {
    const newBookmarks = bookmarks.filter(b => b.id !== id);
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
  }, [bookmarks, saveBookmarks]);

  const isBookmarked = useCallback((url: string) => {
    return bookmarks.some(b => b.url === url);
  }, [bookmarks]);

  const savePinnedSites = useCallback(async (newPinnedSites: PinnedSite[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PINNED_SITES, JSON.stringify(newPinnedSites));
    } catch (error) {
      console.error('Failed to save pinned sites:', error);
    }
  }, []);

  const addPinnedSite = useCallback((url: string, title: string) => {
    if (pinnedSites.length >= 12) return; // Max 6 pinned sites

    const existing = pinnedSites.find(p => p.url === url);
    if (existing) return;

    const newSite: PinnedSite = {
      id: generateId(),
      url,
      title,
    };

    const newPinnedSites = [...pinnedSites, newSite];
    setPinnedSites(newPinnedSites);
    savePinnedSites(newPinnedSites);
  }, [pinnedSites, savePinnedSites]);

  const removePinnedSite = useCallback((id: string) => {
    const newPinnedSites = pinnedSites.filter(p => p.id !== id);
    setPinnedSites(newPinnedSites);
    savePinnedSites(newPinnedSites);
  }, [pinnedSites, savePinnedSites]);

  const addToHistory = useCallback((url: string, title: string) => {
    const existingIndex = history.findIndex(h => h.url === url);
    let newHistory: HistoryItem[];

    if (existingIndex !== -1) {
      newHistory = [...history];
      newHistory.splice(existingIndex, 1);
    } else {
      newHistory = [...history];
    }

    const newItem: HistoryItem = {
      id: generateId(),
      url,
      title,
      visitedAt: Date.now(),
    };

    newHistory = [newItem, ...newHistory].slice(0, MAX_HISTORY);
    setHistory(newHistory);
    saveHistory(newHistory);
  }, [history, saveHistory]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, [saveHistory]);

  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
    saveBookmarks([]);
  }, [saveBookmarks]);

  const getActiveTab = useCallback(() => {
    return tabs.find(t => t.id === activeTabId);
  }, [tabs, activeTabId]);

  // NEW: Reset the active tab by creating a new one with the same URL
  // This forces WebView to recreate and clear all session data
  const resetActiveTab = useCallback(() => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (!currentTab) return;

    const newTabId = generateId();
    const newTab: Tab = {
      id: newTabId,
      url: currentTab.url,
      sourceUrl: currentTab.url,
      title: 'Loading...',
      canGoBack: false,
      canGoForward: false,
    };

    const newTabs = tabs.map(t =>
      t.id === activeTabId ? newTab : t
    );

    setTabs(newTabs);
    setActiveTabId(newTabId);
    saveTabs(newTabs, newTabId);
  }, [tabs, activeTabId, saveTabs]);

  const processIncomingUrl = useCallback((url: string, currentTabs: Tab[], currentActiveId: string | null) => {
    if (!url || url.startsWith('safebrowse://')) return;

    // CRITICAL: Only handle web URLs (http/https).
    // Deep links (fb://, intent://) should be handled by the WebView's onShouldStartLoadWithRequest
    // and NOT by creating new tabs, which causes infinite loops.
    const isWebUrl = url.startsWith('http://') || url.startsWith('https://');
    if (!isWebUrl) {
      console.log('[BrowserContext] Ignoring incoming non-web URL in processIncomingUrl:', url);
      return;
    }

    const result = processUrl(url, 'navigation');
    if (result.blocked) return;

    // For URLs from external apps (when called from the useEffect that handles pendingUrl),
    // create a new tab instead of replacing the current one
    // This ensures external app links get their own tab
    const isFromExternalSource = currentTabs.length > 0;

    if (isFromExternalSource) {
      setReferringApp('External App');
    }

    // Create a new tab for URLs from external sources
    const newTabId = generateId();
    const newTab: Tab = {
      id: newTabId,
      url: result.url,
      sourceUrl: result.url,
      title: 'Loading...',
      canGoBack: false,
      canGoForward: false,
    };

    // Add the new tab and make it active
    const updatedTabs = [...currentTabs, newTab];
    setTabs(updatedTabs);
    setActiveTabId(newTabId);
    saveTabs(updatedTabs, newTabId);
  }, [saveTabs]);

  // Separate function for internal navigation (address bar, etc.)
  const processInternalNavigation = useCallback((url: string, currentTabs: Tab[], currentActiveId: string | null) => {
    if (!url || url.startsWith('safebrowse://')) return;

    const isWebUrl = url.startsWith('http://') || url.startsWith('https://');
    if (!isWebUrl) {
      console.log('[BrowserContext] Ignoring non-web URL in processInternalNavigation:', url);
      return;
    }

    const result = processUrl(url, 'navigation');
    if (result.blocked) return;

    if (currentTabs.length > 0 && currentActiveId) {
      // Update the current active tab for internal navigation
      const newTabs = currentTabs.map(t =>
        t.id === currentActiveId ? { ...t, url: result.url, sourceUrl: result.url, title: 'Loading...' } : t
      );
      setTabs(newTabs);
      saveTabs(newTabs, currentActiveId);
    } else {
      // Create the first tab if none exist
      const newTabId = generateId();
      const newTab: Tab = {
        id: newTabId,
        url: result.url,
        sourceUrl: result.url,
        title: 'Loading...',
        canGoBack: false,
        canGoForward: false,
      };
      setTabs([newTab]);
      setActiveTabId(newTabId);
      saveTabs([newTab], newTabId);
    }
  }, [saveTabs]);

  useEffect(() => {
    const initializeApp = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && !initialUrl.startsWith('safebrowse://')) {
        pendingUrl.current = initialUrl;
      }
      await loadData();
      isDataLoaded.current = true;
    };
    initializeApp();
  }, [loadData]);

  useEffect(() => {
    if (isDataLoaded.current && pendingUrl.current && tabs.length > 0) {
      processIncomingUrl(pendingUrl.current, tabs, activeTabId);
      pendingUrl.current = null;
    }
  }, [tabs, activeTabId, processIncomingUrl]);

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      if (isDataLoaded.current) {
        processIncomingUrl(event.url, tabs, activeTabId);
      } else {
        pendingUrl.current = event.url;
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [tabs, activeTabId, processIncomingUrl]);

  return (
    <BrowserContext.Provider
      value={{
        tabs,
        activeTabId,
        bookmarks,
        pinnedSites,
        history,
        pendingCacheClear,
        pendingDataClear,
        referringApp,
        clearReferringApp,
        createTab,
        closeTab,
        setActiveTab,
        updateTab,
        addBookmark,
        removeBookmark,
        isBookmarked,
        addPinnedSite,
        removePinnedSite,
        addToHistory,
        clearHistory,
        clearBookmarks,
        requestCacheClear,
        acknowledgeCacheClear,
        clearAllData,
        acknowledgeDataClear,
        loadData,
        getActiveTab,
        resetActiveTab,
      }}
    >
      {children}
    </BrowserContext.Provider>
  );
}

export function useBrowser() {
  const context = useContext(BrowserContext);
  if (!context) {
    throw new Error('useBrowser must be used within a BrowserProvider');
  }
  return context;
}
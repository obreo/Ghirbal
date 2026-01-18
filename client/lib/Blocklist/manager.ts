/**
 * Blocklist Manager
 * 
 * Handles loading, caching, and updating blocklists from:
 * - Local files in the Blocklist directory
 * - Remote endpoints (EasyList, AdGuard, etc.)
 * - Embedded blocklist data
 */

import * as FileSystem from 'expo-file-system';
import {
  BlocklistEndpoint,
  getEnabledEndpoints,
  getAllEndpoints,
} from './endpoints';
import { parseBlocklistContent } from './parser';
import { parseAllLocalBlocklists, getLocalBlocklistStats, LOCAL_BLOCKLISTS } from './local-lists';

// Re-export for convenience
export { BlocklistEndpoint, getEnabledEndpoints, getAllEndpoints };
export { 
  parseBlocklistContent, 
  parseEasyListFormat, 
  parseAdGuardFormat, 
  parseDomainsFormat, 
  parseHostsFormat 
} from './parser';
export { LOCAL_BLOCKLISTS, getEnabledLocalBlocklists, getLocalBlocklistById } from './local-lists';

/**
 * In-memory cache of parsed blocklists from external sources
 */
let externalBlocklistCache: Map<string, string[]> = new Map();
let localBlocklistCache: Map<string, string[]> = new Map();
let lastUpdateTimestamp: number = 0;
let isInitialized: boolean = false;

/**
 * Cached set of all blocked domains for fast lookup
 * This is rebuilt when blocklists are updated
 */
let allBlockedDomainsCache: Set<string> | null = null;

/**
 * Update interval in milliseconds (default: 24 hours)
 */
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Local blocklist directory path
 */
const LOCAL_BLOCKLIST_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}blocklists/`
  : null;

/**
 * Fetch blocklist from a remote URL
 */
async function fetchBlocklist(endpoint: BlocklistEndpoint): Promise<string[]> {
  try {
    console.log(`[Blocklist] Fetching: ${endpoint.name} from ${endpoint.url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(endpoint.url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'text/plain, */*',
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    const domains = parseBlocklistContent(content, endpoint.format);

    console.log(`[Blocklist] Parsed ${domains.length} domains from ${endpoint.name}`);
    return domains;
  } catch (error) {
    console.warn(`[Blocklist] Failed to fetch ${endpoint.name}:`, error);
    return [];
  }
}

/**
 * Load a local blocklist file from the Blocklist directory
 */
async function loadLocalBlocklistFile(filename: string): Promise<string[]> {
  if (!LOCAL_BLOCKLIST_DIR) {
    console.warn('[Blocklist] Local blocklist directory not available');
    return [];
  }

  try {
    const filePath = `${LOCAL_BLOCKLIST_DIR}${filename}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      console.log(`[Blocklist] Local file not found: ${filename}`);
      return [];
    }

    const content = await FileSystem.readAsStringAsync(filePath);
    const domains = parseBlocklistContent(content);

    console.log(`[Blocklist] Loaded ${domains.length} domains from local file: ${filename}`);
    return domains;
  } catch (error) {
    console.warn(`[Blocklist] Failed to load local file ${filename}:`, error);
    return [];
  }
}

/**
 * Load all local blocklist files from the Blocklist directory
 */
async function loadAllLocalBlocklists(): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  if (!LOCAL_BLOCKLIST_DIR) {
    return results;
  }

  try {
    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_BLOCKLIST_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_BLOCKLIST_DIR, { intermediates: true });
      console.log('[Blocklist] Created local blocklist directory');
      return results;
    }

    // List all files in directory
    const files = await FileSystem.readDirectoryAsync(LOCAL_BLOCKLIST_DIR);
    const blocklistFiles = files.filter(f =>
      f.endsWith('.txt') || f.endsWith('.list') || f.endsWith('.blocklist')
    );

    // Load each file
    for (const file of blocklistFiles) {
      const domains = await loadLocalBlocklistFile(file);
      if (domains.length > 0) {
        results.set(file, domains);
      }
    }

    console.log(`[Blocklist] Loaded ${results.size} local blocklist files`);
  } catch (error) {
    console.warn('[Blocklist] Error loading local blocklists:', error);
  }

  return results;
}

/**
 * Save a blocklist to local storage for offline use
 */
export async function saveBlocklistLocally(
  filename: string,
  content: string
): Promise<boolean> {
  if (!LOCAL_BLOCKLIST_DIR) {
    console.warn('[Blocklist] Cannot save: local directory not available');
    return false;
  }

  try {
    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_BLOCKLIST_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_BLOCKLIST_DIR, { intermediates: true });
    }

    const filePath = `${LOCAL_BLOCKLIST_DIR}${filename}`;
    await FileSystem.writeAsStringAsync(filePath, content);

    // Update local cache
    const domains = parseBlocklistContent(content);
    localBlocklistCache.set(filename, domains);

    console.log(`[Blocklist] Saved ${filename} with ${domains.length} domains`);
    return true;
  } catch (error) {
    console.warn(`[Blocklist] Failed to save ${filename}:`, error);
    return false;
  }
}

/**
 * Add a custom blocklist from URL and save it locally
 */
export async function addBlocklistFromUrl(
  url: string,
  filename: string,
  format?: BlocklistEndpoint['format']
): Promise<{ success: boolean; domainCount: number; error?: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, domainCount: 0, error: `HTTP ${response.status}` };
    }

    const content = await response.text();
    const domains = parseBlocklistContent(content, format);

    if (domains.length === 0) {
      return { success: false, domainCount: 0, error: 'No valid domains found' };
    }

    const saved = await saveBlocklistLocally(filename, content);
    if (!saved) {
      return { success: false, domainCount: 0, error: 'Failed to save locally' };
    }

    return { success: true, domainCount: domains.length };
  } catch (error) {
    return { success: false, domainCount: 0, error: String(error) };
  }
}

/**
 * Delete a local blocklist file
 */
export async function deleteLocalBlocklist(filename: string): Promise<boolean> {
  if (!LOCAL_BLOCKLIST_DIR) {
    return false;
  }

  try {
    const filePath = `${LOCAL_BLOCKLIST_DIR}${filename}`;
    await FileSystem.deleteAsync(filePath, { idempotent: true });
    localBlocklistCache.delete(filename);
    console.log(`[Blocklist] Deleted local file: ${filename}`);
    return true;
  } catch (error) {
    console.warn(`[Blocklist] Failed to delete ${filename}:`, error);
    return false;
  }
}

/**
 * List all local blocklist files
 */
export async function listLocalBlocklists(): Promise<string[]> {
  if (!LOCAL_BLOCKLIST_DIR) {
    return [];
  }

  try {
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_BLOCKLIST_DIR);
    if (!dirInfo.exists) {
      return [];
    }

    const files = await FileSystem.readDirectoryAsync(LOCAL_BLOCKLIST_DIR);
    return files.filter(f =>
      f.endsWith('.txt') || f.endsWith('.list') || f.endsWith('.blocklist')
    );
  } catch {
    return [];
  }
}

/**
 * Initialize the blocklist system
 * Fetches enabled external blocklists and loads local files
 */
export async function initializeBlocklists(embeddedBlocklist: string[]): Promise<void> {
  if (isInitialized && Date.now() - lastUpdateTimestamp < UPDATE_INTERVAL_MS) {
    console.log('[Blocklist] Already initialized and up to date');
    return;
  }

  console.log('[Blocklist] Initializing blocklist system...');

  try {
    // Load local blocklists
    localBlocklistCache = await loadAllLocalBlocklists();

    // Fetch enabled external blocklists
    const enabledEndpoints = getEnabledEndpoints();
    const fetchPromises = enabledEndpoints.map(async (endpoint) => {
      const domains = await fetchBlocklist(endpoint);
      return { id: endpoint.id, domains };
    });

    const results = await Promise.allSettled(fetchPromises);

    // Update cache with successful fetches
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.domains.length > 0) {
        externalBlocklistCache.set(result.value.id, result.value.domains);
      }
    }

    lastUpdateTimestamp = Date.now();
    isInitialized = true;

    const totalExternal = Array.from(externalBlocklistCache.values())
      .reduce((sum, arr) => sum + arr.length, 0);
    const totalLocal = Array.from(localBlocklistCache.values())
      .reduce((sum, arr) => sum + arr.length, 0);
    const totalBundled = parseAllLocalBlocklists().length;

    console.log(`[Blocklist] Initialized: ${embeddedBlocklist.length} embedded, ${totalExternal} external, ${totalLocal} local, ${totalBundled} bundled domains`);

    // Invalidate the cached all blocked domains set since blocklists have been updated
    invalidateAllBlockedDomainsCache();
  } catch (error) {
    console.error('[Blocklist] Initialization error:', error);
  }
}

/**
 * Force refresh all blocklists
 */
export async function refreshBlocklists(embeddedBlocklist: string[]): Promise<void> {
  lastUpdateTimestamp = 0;
  isInitialized = false;
  externalBlocklistCache.clear();
  localBlocklistCache.clear();
  await initializeBlocklists(embeddedBlocklist);
}

/**
 * Get blocklist statistics
 */
export function getBlocklistStats(embeddedCount: number): {
  embedded: number;
  external: { [key: string]: number };
  local: { [key: string]: number };
  bundled: { [key: string]: number };
  total: number;
  lastUpdate: Date | null;
  isInitialized: boolean;
} {
  const external: { [key: string]: number } = {};
  const local: { [key: string]: number } = {};

  externalBlocklistCache.forEach((domains, id) => {
    external[id] = domains.length;
  });

  localBlocklistCache.forEach((domains, filename) => {
    local[filename] = domains.length;
  });

  // Get bundled local blocklist stats
  const bundled = getLocalBlocklistStats();

  const totalExternal = Object.values(external).reduce((sum, n) => sum + n, 0);
  const totalLocal = Object.values(local).reduce((sum, n) => sum + n, 0);
  const totalBundled = Object.values(bundled).reduce((sum, n) => sum + n, 0);

  return {
    embedded: embeddedCount,
    external,
    local,
    bundled,
    total: embeddedCount + totalExternal + totalLocal + totalBundled,
    lastUpdate: lastUpdateTimestamp ? new Date(lastUpdateTimestamp) : null,
    isInitialized,
  };
}

/**
 * Get all blocked domains from external, local, and bundled sources (not including embedded)
 */
export function getExternalAndLocalDomains(): string[] {
  const allDomains: Set<string> = new Set();

  // Add external cached domains
  externalBlocklistCache.forEach((domains) => {
    domains.forEach(d => allDomains.add(d));
  });

  // Add local cached domains (downloaded to device)
  localBlocklistCache.forEach((domains) => {
    domains.forEach(d => allDomains.add(d));
  });

  // Add bundled local blocklists (from local-lists.ts)
  const bundledDomains = parseAllLocalBlocklists();
  bundledDomains.forEach(d => allDomains.add(d));

  return Array.from(allDomains);
}


/**
 * Get a cached set of all blocked domains for fast lookup
 * This is rebuilt when blocklists are updated
 */
export function getAllBlockedDomainsSet(): Set<string> {
  if (!allBlockedDomainsCache) {
    allBlockedDomainsCache = new Set(getExternalAndLocalDomains());
  }
  return allBlockedDomainsCache;
}

/**
 * Check if blocklist system is initialized
 */
export function isBlocklistInitialized(): boolean {
  return isInitialized;
}

/**
 * Invalidate the cached all blocked domains set
 * Call this when blocklists are updated
 */
export function invalidateAllBlockedDomainsCache(): void {
  allBlockedDomainsCache = null;
}

/**
 * Get cached external blocklist by ID
 */
export function getExternalBlocklistById(id: string): string[] {
  return externalBlocklistCache.get(id) || [];
}

/**
 * Get cached local blocklist by filename
 */
export function getLocalBlocklistByName(filename: string): string[] {
  return localBlocklistCache.get(filename) || [];
}


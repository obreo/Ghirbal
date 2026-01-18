/**
 * Blocklist Module
 * 
 * This module provides a comprehensive blocklist system that supports:
 * - Embedded domain blocklists
 * - External blocklist sources (EasyList, AdGuard, uBlock Origin, etc.)
 * - Local blocklist files
 * - Multiple formats (EasyList, AdGuard, hosts, simple domain lists)
 * 
 * Usage:
 * 
 * ```typescript
 * import { 
 *   initializeBlocklists, 
 *   getAllBlockedDomains,
 *   isDomainBlocked,
 *   getBlocklistStats
 * } from './Blocklist';
 * 
 * // Initialize on app start
 * await initializeBlocklists();
 * 
 * // Check if a domain is blocked
 * if (isDomainBlocked('example.com')) {
 *   console.log('Domain is blocked');
 * }
 * 
 * // Get statistics
 * const stats = getBlocklistStats();
 * console.log(`Total blocked domains: ${stats.total}`);
 * ```
 */

// Re-export endpoint configuration
export { 
  BlocklistEndpoint,
  DEFAULT_BLOCKLIST_ENDPOINTS,
  CUSTOM_BLOCKLIST_ENDPOINTS,
  getEnabledEndpoints,
  getAllEndpoints,
} from './endpoints';

// Re-export parsers
export {
  parseEasyListFormat,
  parseAdGuardFormat,
  parseDomainsFormat,
  parseHostsFormat,
  parseBlocklistContent,
} from './parser';

// Re-export manager functions (internal - use blocklist.ts exports for public API)
export {
  getExternalAndLocalDomains,
  isBlocklistInitialized,
  getExternalBlocklistById,
  getLocalBlocklistByName,
  saveBlocklistLocally,
  addBlocklistFromUrl,
  deleteLocalBlocklist,
  listLocalBlocklists,
  invalidateAllBlockedDomainsCache,
} from './manager';

// Re-export local bundled blocklist functions
export {
  LocalBlocklist,
  LOCAL_BLOCKLISTS,
  getEnabledLocalBlocklists,
  parseAllLocalBlocklists,
  getLocalBlocklistById as getBundledBlocklistById,
  getLocalBlocklistStats,
} from './local-lists';

// Re-export from main blocklist file (contains embedded domains)
// These are the primary public API functions
export {
  CUSTOM_BLOCKLIST,
  EMBEDDED_DOMAINS,
  initializeBlocklists,
  refreshBlocklists,
  getBlocklistStats,
  getAllBlockedDomains,
  isDomainBlocked,
  debugUrlBlocking,
} from './blocklist';

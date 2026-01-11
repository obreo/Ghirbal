/**
 * Local Bundled Blocklists
 * 
 * This file contains blocklists that are bundled with the app.
 * Add your local blocklist content here as template strings.
 * 
 * These lists are parsed at runtime and combined with the embedded
 * blocklist and any external/downloaded blocklists.
 * 
 * Supported formats:
 * - Simple domain list (one domain per line)
 * - EasyList/Adblock Plus format (||domain.com^)
 * - Hosts file format (0.0.0.0 domain.com)
 * - AdGuard format
 * 
 * Usage:
 * 1. Add your blocklist content as a named export
 * 2. Register it in LOCAL_BLOCKLISTS array at the bottom
 */

import type { BlocklistEndpoint } from './endpoints';
import { parseBlocklistContent } from './parser';

export interface LocalBlocklist {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** The raw blocklist content */
  content: string;
  /** Format hint for parsing */
  format?: BlocklistEndpoint['format'];
  /** Whether this list is enabled */
  enabled: boolean;
  /** Optional description */
  description?: string;
}

// ============================================================================
// ADD YOUR LOCAL BLOCKLISTS BELOW
// ============================================================================

/**
 * Example: Custom ad domains blocklist
 * Uncomment and modify as needed
 */
// export const CUSTOM_ADS_LIST = `
// # My custom ad domains
// ads.example.com
// tracking.example.com
// analytics.badsite.com
// `;

/**
 * Example: EasyList format blocklist
 */
// export const CUSTOM_EASYLIST = `
// [Adblock Plus 2.0]
// ! Title: My Custom Filters
// ! Last modified: 2024-01-01
// ||badads.com^
// ||trackers.net^
// ||malware-domain.com^
// `;

/**
 * Example: Hosts format blocklist
 */
// export const CUSTOM_HOSTS = `
// # Custom hosts file format
// 0.0.0.0 ads.example.com
// 0.0.0.0 tracking.example.com
// 127.0.0.1 malware.badsite.com
// `;

// ============================================================================
// REGISTER YOUR LOCAL BLOCKLISTS HERE
// ============================================================================

/**
 * Array of all local bundled blocklists
 * Add your blocklist configurations here
 */
export const LOCAL_BLOCKLISTS: LocalBlocklist[] = [
  // Example entry (uncomment and modify):
  // {
  //   id: 'custom-ads',
  //   name: 'Custom Ad Domains',
  //   content: CUSTOM_ADS_LIST,
  //   format: 'domains',
  //   enabled: true,
  //   description: 'My personal ad blocking list',
  // },
  // {
  //   id: 'custom-easylist',
  //   name: 'Custom EasyList Filters',
  //   content: CUSTOM_EASYLIST,
  //   format: 'easylist',
  //   enabled: true,
  //   description: 'Custom filter rules in EasyList format',
  // },
];

/**
 * Get all enabled local bundled blocklists
 */
export function getEnabledLocalBlocklists(): LocalBlocklist[] {
  return LOCAL_BLOCKLISTS.filter(list => list.enabled);
}

/**
 * Parse all enabled local blocklists and return domains
 */
export function parseAllLocalBlocklists(): string[] {
  const allDomains: Set<string> = new Set();
  
  for (const list of getEnabledLocalBlocklists()) {
    const domains = parseBlocklistContent(list.content, list.format);
    domains.forEach(d => allDomains.add(d));
  }
  
  return Array.from(allDomains);
}

/**
 * Get local blocklist by ID
 */
export function getLocalBlocklistById(id: string): LocalBlocklist | undefined {
  return LOCAL_BLOCKLISTS.find(list => list.id === id);
}

/**
 * Get statistics for local bundled blocklists
 */
export function getLocalBlocklistStats(): { [id: string]: number } {
  const stats: { [id: string]: number } = {};
  
  for (const list of LOCAL_BLOCKLISTS) {
    const domains = parseBlocklistContent(list.content, list.format);
    stats[list.id] = domains.length;
  }
  
  return stats;
}


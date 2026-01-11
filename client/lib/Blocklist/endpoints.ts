/**
 * Blocklist Endpoints Configuration
 * 
 * This file defines the external blocklist sources that will be fetched and parsed.
 * Supports EasyList, AdGuard, uBlock Origin, and simple domain list formats.
 * 
 * Add or remove endpoints as needed. The blocklist system will automatically
 * fetch and parse these on app initialization and periodic updates.
 */

export interface BlocklistEndpoint {
  /** Unique identifier for this endpoint */
  id: string;
  /** Display name for the blocklist */
  name: string;
  /** URL to fetch the blocklist from */
  url: string;
  /** Whether this endpoint is enabled */
  enabled: boolean;
  /** Format type: 'easylist' | 'adguard' | 'domains' | 'hosts' */
  format: 'easylist' | 'adguard' | 'domains' | 'hosts';
  /** Optional description */
  description?: string;
}

/**
 * Default blocklist endpoints
 * These are well-known public blocklists that follow standard formats
 */
export const DEFAULT_BLOCKLIST_ENDPOINTS: BlocklistEndpoint[] = [
  {
    id: 'easylist',
    name: 'EasyList',
    url: 'https://easylist.to/easylist/easylist.txt',
    enabled: true,
    format: 'easylist',
    description: 'Primary adblock filter list',
  },
  {
    id: 'easyprivacy',
    name: 'EasyPrivacy',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    enabled: true,
    format: 'easylist',
    description: 'Privacy protection filter list',
  },
  {
    id: 'adguard-base',
    name: 'AdGuard Base Filter',
    url: 'https://filters.adtidy.org/extension/chromium/filters/2.txt',
    enabled: false,
    format: 'adguard',
    description: 'AdGuard base ad-blocking filter',
  },
  {
    id: 'adguard-tracking',
    name: 'AdGuard Tracking Protection',
    url: 'https://filters.adtidy.org/extension/chromium/filters/3.txt',
    enabled: false,
    format: 'adguard',
    description: 'AdGuard tracking protection filter',
  },
  {
    id: 'peter-lowe',
    name: "Peter Lowe's Ad and Tracking Server List",
    url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext',
    enabled: true,
    format: 'hosts',
    description: 'Simple hosts-format blocklist',
  },
  {
    id: 'steven-black',
    name: 'Steven Black Unified Hosts',
    url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
    enabled: false,
    format: 'hosts',
    description: 'Comprehensive hosts file blocking ads, malware, and more',
  },
  {
    id: 'malware-domains',
    name: 'Malware Domain List',
    url: 'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt',
    enabled: true,
    format: 'easylist',
    description: 'Protection against malware domains',
  },
  {
    id: 'fanboy-annoyance',
    name: 'Fanboy Annoyance List',
    url: 'https://easylist.to/easylist/fanboy-annoyance.txt',
    enabled: false,
    format: 'easylist',
    description: 'Blocks social media content, in-page pop-ups, and other annoyances',
  },
];

/**
 * User-configurable custom endpoints
 * Users can add their own blocklist sources here
 */
export const CUSTOM_BLOCKLIST_ENDPOINTS: BlocklistEndpoint[] = [
  // Add your custom blocklist endpoints here
  // Example:
  // {
  //   id: 'my-custom-list',
  //   name: 'My Custom Blocklist',
  //   url: 'https://example.com/my-blocklist.txt',
  //   enabled: true,
  //   format: 'domains',
  //   description: 'My personal blocklist',
  // },
];

/**
 * Get all enabled blocklist endpoints
 */
export function getEnabledEndpoints(): BlocklistEndpoint[] {
  return [...DEFAULT_BLOCKLIST_ENDPOINTS, ...CUSTOM_BLOCKLIST_ENDPOINTS]
    .filter(endpoint => endpoint.enabled);
}

/**
 * Get all blocklist endpoints (enabled and disabled)
 */
export function getAllEndpoints(): BlocklistEndpoint[] {
  return [...DEFAULT_BLOCKLIST_ENDPOINTS, ...CUSTOM_BLOCKLIST_ENDPOINTS];
}


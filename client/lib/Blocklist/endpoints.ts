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
  //   {
  //   id: 'adguard-annoyance',
  //   name: ' Adguard Annoyance',
  //   url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_14_Annoyances/filter.txt',
  //   enabled: true,
  //   format: 'easylist',
  //   description: 'Primary adblock filter list',
  // },
  // {
  //   id: 'adguard',
  //   name: 'adguard',
  //   url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_2_Base/filter.txt',
  //   enabled: true,
  //   format: 'easylist',
  //   description: 'Primary adblock filter list',
  // },
  {
    id: 'adult-nsfw-list-1',
    name: 'Adult NSFW List 1',
    url: 'https://raw.githubusercontent.com/easylist/easylist/master/easylist_adult/adult_adservers.txt',
    enabled: true,
    format: 'easylist',
    description: 'Primary adblock filter list',
  },
  {
    id: 'adult-nsfw-list-2',
    name: 'Adult NSFW List 2',
    url: 'https://raw.githubusercontent.com/easylist/easylist/refs/heads/master/easylist_adult/adult_specific_block.txt',
    enabled: true,
    format: 'easylist',
    description: 'Primary adblock filter list',
  },
  // {
  //   id: '1Hosts-Extra',
  //   name: '1Hosts-Extra',
  //   url: 'https://raw.githubusercontent.com/badmojr/1Hosts/master/Xtra/domains.wildcards', // Replace with actual URL
  //   enabled: true,
  //   format: 'hosts',
  //   description: 'Traditional hosts file format blocklist',
  // }, 
  // {
  //   id: '1Hosts',
  //   name: '1Hosts',
  //   url: 'https://raw.githubusercontent.com/badmojr/1Hosts/master/Lite/domains.wildcards', // Replace with actual URL
  //   enabled: true,
  //   format: 'hosts',
  //   description: 'Traditional hosts file format blocklist',
  // }, 
  // {
  //   id: 'Sinfonietta',
  //   name: 'Sinfonietta',
  //   url: 'https://raw.githubusercontent.com/Sinfonietta/hostfiles/refs/heads/master/pornography-hosts', // Replace with actual URL
  //   enabled: true,
  //   format: 'hosts',
  //   description: 'Traditional hosts file format blocklist',
  // },  
  // {
  //   id: 'ShadowWhisperer',
  //   name: 'ShadowWhisperer',
  //   url: 'https://raw.githubusercontent.com/ShadowWhisperer/BlockLists/refs/heads/master/Lists/Adult',
  //   enabled: true,
  //   format: 'domains',
  //   description: 'Primary adblock filter list',
  // },
  // {
  //   id: 'nsfw.hagzei2',
  //   name: 'nsfw.hagzei2',
  //   url: 'https://filters.adavoid.org/ultimate-ad-filter.txt',
  //   enabled: true,
  //   format: 'easylist',
  //   description: 'Primary adblock filter list',
  // }, 
  {
    id: 'nsfw.hagzei',
    name: 'nsfw.hagzei',
    url: 'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/nsfw.txt',
    enabled: true,
    format: 'easylist',
    description: 'Primary adblock filter list',
  },
  {
    id: 'nsfw.oisd',
    name: 'nsfw.oisd',
    url: 'https://nsfw.oisd.nl/',
    enabled: true,
    format: 'easylist',
    description: 'Primary adblock filter list',
  },
  // {
  //   id: 'easylist',
  //   name: 'EasyList',
  //   url: 'https://easylist.to/easylist/easylist.txt',
  //   enabled: true,
  //   format: 'easylist',
  //   description: 'Primary adblock filter list',
  // },
  // {
  //   id: 'easyprivacy',
  //   name: 'EasyPrivacy',
  //   url: 'https://easylist.to/easylist/easyprivacy.txt',
  //   enabled: true,
  //   format: 'easylist',
  //   description: 'Privacy protection filter list',
  // },
  // {
  //   id: 'adguard-base',
  //   name: 'AdGuard Base Filter',
  //   url: 'https://filters.adtidy.org/extension/chromium/filters/2.txt',
  //   enabled: false,
  //   format: 'adguard',
  //   description: 'AdGuard base ad-blocking filter',
  // },
  // {
  //   id: 'peter-lowe',
  //   name: "Peter Lowe's Ad and Tracking Server List",
  //   url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext',
  //   enabled: true,
  //   format: 'hosts',
  //   description: 'Simple hosts-format blocklist',
  // },
  // {
  //   id: 'steven-black',
  //   name: 'Steven Black Unified Hosts',
  //   url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
  //   enabled: false,
  //   format: 'hosts',
  //   description: 'Comprehensive hosts file blocking ads, malware, and more',
  // },
  // {
  //   id: 'malware-domains',
  //   name: 'Malware Domain List',
  //   url: 'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt',
  //   enabled: true,
  //   format: 'easylist',
  //   description: 'Protection against malware domains',
  // },
  // {
  //   id: 'fanboy-annoyance',
  //   name: 'Fanboy Annoyance List',
  //   url: 'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
  //   enabled: true,
  //   format: 'easylist',
  //   description: 'Blocks pop-ups, floating elements, scroll-triggered boxes, and other annoyances',
  // },
  // {
  //   id: 'fanboy-social',
  //   name: 'Fanboy Social List',
  //   url: 'https://secure.fanboy.co.nz/fanboy-social.txt',
  //   enabled: true,
  //   format: 'easylist',
  //   description: 'Blocks social media buttons, widgets, and related content',
  // }
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


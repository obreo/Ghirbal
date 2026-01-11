/**
 * Blocklist Format Parsers
 * 
 * Supports parsing various blocklist formats:
 * - EasyList / Adblock Plus format
 * - AdGuard format
 * - Simple domain list format
 * - Hosts file format
 */

import type { BlocklistEndpoint } from './endpoints';

/**
 * Parse EasyList/Adblock Plus format
 * Extracts domain-based blocking rules from filter lists
 * 
 * Supported patterns:
 * - ||domain.com^ (block domain and subdomains)
 * - ||domain.com/ (block domain)
 * - ||domain.com$ (block domain with options)
 * 
 * Ignores:
 * - Comments (lines starting with !)
 * - Metadata (lines starting with [)
 * - Exception rules (@@)
 * - Element hiding rules (##, #@#, #?#)
 * - Specific URL path rules
 * - Regex rules
 */
export function parseEasyListFormat(content: string): string[] {
  const domains: Set<string> = new Set();
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines
    if (!line) continue;

    // Skip comments and metadata
    if (line.startsWith('!') || line.startsWith('[')) continue;

    // Skip exception rules
    if (line.startsWith('@@')) continue;

    // Skip element hiding rules
    if (line.includes('##') || line.includes('#@#') || line.includes('#?#')) continue;

    // Skip regex rules
    if (line.startsWith('/') && line.endsWith('/')) continue;

    // Look for domain blocking patterns: ||domain.com^
    const domainBlockMatch = line.match(/^\|\|([a-zA-Z0-9][-a-zA-Z0-9._]*[a-zA-Z0-9])[\^/$]/);
    if (domainBlockMatch) {
      const domain = domainBlockMatch[1].toLowerCase();
      // Skip if it looks like a partial domain or has wildcards
      if (!domain.includes('*') && domain.includes('.')) {
        domains.add(domain);
      }
      continue;
    }

    // Alternative pattern: ||domain.com (without suffix)
    const simpleDomainMatch = line.match(/^\|\|([a-zA-Z0-9][-a-zA-Z0-9._]*\.[a-zA-Z]{2,})$/);
    if (simpleDomainMatch) {
      const domain = simpleDomainMatch[1].toLowerCase();
      if (!domain.includes('*')) {
        domains.add(domain);
      }
      continue;
    }

    // Pattern with options: ||domain.com$third-party,image
    const domainWithOptionsMatch = line.match(/^\|\|([a-zA-Z0-9][-a-zA-Z0-9._]*[a-zA-Z0-9])\$/);
    if (domainWithOptionsMatch) {
      const domain = domainWithOptionsMatch[1].toLowerCase();
      if (!domain.includes('*') && domain.includes('.')) {
        domains.add(domain);
      }
    }
  }

  return Array.from(domains);
}

/**
 * Parse AdGuard format (similar to EasyList with extensions)
 * AdGuard uses the same base syntax as EasyList/Adblock Plus
 */
export function parseAdGuardFormat(content: string): string[] {
  // AdGuard format is largely compatible with EasyList
  // The main additions are:
  // - $important modifier
  // - Extended CSS selectors
  // - JavaScript rules
  // These don't affect domain extraction, so we use the same parser
  return parseEasyListFormat(content);
}

/**
 * Parse simple domain list format (one domain per line)
 */
export function parseDomainsFormat(content: string): string[] {
  const domains: Set<string> = new Set();
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;

    // Skip lines that look like filter rules
    if (line.startsWith('||') || line.includes('##') || line.startsWith('@@')) continue;

    // Validate it looks like a domain
    const domainPattern = /^[a-zA-Z0-9][-a-zA-Z0-9._]*\.[a-zA-Z]{2,}$/;
    if (domainPattern.test(line)) {
      domains.add(line.toLowerCase());
    }
  }

  return Array.from(domains);
}

/**
 * Parse hosts file format (e.g., "0.0.0.0 domain.com" or "127.0.0.1 domain.com")
 */
export function parseHostsFormat(content: string): string[] {
  const domains: Set<string> = new Set();
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Match hosts format: IP address followed by domain
    const hostsMatch = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([a-zA-Z0-9][-a-zA-Z0-9._]*[a-zA-Z0-9])$/);
    if (hostsMatch) {
      const domain = hostsMatch[1].toLowerCase();
      // Skip localhost entries
      if (domain !== 'localhost' && domain !== 'localhost.localdomain' && domain.includes('.')) {
        domains.add(domain);
      }
    }
  }

  return Array.from(domains);
}

/**
 * Auto-detect and parse blocklist content
 */
export function parseBlocklistContent(
  content: string, 
  formatHint?: BlocklistEndpoint['format']
): string[] {
  // If format is specified, use it
  if (formatHint) {
    switch (formatHint) {
      case 'easylist':
        return parseEasyListFormat(content);
      case 'adguard':
        return parseAdGuardFormat(content);
      case 'hosts':
        return parseHostsFormat(content);
      case 'domains':
        return parseDomainsFormat(content);
    }
  }

  // Auto-detect format based on content
  const firstLines = content.split('\n').slice(0, 20).join('\n');

  // Check for EasyList/Adblock Plus header
  if (firstLines.includes('[Adblock') || firstLines.includes('! Title:')) {
    return parseEasyListFormat(content);
  }

  // Check for hosts file format
  if (firstLines.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+/m)) {
    return parseHostsFormat(content);
  }

  // Check for domain block patterns
  if (firstLines.includes('||') && firstLines.includes('^')) {
    return parseEasyListFormat(content);
  }

  // Default to simple domain list
  return parseDomainsFormat(content);
}


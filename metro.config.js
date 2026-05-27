// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');

// Resolve the real path in case we're running from a symlink/junction (e.g. mklink on Windows)
const projectRoot = fs.realpathSync(__dirname);

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Bust Metro's file-transform cache when the build directory changes.
// EAS local builds each run from a different temp directory; without this,
// Metro reuses cached transforms that have the previous build's absolute
// path hardcoded as the @/ alias target, causing "Unable to resolve module" errors.
config.cacheVersion = projectRoot;

module.exports = config;
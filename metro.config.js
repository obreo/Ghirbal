// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');

// Resolve the real path in case we're running from a symlink/junction (e.g. mklink on Windows)
const projectRoot = fs.realpathSync(__dirname);

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

module.exports = config;
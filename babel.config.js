const fs = require("fs");
const path = require("path");

module.exports = function (api) {
  // Cache keyed on the real working directory so EAS local builds in different
  // temp directories each get a fresh config (avoids stale @/ alias paths).
  const projectRoot = fs.realpathSync(process.cwd());
  api.cache.using(() => projectRoot);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: [projectRoot],
          alias: {
            "@": path.join(projectRoot, "client"),
            "@shared": path.join(projectRoot, "shared"),
          },
          extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};

const fs = require("fs");
const path = require("path");

module.exports = function (api) {
  api.cache(true);

  // Resolve real path in case running from a symlink/junction (e.g. mklink on Windows)
  const projectRoot = fs.realpathSync(process.cwd());

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

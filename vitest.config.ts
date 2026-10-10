import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // Paseo injects this module at runtime; tests need a real file to resolve.
      {
        find: /^@getpaseo\/plugin\/client\/react-native$/,
        replacement: path.resolve(import.meta.dirname, "tests/doubles/plugin-react-native.tsx"),
      },
      // Route React Native to react-native-web, as Metro does for web bundles.
      { find: /^react-native$/, replacement: "react-native-web" },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    maxWorkers: 2,
    restoreMocks: true,
  },
});

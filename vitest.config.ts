import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Route React Native to react-native-web, as Metro does for web bundles.
    alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    maxWorkers: 2,
  },
});

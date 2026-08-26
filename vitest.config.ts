import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Integration tests share one seeded database; run files sequentially so
    // scratch fixtures in one file can never race another file's assertions.
    fileParallelism: false,
    setupFiles: ["tests/setup/env.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/services/**", "src/lib/**"],
      exclude: [
        "src/lib/prisma.ts", // client bootstrap, no logic
        "src/lib/api-client.ts", // browser-only (localStorage)
        "src/lib/utils.ts", // shadcn cn() helper
      ],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
    },
  },
});

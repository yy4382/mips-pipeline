import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/lib/simulator/**/*.ts"],
    },
  },
});

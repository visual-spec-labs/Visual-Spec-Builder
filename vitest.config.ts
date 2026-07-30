import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 테스트는 test/ 아래에만 둔다
    include: ["test/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});

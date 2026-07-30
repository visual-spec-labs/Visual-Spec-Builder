import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // tsconfig의 paths와 같은 규칙을 유지한다. 한쪽만 바꾸면 테스트가 깨진다.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // 테스트는 test/ 아래에만 둔다
    include: ["test/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});

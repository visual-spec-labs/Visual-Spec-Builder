import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // tsconfig의 paths, vitest.config의 alias와 같은 규칙을 유지한다.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

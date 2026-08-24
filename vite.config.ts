import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

import { THEME_STORAGE_KEY } from "./src/features/editor/ui/theme-storage";

/**
 * 첫 페인트 전에 저장된 테마를 <html data-theme>로 적용해 FOUC를 방지한다.
 * localStorage 키는 THEME_STORAGE_KEY 단일 소스에서 가져와 중복을 없앤다.
 */
function themeFoucPlugin(): Plugin {
  const key = JSON.stringify(THEME_STORAGE_KEY);
  const script = `try{if(localStorage.getItem(${key})==="dark"){document.documentElement.dataset.theme="dark"}}catch(e){}`;
  return {
    name: "theme-fouc",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          children: script,
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [themeFoucPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      // tsconfig의 paths, vitest.config의 alias와 같은 규칙을 유지한다.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

import { THEME_STORAGE_KEY } from "./src/features/editor/ui/theme-storage";
import {
  createWorkspaceMiddleware,
  ensureWorkspaceDirs,
  resolveWorkspaceRoot,
} from "./src/features/workspace/workspaceServer";

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

/**
 * `.visual-spec/` 작업공간을 GUI에 열어주는 파일 입출력 미들웨어(이슈 #133).
 *
 * 껍데기만 여기 두고 알맹이는 `src/features/workspace/`에 있다 — 경로 검증을 순수
 * 함수로 떼어내야 단위 테스트가 되고(vitest environment가 `node`다), 미들웨어 자체도
 * 실제 http 서버에 물려 통합 테스트할 수 있다. 라우트 목록과 설계 근거는
 * `workspaceServer.ts` 상단 주석에 있다.
 *
 * `apply: "serve"` — 개발 서버 전용이다. `vite build` 결과물에는 파일을 읽고 쓸 서버가
 * 없다(그쪽에서는 GUI가 브라우저 파일 다이얼로그·다운로드로 되돌아간다).
 */
function workspaceFilesPlugin(): Plugin {
  return {
    name: "visual-spec-workspace-files",
    apply: "serve",
    configureServer(server) {
      const workspaceRoot = resolveWorkspaceRoot(server.config.root);
      ensureWorkspaceDirs(workspaceRoot);
      server.config.logger.info(`  ➜  작업공간:  ${workspaceRoot}`);
      // configureServer 안에서 바로 use하면 Vite 내부 미들웨어보다 **앞**에 들어간다.
      // 뒤(= 반환 함수 안에서 등록)에 두면 SPA 폴백이 먼저 걸려 우리 라우트가
      // index.html로 덮인다.
      server.middlewares.use(createWorkspaceMiddleware(workspaceRoot));
    },
  };
}

export default defineConfig({
  plugins: [themeFoucPlugin(), workspaceFilesPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      // tsconfig의 paths, vitest.config의 alias와 같은 규칙을 유지한다.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

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
export function workspaceFilesPlugin(): Plugin {
  return {
    name: "visual-spec-workspace-files",
    apply: "serve",
    configureServer(server) {
      const workspaceRoot = resolveWorkspaceRoot(server.config.root);
      ensureWorkspaceDirs(workspaceRoot);
      server.config.logger.info(`  ➜  작업공간:  ${workspaceRoot}`);
      // configureServer 안에서 **바로** use하면 Vite 8의 미들웨어 사이 이 자리에 들어간다
      // (`vite/dist/node/chunks/node.js`의 `_createServer` 등록 순서를 읽고 실제 서버에
      // raw HTTP를 보내 확인했다):
      //
      //   rejectInvalidRequest → cors → hostValidation → [여기] → transform → … → SPA 폴백
      //
      // 뒤(= 반환 함수 안에서 등록)로 미루면 SPA 폴백이 먼저 걸려 우리 라우트가
      // index.html로 덮인다. 그래서 위치는 이대로 둔다.
      //
      // 이 자리가 Vite의 보안 두 겹(cors·hostValidation) **뒤**라는 점에 기대지는
      // 않는다 — 그 두 겹은 설정에 따라 등록조차 되지 않고, 교차 출처 쓰기를 실제로
      // 막아 주는 것은 서버가 아니라 브라우저였다. 미들웨어가 스스로 Host·Origin을
      // 보는 이유와 실측 결과는 `src/features/workspace/requestOrigin.ts` 상단에 있다.
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

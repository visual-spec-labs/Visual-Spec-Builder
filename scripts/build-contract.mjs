// 스킬·CLI가 쓰는 로컬 검증기 번들을 만든다 — 이슈 #278.
//
// 사용자 프로젝트의 에이전트는 이 저장소의 `@/features/editor/schema`를 import할 수 없고,
// GitHub develop 원문을 읽으면 설치한 패키지와 버전이 어긋난다. 그래서 앱과 **같은**
// 검증기(`validateProjectSpec`·`validateVisualSpec`·`migrateToV03`)를 순수 JS 한 파일로
// 묶어 `bin/lib/schema.mjs`에 둔다. `visual-spec validate`가 이 파일을 쓴다.
//
// 생성물은 저장소에 커밋한다 — `npx visual-spec`은 빌드 없이 바로 실행돼야 한다
// (bin/visual-spec.mjs 상단 주석). 소스와 어긋나지 않는지는 test/contract-bundle.test.ts가
// 같은 빌드를 다시 돌려 비교한다. 재생성: pnpm generate:contract
//
// `ajv`는 번들에 넣지 않는다 — 이 패키지의 런타임 의존성이라 설치본에서 그대로 풀린다.

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT_BUNDLE_PATH = resolve(projectRoot, "bin/lib/schema.mjs");

const BANNER = [
  "// 이 파일은 src/features/editor/schema 에서 자동 생성됩니다(이슈 #278).",
  "// 손으로 수정하지 마세요. 재생성: pnpm generate:contract",
  "",
].join("\n");

/** 번들 내용을 문자열로 돌려준다. 쓰지는 않는다 — 테스트가 커밋된 파일과 비교한다. */
export async function buildContractBundle() {
  const result = await build({
    root: projectRoot,
    configFile: false,
    logLevel: "warn",
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve(projectRoot, "src/features/editor/schema/index.ts"),
        formats: ["es"],
        fileName: "schema",
      },
      // 앱 소스는 번들러 해석에 맞춰 `ajv/dist/2020`으로 import한다. Node ESM은 확장자 없는
      // 하위 경로를 찾지 못하므로 번들 출력에서만 실제 파일 경로로 바꾼다.
      rollupOptions: { external: [/^ajv(\/|$)/], output: { paths: { "ajv/dist/2020": "ajv/dist/2020.js" } } },
    },
  });
  const output = (Array.isArray(result) ? result[0] : result).output;
  const chunk = output.find((item) => item.type === "chunk" && item.isEntry);
  if (!chunk) throw new Error("검증기 번들을 만들지 못했습니다.");
  return BANNER + chunk.code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeFile(CONTRACT_BUNDLE_PATH, await buildContractBundle());
  console.log(`생성함 ${CONTRACT_BUNDLE_PATH}`);
}

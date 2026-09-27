/**
 * 생성된 React 코드를 읽어 검증하고 ZIP으로 내려받는다 (이슈 #157).
 *
 * 판단은 전부 `export/` 아래 순수 함수가 한다. 이 파일은 **작업공간에서 읽어오고
 * 브라우저 다운로드를 트리거하는 부수효과**만 맡는다 — `exportSpecAsJson.ts`가
 * `store/exportSpec.ts`를 감싸는 것과 같은 구조다.
 *
 * ## 왜 ZIP 다운로드인가 (결과 폴더의 위치)
 *
 * 02-mvp-scope.md는 "결과 폴더로 내보내기"라고만 적고 위치를 정하지 않았다. 셋 중
 * **브라우저 다운로드**를 골랐다.
 *
 * - `.visual-spec/generated/`를 그대로 결과물로 보는 안은 02의 "결과물 원칙"을
 *   못 채운다 — package.json·README·assets가 함께 있어야 하는데 그 폴더에는 없다
 * - 사용자가 고른 임의 경로에 직접 쓰는 안은 **작업공간 밖 쓰기**를 여는 일이다.
 *   PR #145의 미들웨어는 "작업공간 밖으로 한 발짝도 못 나간다"를 위협 모델로 삼고
 *   문자열·realpath 두 단계로 막는다(`workspacePath.ts`·`workspaceServer.ts`).
 *   내보내기 편의를 위해 그 방어를 되돌릴 이유가 없다
 * - 다운로드는 브라우저가 사용자에게 저장 위치를 묻는 기존 경로라 **서버에 새 권한을
 *   열지 않는다.** 02가 이미 "기존 프로젝트 자동 병합"을 제외하고 사용자가 직접
 *   통합한다고 못박아 둔 것과도 맞는다
 */

import type { ScreenSpec } from "@/features/editor/schema";
import { buildBundleEntries, bundleFileName, type BundleAsset } from "@/features/editor/export/bundle";
import {
  verifyGenerated,
  type GeneratedFile,
  type VerifyReport,
} from "@/features/editor/export/verifyGenerated";
import { createZip } from "@/features/editor/export/zip";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import {
  listWorkspaceFiles,
  readWorkspaceBinaryFile,
  readWorkspaceTextFile,
} from "@/features/editor/ui/workspaceClient";
import { ASSET_DIR, GENERATED_DIR } from "@/features/workspace/protocol";

/**
 * 훑기 결과.
 *
 * 작업공간이 없는 경우를 "파일 0개"와 **섞지 않는다** — 전자는 `pnpm dev` 없이 빌드
 * 결과물을 연 경우라 사용자가 할 일이 다르고, 후자는 아직 에이전트가 코드를 만들지
 * 않은 **정상 상태**다(#156이 A안으로 정리했다).
 */
export type GeneratedScan =
  | { kind: "no-workspace" }
  | { kind: "ready"; files: GeneratedFile[]; report: VerifyReport };

export async function scanGeneratedCode(page: ScreenSpec): Promise<GeneratedScan> {
  const paths = await listWorkspaceFiles(GENERATED_DIR, { recursive: true });
  if (paths === null) return { kind: "no-workspace" };

  const files: GeneratedFile[] = [];
  for (const path of paths) {
    const content = await readWorkspaceTextFile(`${GENERATED_DIR}/${path}`);
    // 목록에는 있는데 읽히지 않는 파일은 건너뛴다 — 그 경우 티켓 커버리지 검사가
    // "없다"로 잡아 주므로 여기서 따로 알릴 것이 없다.
    if (content !== null) files.push({ path, content });
  }

  const assetNames = (await listWorkspaceFiles(ASSET_DIR)) ?? [];

  return {
    kind: "ready",
    files,
    report: verifyGenerated({ files, tickets: compileTickets(page), assetNames }),
  };
}

/** 검증이 실제로 있다고 확인한 이미지만 가져온다. 못 읽으면 조용히 뺀다. */
async function loadAssets(names: string[]): Promise<BundleAsset[]> {
  const assets: BundleAsset[] = [];
  for (const name of names) {
    const bytes = await readWorkspaceBinaryFile(`${ASSET_DIR}/${name}`);
    if (bytes !== null) assets.push({ name, bytes });
  }
  return assets;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * 결과 폴더를 ZIP 하나로 내려받는다.
 *
 * **오류가 있어도 막지 않는다.** 스펙 JSON Export가 검증 실패 시 다운로드를 취소하는
 * 것과 다른데, 그쪽은 스키마를 어긴 파일이 나가면 다시 열 수조차 없기 때문이다.
 * 여기서 잡는 것은 "import가 한 군데 깨졌다" 같은 것이라 손으로 고치면 되고, 내려받지
 * 못하게 하면 고칠 파일을 꺼낼 방법이 없어진다. 대신 무엇이 문제인지는 패널과 함께
 * 담기는 README에 그대로 적는다.
 */
export async function downloadGeneratedBundle(
  projectName: string,
  files: GeneratedFile[],
  report: VerifyReport,
): Promise<void> {
  const assets = await loadAssets(report.usedAssets);
  const zip = createZip(buildBundleEntries({ projectName, files, assets, report }));
  downloadBlob(bundleFileName(projectName), new Blob([zip], { type: "application/zip" }));
}

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

import type { PageId, ScreenSpec } from "@/features/editor/schema";
import { buildBundleEntries, bundleFileName, type BundleAsset } from "@/features/editor/export/bundle";
import {
  classifyOutputFreshness,
  GENERATION_MANIFEST_PATH,
  parseGenerationManifest,
  type FreshnessReport,
  type GenerationManifest,
} from "@/features/editor/export/generationManifest";
import { isLegacyGeneratedPath, pageOutputRoot, relativeToRoot } from "@/features/editor/export/generationIdentity";
import {
  verifyGenerated,
  type GeneratedFile,
  type VerifyReport,
} from "@/features/editor/export/verifyGenerated";
import type { Ticket } from "@/features/editor/ticket/types";
import { createZip } from "@/features/editor/export/zip";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import { findGenerationProject, unregisteredOutputDir } from "@/features/editor/ui/generationTarget";
import {
  listWorkspaceFiles,
  readWorkspaceBinaryFile,
  readWorkspaceTextFile,
} from "@/features/editor/ui/workspaceClient";
import { ASSET_DIR, GENERATED_DIR } from "@/features/workspace/protocol";

/**
 * Export가 훑은 자리(#281).
 *
 * - `project` 이 페이지의 생성 자리 `generated/<프로젝트 폴더>/<PageId>/`. `projectId`가 null이면 아직 GUI가
 *   전달한 적 없는 프로젝트의 후보 폴더(직접 실행한 to-react 출력)라 어떤 파일도 "현재"가 될 수 없다
 * - `legacy` #281 전 배치(`generated/pages/…`·`generated/components/…`). 이 페이지의 자리가 비어 있고 이전
 *   배치 파일만 있을 때 호환을 위해 보인다. 어느 프로젝트의 것인지 모르므로 최신으로 인정하지 않는다
 * - `unassigned` 이 문서는 아직 생성 자리가 없다(저장하지 않았고 전달한 적도 없다)
 * - `all` 페이지를 주지 않은 호출(성능 측정 스크립트) — 예전처럼 `generated/` 전체를 본다
 */
export type GeneratedLocation =
  | { layout: "project"; root: string; projectId: string | null }
  | { layout: "legacy" | "unassigned" | "all"; root: ""; projectId: null };

/** 생성하는 쪽의 신원 — `GenerationOwnerInput`에서 페이지를 뺀 것. */
export interface GeneratedScanOwner {
  fileName: string | null;
  documentId: number;
}

/**
 * 이 문서·페이지의 생성 자리를 찾는다(읽기만). 기록된 프로젝트의 자리, 없으면 아직 기록되지 않은 후보
 * 폴더. 그 자리가 비어 있고 이전 배치 파일이 있으면 이전 배치를 본다.
 */
function locateGenerated(
  manifest: GenerationManifest,
  paths: string[],
  owner: GeneratedScanOwner,
  pageId: PageId,
): GeneratedLocation {
  const registered = findGenerationProject(manifest, owner);
  const outputDir = registered?.outputDir ?? unregisteredOutputDir(manifest, owner.fileName);
  const project: GeneratedLocation | null = outputDir === null
    ? null
    : { layout: "project", root: pageOutputRoot(outputDir, pageId), projectId: registered?.projectId ?? null };
  if (project !== null && paths.some((path) => relativeToRoot(project.root, path) !== null)) return project;
  if (paths.some(isLegacyGeneratedPath)) return { layout: "legacy", root: "", projectId: null };
  return project ?? { layout: "unassigned", root: "", projectId: null };
}

/** 그 자리에서 Export·검증이 볼 경로인가. */
function inLocation(location: GeneratedLocation, path: string): boolean {
  if (location.layout === "all") return true;
  if (location.layout === "legacy") return isLegacyGeneratedPath(path);
  if (location.layout === "unassigned") return false;
  return relativeToRoot(location.root, path) !== null;
}

/**
 * 훑기 결과.
 *
 * 작업공간이 없는 경우를 "파일 0개"와 **섞지 않는다** — 전자는 `pnpm dev` 없이 빌드
 * 결과물을 연 경우라 사용자가 할 일이 다르고, 후자는 아직 에이전트가 코드를 만들지
 * 않은 **정상 상태**다(#156이 A안으로 정리했다).
 */
export type GeneratedScan =
  | { kind: "no-workspace" }
  | {
      kind: "ready";
      files: GeneratedFile[];
      report: VerifyReport;
      /**
       * 생성 세대 확인(#284). 파일·참조 검사(`report`)와 따로 둔다 — 4/4·오류 0이어도 취소된 요청의
       * 늦은 출력이거나 입력이 바뀐 뒤의 출력일 수 있다. `pageId`를 주지 않은 호출(성능 측정
       * 스크립트 등)에서는 계산하지 않는다.
       */
      freshness: FreshnessReport | null;
      /** 훑은 자리(#281). `files`의 경로는 이 자리 기준이라 ZIP 배치와 같다. */
      location: GeneratedLocation;
    };

/**
 * 이 페이지의 생성 자리를 훑는다. `files`·`report`는 자리 기준 경로(`pages/Home.tsx`)라 ZIP과 상대 import
 * 검사가 #157 그대로다. 생성 세대 판정은 `generated/` 기준 전체 경로와 수용 기록으로 한다.
 */
export async function scanGeneratedCode(
  page: ScreenSpec,
  pageId?: PageId,
  owner: GeneratedScanOwner = { fileName: null, documentId: -1 },
): Promise<GeneratedScan> {
  const paths = await listWorkspaceFiles(GENERATED_DIR, { recursive: true });
  if (paths === null) return { kind: "no-workspace" };

  // 기록이 없거나 읽히지 않으면 빈 기록으로 판정한다 — 파일이 있으면 "확인 불가"로 기운다.
  const manifest = pageId === undefined
    ? null
    : parseGenerationManifest(await readWorkspaceTextFile(GENERATION_MANIFEST_PATH));
  const location: GeneratedLocation = manifest === null || pageId === undefined
    ? { layout: "all", root: "", projectId: null }
    : locateGenerated(manifest, paths, owner, pageId);

  const generatedFiles: GeneratedFile[] = [];
  for (const path of paths.filter((candidate) => inLocation(location, candidate))) {
    const content = await readWorkspaceTextFile(`${GENERATED_DIR}/${path}`);
    // 목록에는 있는데 읽히지 않는 파일은 건너뛴다 — 그 경우 티켓 커버리지 검사가
    // "없다"로 잡아 주므로 여기서 따로 알릴 것이 없다.
    if (content !== null) generatedFiles.push({ path, content });
  }
  const files = generatedFiles.map((file) => ({ ...file, path: relativeToRoot(location.root, file.path) ?? file.path }));

  const assetNames = (await listWorkspaceFiles(ASSET_DIR)) ?? [];
  const tickets = compileTickets(page);
  const freshness = manifest === null || pageId === undefined
    ? null
    : classifyOutputFreshness({
        tickets,
        files: generatedFiles,
        manifest,
        projectId: location.projectId,
        pageId,
        page,
        root: location.root,
      });

  return {
    kind: "ready",
    files,
    report: verifyGenerated({ files, tickets, assetNames }),
    freshness,
    location,
  };
}

/** 최종 ZIP에 넣을 바이트를 읽고, 하나라도 실패하면 이름을 결과에 남긴다. */
export async function loadBundleAssets(
  names: string[],
  readAsset: (path: string) => Promise<Uint8Array | null> = readWorkspaceBinaryFile,
): Promise<{ assets: BundleAsset[]; missing: string[] }> {
  const assets: BundleAsset[] = [];
  const missing: string[] = [];
  for (const name of names) {
    try {
      const bytes = await readAsset(`${ASSET_DIR}/${name}`);
      if (bytes === null) missing.push(name);
      else assets.push({ name, bytes });
    } catch {
      missing.push(name);
    }
  }
  return { assets, missing };
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
 * 코드 검증 오류는 기존처럼 README에 적어 Export를 허용한다. 다만 검사 후 실제 자산
 * 바이트를 읽지 못하면 성공 ZIP을 만들지 않는다. 사용자가 명시적으로 부분 Export를
 * 고른 경우에만 읽힌 자산으로 보고서를 다시 만들어 누락을 README에 기록한다.
 */
export async function downloadGeneratedBundle(
  projectName: string,
  files: GeneratedFile[],
  report: VerifyReport,
  tickets: Ticket[],
  allowPartial = false,
): Promise<{ kind: "downloaded"; missing: string[] } | { kind: "missing-assets"; missing: string[] }> {
  const requiredAssets = [...new Set([...report.requiredAssets, ...report.usedAssets])]
    .sort((left, right) => left.localeCompare(right));
  const { assets, missing } = await loadBundleAssets(requiredAssets);
  if (missing.length > 0 && !allowPartial) return { kind: "missing-assets", missing };

  // ZIP에 실제 들어갈 파일 집합으로 재검증한다. 부분 Export의 README에도 누락 자산
  // 오류가 남아야 이후 사용자가 이미지가 없는 상태를 알아볼 수 있다.
  const verifiedBundle = verifyGenerated({
    files,
    tickets,
    assetNames: assets.map(({ name }) => name),
  });
  const bundleReport: VerifyReport = {
    ...verifiedBundle,
    issues: verifiedBundle.issues.map((issue) => issue.code === "missing-asset"
      ? {
          ...issue,
          message: `ZIP에 포함되지 않은 이미지입니다: ${issue.message.split(": ").at(-1)}`,
        }
      : issue),
  };
  const zip = createZip(buildBundleEntries({ projectName, files, assets, report: bundleReport }));
  downloadBlob(bundleFileName(projectName), new Blob([zip], { type: "application/zip" }));
  return { kind: "downloaded", missing };
}

/**
 * `.visual-spec/generated/`에 놓인 코드를 검증한다 — 순수 함수 (이슈 #157).
 *
 * ## 무엇을 보는가
 *
 * | 검사 | 근거 |
 * |---|---|
 * | 티켓마다 대응 파일이 있는가 | `compileTickets` + SKILL.md의 고정 경로 |
 * | `@/` 같은 별칭·절대 경로 import가 없는가 | 02-mvp-scope.md "결과물 원칙" |
 * | 상대 경로 import가 실제 파일을 가리키는가 | 같은 문서 — 내보낸 폴더가 혼자 동작해야 한다 |
 * | 상대 경로가 결과 폴더 밖으로 나가지 않는가 | 같은 이유 |
 * | `../assets/…` 참조가 작업공간 assets에 있는가 | 없으면 내보낸 폴더에서 그림이 깨진다 |
 *
 * ## 무엇을 못 보는가 — 일부러 안 하는 것
 *
 * - **타입 검사(`tsc`)**: 사용자 프로젝트의 tsconfig·React 타입 버전을 알아야 한다.
 *   그건 앱 밖의 정보라 브라우저 안에서 답을 낼 방법이 없다
 * - **lint·포매팅**: 대상 프로젝트 규칙에 달렸다. 여기서 정하면 틀린 잔소리가 된다
 * - **JSX가 스펙과 같은 화면을 그리는가**: 렌더 비교는 React Preview의 일인데
 *   02-mvp-scope.md가 MVP에서 뺐다(`localhost:4174` 취소선)
 * - **import 구문 자체의 문법**: 정규식으로 훑는 한계는 `importScan.ts` 상단 참고
 *
 * 못 보는 것은 감추지 않는다 — 화면 하단과 내보낸 README에 그대로 적는다.
 */

import type { Ticket } from "@/features/editor/ticket/types";

import {
  resolveRelativePath,
  resolveImportTarget,
  ticketFilePath,
} from "./generatedPaths";
import {
  classifySpecifier,
  assetImportName,
  packageNameOf,
  scanAssetReferences,
  scanImports,
} from "./importScan";

/** `generated/` 기준 상대 경로와 그 내용. */
export interface GeneratedFile {
  /** `pages/Home.tsx`. 항상 `/` 구분자. */
  path: string;
  content: string;
}

export type IssueCode =
  | "missing-file"
  | "alias-import"
  | "unresolved-import"
  | "escaping-import"
  | "missing-asset"
  | "extra-file";

/**
 * `error`는 내보낸 폴더가 그대로는 동작하지 않는다는 뜻이고, `info`는 알아둘 일이다.
 * 둘을 나누지 않으면 "티켓에 없는 파일이 하나 있다"가 "import가 깨졌다"와 같은
 * 무게로 보여서 진짜 문제가 묻힌다.
 */
export type IssueSeverity = "error" | "info";

export interface VerifyIssue {
  code: IssueCode;
  severity: IssueSeverity;
  /** 문제가 있는 파일(`generated/` 기준). 티켓 누락은 **있어야 했던** 경로다. */
  file: string;
  /** 소스 줄 번호. 파일 단위 문제면 없다. */
  line?: number;
  message: string;
}

export interface TicketCoverage {
  ticketId: string;
  componentName: string;
  /** 있어야 할 파일 경로. */
  expectedPath: string;
  found: boolean;
}

export interface VerifyReport {
  fileCount: number;
  coverage: TicketCoverage[];
  /** 커버된 티켓 수 — 화면 요약에 그대로 쓴다. */
  coveredCount: number;
  issues: VerifyIssue[];
  errorCount: number;
  /** bare import에서 모은 패키지 이름(정렬·중복 제거). package.json 후보다. */
  packages: string[];
  /** 파일 내용에서 참조한 이미지 이름. 파일 존재 여부와 무관하게 모두 담는다. */
  requiredAssets: string[];
  /** 실제로 작업공간 assets에 있는, 코드가 참조하는 파일 이름들. ZIP에 함께 담는다. */
  usedAssets: string[];
}

/** import를 훑을 대상. 나머지(.css·.json·.md)는 내보내기만 하고 검사하지 않는다. */
const CODE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

function isCodeFile(path: string): boolean {
  return CODE_EXTENSIONS.some((extension) => path.toLowerCase().endsWith(extension));
}

export interface VerifyInput {
  files: GeneratedFile[];
  tickets: Ticket[];
  /** `.visual-spec/assets/`의 파일 이름 목록. */
  assetNames: string[];
}

export function verifyGenerated({ files, tickets, assetNames }: VerifyInput): VerifyReport {
  const existingPaths = new Set(files.map((file) => file.path));
  const assets = new Set(assetNames);
  const issues: VerifyIssue[] = [];
  const packages = new Set<string>();
  const requiredAssets = new Set<string>();
  const usedAssets = new Set<string>();

  const coverage: TicketCoverage[] = tickets.map((ticket) => {
    const expectedPath = ticketFilePath(ticket);
    const found = existingPaths.has(expectedPath);
    if (!found) {
      issues.push({
        code: "missing-file",
        severity: "error",
        file: expectedPath,
        message: `티켓 ${ticket.componentName}에 해당하는 파일이 없습니다.`,
      });
    }
    return { ticketId: ticket.id, componentName: ticket.componentName, expectedPath, found };
  });

  // 티켓이 요구하지 않는 파일은 오류가 아니다 — SKILL.md는 반복되지 않는 하위 트리를
  // 부모에 인라인하되 판단에 따라 파일을 더 만드는 것도 허용한다. 다만 무엇이 함께
  // 나가는지는 보여 줘야 한다.
  const expectedPaths = new Set(coverage.map((entry) => entry.expectedPath));
  for (const file of files) {
    if (!expectedPaths.has(file.path)) {
      issues.push({
        code: "extra-file",
        severity: "info",
        file: file.path,
        message: "티켓에 없는 파일입니다. 내보내기에는 함께 담깁니다.",
      });
    }
  }

  for (const file of files) {
    if (!isCodeFile(file.path)) continue;

    for (const reference of scanImports(file.content)) {
      const kind = classifySpecifier(reference.specifier);

      if (kind === "package") {
        packages.add(packageNameOf(reference.specifier));
        continue;
      }
      if (kind === "alias") {
        issues.push({
          code: "alias-import",
          severity: "error",
          file: file.path,
          line: reference.line,
          message: `경로 별칭·절대 경로 import입니다: ${reference.specifier} — 상대 경로로 바꿔야 합니다.`,
        });
        continue;
      }

      // Static asset imports must resolve from this generated file to the ZIP root's
      // assets directory. A matching spelling alone is insufficient for nested paths.
      const assetName = assetImportName(reference.specifier);
      if (assetName !== null) {
        const assetPath = resolveRelativePath(file.path, reference.specifier);
        if (assetPath === null) {
          issues.push({
            code: "escaping-import",
            severity: "error",
            file: file.path,
            line: reference.line,
            message: `결과 폴더 밖을 가리킵니다: ${reference.specifier}`,
          });
          continue;
        }
        if (assetPath === `assets/${assetName}`) {
          requiredAssets.add(assetName);
          if (assets.has(assetName)) {
            usedAssets.add(assetName);
          } else {
            issues.push({
              code: "missing-asset",
              severity: "error",
              file: file.path,
              line: reference.line,
              message: `.visual-spec/assets/에 없는 이미지입니다: ${assetName}`,
            });
          }
          continue;
        }
        issues.push({
          code: "unresolved-import",
          severity: "error",
          file: file.path,
          line: reference.line,
          message: `ZIP의 assets/ 디렉터리를 가리키지 않습니다: ${reference.specifier}`,
        });
        continue;
      }

      const target = resolveImportTarget(file.path, reference.specifier, existingPaths);
      if (target.kind === "escaped") {
        issues.push({
          code: "escaping-import",
          severity: "error",
          file: file.path,
          line: reference.line,
          message: `결과 폴더 밖을 가리킵니다: ${reference.specifier}`,
        });
      } else if (target.kind === "missing") {
        issues.push({
          code: "unresolved-import",
          severity: "error",
          file: file.path,
          line: reference.line,
          message: `가리키는 파일이 없습니다: ${reference.specifier}`,
        });
      }
    }

    for (const name of scanAssetReferences(file.content, { includeStaticImports: false })) {
      requiredAssets.add(name);
      if (assets.has(name)) {
        usedAssets.add(name);
      } else {
        issues.push({
          code: "missing-asset",
          severity: "error",
          file: file.path,
          message: `.visual-spec/assets/에 없는 이미지입니다: ${name}`,
        });
      }
    }
  }

  return {
    fileCount: files.length,
    coverage,
    coveredCount: coverage.filter((entry) => entry.found).length,
    issues,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    packages: [...packages].sort((a, b) => a.localeCompare(b)),
    requiredAssets: [...requiredAssets].sort((a, b) => a.localeCompare(b)),
    usedAssets: [...usedAssets].sort((a, b) => a.localeCompare(b)),
  };
}

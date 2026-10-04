import { migrateToV03, validateProjectSpec } from "@/features/editor/schema";
import type { ProjectSpec } from "@/features/editor/schema";

/**
 * 작업 중인 프로젝트 전체를 저장하는 localStorage 키(이슈 #128).
 * ThemeProvider·theme-storage.ts와 같은 패턴 — 키 상수를 별도 파일에 두고
 * localStorage 접근은 항상 try/catch로 감싼다(프라이빗 모드·용량 초과 등으로
 * 언제든 실패할 수 있다).
 */
export const SPEC_STORAGE_KEY = "visual-spec:project";

/**
 * localStorage에 실제로 저장되는 값의 모양(이슈 #185).
 *
 * 처음(#128)엔 `ProjectSpec`을 그대로 저장했다. 그런데 "지금 이게 어느 파일인가"
 * (`documentStore.fileName`)는 spec 안에 없는 값이라 같이 안 묶으면 새로고침 뒤
 * 유실된다 — `spec.name`으로 되돌아가 PR #145가 고친 "고친 내용이 다른 파일로
 * 들어간다" 버그가 새로고침이라는 경로로 재발했다(#185). 그래서 파일명과 내용을
 * **하나의 값**으로 묶는다 — 따로 저장하면 한쪽만 쓰기에 성공하거나 서로 다른
 * 시점의 값이 섞여("이름은 A인데 내용은 B였을 때 것") 더 헷갈리는 불일치가 생긴다.
 */
export interface StoredDocument {
  /** `documentStore.fileName`과 같은 뜻 — null이면 그 세션엔 어느 파일도 아니었다. */
  fileName: string | null;
  spec: ProjectSpec;
}

/**
 * localStorage에서 저장된 문서(파일명+spec)를 읽고 검증한다. 두 로더가 공유한다.
 *
 * 다음 중 하나라도 해당하면 undefined다 — 저장된 값이 없다, JSON으로 파싱이 안
 * 된다, 봉투 모양이 아니다, `fileName`이 문자열도 null도 아니다, `spec`이
 * (`migrateToV03`로 0.3으로 바꾼 뒤에도) `validateProjectSpec`을 통과하지 못한다.
 * **#128 시절 저장된 옛 형태**(봉투 없이 `ProjectSpec`이 최상위)도 여기
 * 걸린다 — `spec` 필드가 없어 검증에 실패하고 조용히 폐기된다. 로컬 캐시일 뿐이라 한 번 seedSpec/`null`로 되돌아가는 것을
 * 감수한다 — `loadStoredSpec`이 이전부터 "스키마가 다른 값"을 같은 방식으로
 * 다뤄 온 것과 같은 취급이다.
 */
function readStoredDocument(): StoredDocument | undefined {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SPEC_STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;

  return parseStoredDocument(raw);
}

export function parseStoredDocument(raw: string | null): StoredDocument | undefined {
  if (raw === null) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (typeof parsed !== "object" || parsed === null) return undefined;
  const fileName = (parsed as Record<string, unknown>).fileName;
  if (fileName !== null && typeof fileName !== "string") return undefined;

  // 검증 전에 0.3으로 바꾼다(#127). 빠뜨리면 0.2 시절 자동 저장본이 아래 검증에서
  // 조용히 버려져, 갱신 직후 첫 실행에서 작업이 사라진다.
  const spec = migrateToV03((parsed as Record<string, unknown>).spec);
  const result = validateProjectSpec(spec);
  if (!result.valid) return undefined;

  return { fileName, spec: spec as ProjectSpec };
}

/**
 * localStorage에서 저장된 프로젝트 내용만 읽는다. 반환 계약은 #128 때 그대로다
 * (`ProjectSpec | undefined`) — `editorStore.ts`의
 * `loadStoredSpec() ?? migrateV01(seedSpec)` 줄을 이 변경 때문에 고칠 필요가 없다.
 */
export function loadStoredSpec(): ProjectSpec | undefined {
  return readRecovery()?.document.spec ?? readStoredDocument()?.spec;
}

/**
 * localStorage에 저장된 파일명을 읽는다(이슈 #185).
 *
 * `undefined`는 "저장된 게 아예 없거나 깨졌다"는 뜻이고(호출자가 `null`로
 * 대체한다), `null`은 "그 세션은 정상적으로 저장됐는데 그때 어느 파일도 아니었다"
 * 는 유효한 값이다 — `documentStore.fileName`의 `null`과 같은 뜻이다.
 */
export function loadStoredFileName(): string | null | undefined {
  const recovery = readRecovery();
  return recovery ? recovery.document.fileName : readStoredDocument()?.fileName;
}

/**
 * 현재 프로젝트와 파일명을 함께 localStorage에 저장한다(이슈 #128 → #185에서
 * `fileName` 추가).
 *
 * 접근 실패(프라이빗 모드, 저장 공간 초과, 브라우저 설정으로 차단된 경우 등)는
 * 조용히 무시한다 — 자동저장이 실패했다고 편집 자체를 막을 이유는 없다. 대신
 * File > Save(작업공간 쓰기 또는 다운로드)가 여전히 남아있다.
 *
 * **이 작업이 다루지 않는 것**: 워크스페이스 파일이 그 사이 밖에서(예: 에이전트가)
 * 바뀌었어도 이 함수는 그걸 모른다. Save는 원래도 항상 지금 화면의 내용으로 그
 * 파일을 덮어썼다 — 새로고침·이 저장 방식이 그 위험을 새로 만들거나 줄이지
 * 않는다. 외부 변경 감지·병합은 이 이슈의 범위 밖이다.
 */
export function saveSpecToStorage(spec: ProjectSpec, fileName: string | null): void {
  try {
    localStorage.setItem(SPEC_STORAGE_KEY, JSON.stringify({ fileName, spec }));
  } catch {
    /* 위 설명대로 조용히 무시한다. */
  }
}

/** Per-tab recovery survives reload without replacing another tab's autosave. */
export const RECOVERY_KEY = "visual-spec:tab-recovery";
export interface Recovery {
  document: StoredDocument;
  key: string;
  baseline: string | null;
  conflicted: boolean;
}
export function readRecovery(): Recovery | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) ?? "null");
    if (!value || typeof value.key !== "string" ||
      (value.baseline !== null && typeof value.baseline !== "string") ||
      typeof value.conflicted !== "boolean") return undefined;
    const document = parseStoredDocument(JSON.stringify(value.document));
    return document ? { ...value, document } : undefined;
  } catch { return undefined; }
}
export function writeRecovery(recovery: Recovery): boolean {
  try {
    sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(recovery));
    return true;
  } catch { return false; }
}
export function projectStorageKey(fileName: string | null, untitledId: string): string {
  return `visual-spec:autosave:${fileName === null ? `draft:${untitledId}` : `file:${fileName}`}`;
}

/** Rename publishes a redirect for old tabs; they must explicitly resolve their drafts. */
export function publishProjectRename(oldFileName: string, spec: ProjectSpec, newFileName: string): void {
  try {
    const raw = JSON.stringify({ fileName: newFileName, spec });
    localStorage.setItem(`${projectStorageKey(oldFileName, "")}:rename`, raw);
  } catch { /* Workspace rename already succeeded; in-memory document remains usable. */ }
}

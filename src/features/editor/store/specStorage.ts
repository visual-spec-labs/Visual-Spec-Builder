import { validateProjectSpec } from "@/features/editor/schema";
import type { ProjectSpec } from "@/features/editor/schema";

/**
 * 작업 중인 프로젝트 전체를 저장하는 localStorage 키(이슈 #128).
 * ThemeProvider·theme-storage.ts와 같은 패턴 — 키 상수를 별도 파일에 두고
 * localStorage 접근은 항상 try/catch로 감싼다(프라이빗 모드·용량 초과 등으로
 * 언제든 실패할 수 있다).
 */
export const SPEC_STORAGE_KEY = "visual-spec:project";

/**
 * localStorage에서 저장된 프로젝트를 읽는다.
 *
 * 다음 중 하나라도 해당하면 undefined를 돌려준다 — 호출자(editorStore.ts)가
 * seedSpec으로 대신 시작한다: 저장된 값이 없다, JSON으로 파싱이 안 된다,
 * `validateProjectSpec`을 통과하지 못한다(예: 이전 버전이 다른 스키마로 저장한
 * 값, 수동으로 손댄 값), localStorage 자체에 접근할 수 없다(프라이빗 모드,
 * Node 테스트 환경처럼 API가 아예 없는 경우 포함).
 *
 * 검증까지 거치는 이유 — 깨진 값을 그대로 스토어에 앉히면 그 뒤 모든 동작이
 * "유효한 ProjectSpec"을 전제로 하는 코드(예: pageOrder가 최소 1개라고 가정하는
 * asPageOrder)에서 예기치 않게 죽는다. seedSpec으로 안전하게 대체하는 편이 낫다.
 */
export function loadStoredSpec(): ProjectSpec | undefined {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SPEC_STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  const result = validateProjectSpec(parsed);
  return result.valid ? (parsed as ProjectSpec) : undefined;
}

/**
 * 현재 프로젝트를 localStorage에 저장한다.
 *
 * 접근 실패(프라이빗 모드, 저장 공간 초과, 브라우저 설정으로 차단된 경우 등)는
 * 조용히 무시한다 — 자동저장이 실패했다고 편집 자체를 막을 이유는 없다. 대신
 * File > Save(수동 다운로드)가 여전히 남아있다.
 */
export function saveSpecToStorage(spec: ProjectSpec): void {
  try {
    localStorage.setItem(SPEC_STORAGE_KEY, JSON.stringify(spec));
  } catch {
    /* 위 설명대로 조용히 무시한다. */
  }
}

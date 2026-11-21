import { validateProjectSpec, type PageId, type ProjectSpec, type ScreenSpec } from '@/features/editor/schema';

/**
 * 자연어 응답이 **프로젝트에 페이지 한 장을 더하는** 명령 (이슈 #497).
 *
 * 화면 Command(`applyCommand`)는 `ScreenSpec` 한 장만 안다 — 페이지 목록을 아예 모르므로
 * "새 페이지"는 Command 배열로 표현되지 않는다(docs/08 3.4-(2)). 그래서 위젯 추출·배치와
 * 같은 자리인 `projectCommand` 경로로 받는다. 한 응답에 `commands`와 섞지 않는 이유도 같다 —
 * 섞으면 어느 명령이 어느 프로젝트에 적용된 결과인지가 갈려 전부-또는-전무가 깨진다.
 *
 * ## pageId는 에이전트가 짓지 않는다
 *
 * GUI가 요청에 실어 보낸 id(`NlRequest.newPageId`)만 받는다. 바깥에서 온 id를 그대로 믿으면
 * 이미 있는 페이지 키를 덮어써 **기존 화면이 통째로 사라진다** — 그 사고를 막는 자리가 여기다.
 *
 * ## 실패하면 빈 페이지도 남지 않는다
 *
 * 이 명령이 있는 이유의 절반이 그것이다(#497의 "필요한 이유"). GUI에서 빈 페이지를 먼저 만들고
 * 자연어로 채우는 경로는 중간에 실패하면 빈 페이지와 Undo 두 단계를 남긴다. 여기서는 후보
 * 프로젝트를 만들어 검증까지 끝낸 뒤에만 커밋하므로, 실패하면 프로젝트도 활성 페이지도 그대로다.
 */
export interface CreatePageCommand {
  version: '0.1';
  type: 'createPage';
  pageId: PageId;
  /** 새 페이지의 전체 스펙. 부분 패치가 아니다 — 빈 페이지를 먼저 만들지 않기 때문이다. */
  page: ScreenSpec;
}

export type CreatePageResult = { ok: true; spec: ProjectSpec } | { ok: false; message: string };

const fail = (message: string): CreatePageResult => ({ ok: false, message });
const own = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key);

/**
 * 후보 프로젝트를 만들어 **검증까지 끝낸 뒤** 돌려준다. 입력은 절대 바꾸지 않는다.
 *
 * `allocatedPageId`는 GUI가 요청에 실어 보낸 값이다 — 호출부가 그 요청의 값을 그대로 넘긴다.
 */
export function applyCreatePageCommand(
  project: ProjectSpec,
  command: CreatePageCommand,
  allocatedPageId: PageId,
): CreatePageResult {
  if (command.version !== '0.1' || command.type !== 'createPage') return fail('페이지 생성 명령 버전이 다릅니다.');
  if (command.pageId !== allocatedPageId) {
    return fail(`새 페이지 ID가 요청에서 발급한 값과 다릅니다 — 발급한 값은 "${allocatedPageId}"입니다.`);
  }
  if (own(project.pages, command.pageId)) return fail('이미 있는 페이지 ID로는 새 페이지를 만들 수 없습니다.');
  if (typeof command.page !== 'object' || command.page === null) return fail('새 페이지의 스펙이 객체가 아닙니다.');
  // kind는 생략하면 page다(docs/24 §3). modal·widget은 "새 프로젝트 페이지"가 아니라 다른 작업이고,
  // 어느 화면에서 열리는지를 사용자가 정해야 하므로 이 경로로 만들지 않는다.
  if ((command.page.kind ?? 'page') !== 'page') return fail('새 프로젝트 페이지의 kind는 "page"여야 합니다.');

  const before = validateProjectSpec(project);
  if (!before.valid) return fail('원본 프로젝트가 유효하지 않습니다.');

  const candidate: ProjectSpec = {
    ...project,
    pages: { ...project.pages, [command.pageId]: structuredClone(command.page) },
    // pageOrder는 "비지 않음"이 타입이라 배열 연산 결과를 그대로 넣을 수 없다. 더하기만 하므로 안전하다.
    pageOrder: [...project.pageOrder, command.pageId] as ProjectSpec['pageOrder'],
  };
  const result = validateProjectSpec(candidate);
  return result.valid
    ? { ok: true, spec: candidate }
    : fail(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
}

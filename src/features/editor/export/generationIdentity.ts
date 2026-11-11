/**
 * 생성 출력의 신원과 자리 — 순수 함수 (이슈 #281).
 *
 * #284는 "어느 요청의 출력을 받아들이는가"를, #282는 "이 파일을 지금 바꿔도 되는가"를 정했다. 이 파일은
 * 그 둘이 기대는 질문을 하나 더 정한다 — **이 출력은 어느 프로젝트·페이지·컴포넌트의 것이고, 그 입력은
 * 무엇이었나.** 스키마(`visual-spec.schema.json`)와 Ticket 계약(docs/11)은 바꾸지 않는다. 신원은 이미
 * 있는 안정 값에서 꺼내고, 없는 것(프로젝트 ID)은 작업공간 쪽 기록(`generationManifest.ts`의
 * `projects`)에 둔다.
 *
 * | 신원 | 어디서 오나 | 이름을 바꾸면 |
 * |---|---|---|
 * | 프로젝트 | 수용 기록의 `projects[projectId]`(GUI가 처음 전달할 때 만든다) | 앱 안 이름 변경은 같은 ID·같은 폴더를 이어받는다. 복사(다른 이름으로 저장)는 새 ID다 |
 * | 페이지 | IR의 `pages` 키(`PageId`) | 페이지 이름(`screen.name`)이 바뀌어도 그대로다 |
 * | 컴포넌트 | 티켓의 종류와 대표 노드 ID(`ticketComponentKey`) | 노드 이름이 바뀌어도 그대로다 — 파일 이름만 바뀐다 |
 *
 * 생성 파일은 `generated/<프로젝트 폴더>/<PageId>/` 아래에 놓인다. 그 안의 배치(`pages/`·`components/`,
 * `../components/X`·`../assets/x` 상대 경로)는 #157 그대로라 ZIP과 스킬의 import 규칙이 바뀌지 않는다.
 * 경계와 근거는 docs/26 "#281".
 */

import type { NodeId, PageId, ScreenSpec } from "@/features/editor/schema";
import type { Ticket } from "@/features/editor/ticket/types";

import { canonicalJson, contentHash, inputFingerprint } from "./contentHash";
import { COMPONENTS_DIR, PAGES_DIR, ticketFilePath } from "./generatedPaths";

/**
 * 티켓이 만드는 컴포넌트의 안정 신원. 종류와 대표 노드 ID다 — 페이지는 root, 컴포넌트는 첫 인스턴스
 * (반복 그룹이면 형제 순서상 첫 노드). 노드 ID는 이름을 바꿔도 그대로라, 이름에서 나온 파일 경로가
 * 바뀌어도 수용 기록이 같은 컴포넌트를 가리킨다. Ticket 형태(docs/11 동결)를 바꾸지 않으려고 티켓에
 * 필드를 더하지 않고 여기서 계산한다.
 */
export function ticketComponentKey(ticket: Ticket): string {
  return `${ticket.kind}:${ticket.instances[0] ?? ticket.id}`;
}

/** 프로젝트 폴더가 될 수 없는 이름 — 이전 배치의 최상위 폴더와 겹치면 둘을 가를 수 없다. */
const RESERVED_DIR_NAMES = new Set([PAGES_DIR, COMPONENTS_DIR]);

/**
 * Windows 장치 이름(Microsoft "Naming Files" 문서의 예약 이름). 대소문자를 가리지 않고, 확장자가 붙어도
 * (`con.tsx`·`NUL.txt`) 장치로 해석된다. 끝의 점·공백은 Windows가 떼어 내므로 떼고 본다.
 */
const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\.|$)/i;

/**
 * 경로 한 단계(폴더 또는 파일 이름)가 Windows 장치 이름인가. 그런 이름의 폴더·파일은 Windows에서 일반
 * 프로그램(탐색기·git·편집기·ZIP 도구)이 열거나 지우지 못한다 — Node는 `\?\` 경로로 만들어 버릴 수 있어
 * 쓰기가 성공해도 사용자는 그 출력을 쓸 수 없다(`test/generation-device-name.test.ts`). 플랫폼과 상관없이
 * 같은 규칙으로 막는다 — 생성 결과는 다른 기기로 옮겨진다.
 */
export function isWindowsDeviceName(segment: string): boolean {
  return WINDOWS_DEVICE_NAME.test(segment.replace(/[. ]+$/, ""));
}

/**
 * 프로젝트 파일 이름에서 프로젝트 폴더 이름의 **후보**를 만든다. 소문자로 줄인다 — 대소문자를 가리지
 * 않는 파일 시스템(Windows·macOS 기본)에서 `Shop`과 `shop`이 같은 폴더가 되기 때문이다. 글자·숫자·
 * `_`·`-`만 남기고 나머지(공백·점 등)는 `-`로 바꾼다. 실제 폴더는 기록에 이미 쓰인 이름과 겹치지 않게
 * `chooseOutputDir`가 정한다.
 */
export function projectOutputDirName(fileName: string | null): string {
  const stem = (fileName ?? "").replace(/\.json$/i, "");
  const slug = stem.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "");
  if (slug === "") return "project";
  return RESERVED_DIR_NAMES.has(slug) || isWindowsDeviceName(slug) ? `${slug}-project` : slug;
}

/** 후보가 이미 다른 프로젝트의 폴더면 `-2`, `-3`…을 붙인다. */
export function chooseOutputDir(candidate: string, used: ReadonlySet<string>): string {
  if (!used.has(candidate)) return candidate;
  let suffix = 2;
  while (used.has(`${candidate}-${suffix}`)) suffix += 1;
  return `${candidate}-${suffix}`;
}

/**
 * 한 페이지의 생성 출력 자리(`generated/` 기준). 이 아래 배치가 ZIP의 배치다. PageId를 폴더 이름으로
 * 그대로 쓴다 — 대소문자만 다른 PageId가 같은 폴더가 되는 경우는 `pageIdCaseConflicts`로 막는다.
 */
export function pageOutputRoot(outputDir: string, pageId: PageId): string {
  return `${outputDir}/${pageId}`;
}

/**
 * 같은 프로젝트에서 `pageId`와 대소문자만 다른 PageId들. 스키마의 PageId 패턴(`^[A-Za-z0-9_-]+$`)은
 * `Login`과 `login`을 다른 페이지로 허용하지만, 대소문자를 가리지 않는 파일 시스템(Windows·macOS 기본)
 * 에서는 두 생성 자리가 같은 폴더다 — 수용 기록의 키는 서로 달라 한쪽 출력을 다른 쪽이 "기록 없음"으로
 * 본다. 비어 있지 않으면 그 페이지는 생성 전달을 거부한다(docs/26 #281 "PageId 대소문자 충돌").
 */
export function pageIdCaseConflicts(pageId: PageId, pageIds: Iterable<PageId>): PageId[] {
  const folded = pageId.toLowerCase();
  return [...new Set(pageIds)].filter((id) => id !== pageId && id.toLowerCase() === folded).sort();
}

/** 티켓 파일의 `generated/` 기준 경로. `root`가 빈 문자열이면 이전(#281 전) 배치다. */
export function generatedTicketPath(root: string, ticket: Ticket): string {
  return root === "" ? ticketFilePath(ticket) : `${root}/${ticketFilePath(ticket)}`;
}

/** `root` 아래 경로를 `root` 기준으로 바꾼다. 아래가 아니면 null. */
export function relativeToRoot(root: string, path: string): string | null {
  if (root === "") return path;
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : null;
}

/**
 * #281 전 배치(`generated/pages/…`·`generated/components/…`)의 파일인가. 이런 파일은 어느 프로젝트·
 * 페이지의 것인지 알 수 없다 — Export는 호환을 위해 보여 주되 최신으로 인정하지 않는다.
 */
export function isLegacyGeneratedPath(path: string): boolean {
  const first = path.split("/")[0];
  return path.includes("/") && RESERVED_DIR_NAMES.has(first);
}

/**
 * 지문이 덮는 입력의 범위. 페이지 티켓은 페이지 전체(#284와 같은 값), 컴포넌트 티켓은 자기 하위 트리다.
 */
export type InputScope = "page" | "component";

export function ticketInputScope(ticket: Ticket): InputScope {
  return ticket.kind === "page" ? "page" : "component";
}

/** 인스턴스들의 하위 트리 노드 ID. 검증되지 않은 순환이 있어도 끝난다(방문 표시). */
function subtreeIds(roots: NodeId[], nodes: ScreenSpec["nodes"]): Set<NodeId> {
  const seen = new Set<NodeId>();
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop() as NodeId;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes[id];
    if (node?.type === "frame") stack.push(...node.children.map((child) => child.node));
  }
  return seen;
}

/**
 * 티켓 하나의 입력 지문.
 *
 * - 페이지 티켓: 페이지 전체(`inputFingerprint`) — 페이지 파일은 모든 자식을 조합하고 인라인 노드를 그린다.
 * - 컴포넌트 티켓: 그 티켓의 이름·종류·인스턴스·의존 티켓 이름, 페이지 크기, 인스턴스 하위 트리의 노드,
 *   그 노드들에 걸린 반응형 override(breakpoint 목록은 전부). 다른 노드를 고쳐도 이 지문은 그대로다.
 *
 * 컴포넌트 지문이 하위 트리 밖을 보지 않는 것은 **판정 범위의 선택**이다. 에이전트가 요청에 실린
 * 페이지 전체를 보고 컴포넌트 밖의 값을 코드에 옮겼다면 그 변경은 이 지문이 잡지 못한다. 그때도 페이지
 * 티켓은 페이지 전체 지문이라 "오래됨"이 되므로, 페이지가 현재가 아니면 전체 판정은 "현재"가 될 수 없다.
 */
export function ticketInputFingerprint(pageId: PageId, page: ScreenSpec, ticket: Ticket): string {
  if (ticketInputScope(ticket) === "page") return inputFingerprint(pageId, page);
  const ids = subtreeIds(ticket.instances, page.nodes);
  const nodes = Object.fromEntries([...ids].filter((id) => page.nodes[id] !== undefined).map((id) => [id, page.nodes[id]]));
  const responsive = page.responsive === undefined ? undefined : {
    breakpoints: page.responsive.breakpoints,
    overrides: Object.fromEntries(Object.entries(page.responsive.overrides).map(([breakpoint, byNode]) => [
      breakpoint,
      Object.fromEntries(Object.entries(byNode).filter(([id]) => ids.has(id))),
    ])),
  };
  return contentHash(canonicalJson({
    scope: "component",
    pageId,
    ticket: {
      kind: ticket.kind,
      componentName: ticket.componentName,
      instances: ticket.instances,
      dependsOn: ticket.dependsOn,
    },
    size: page.size,
    nodes,
    responsive,
  }));
}

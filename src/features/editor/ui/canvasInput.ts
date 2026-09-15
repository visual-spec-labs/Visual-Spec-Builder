/**
 * 캔버스 입력의 순수 규칙 — 키를 받을지 말지, 도구에 어떤 커서를 줄지.
 *
 * DOM을 만지는 쪽(Canvas)과 판단을 나눠 이 파일만 테스트한다 — jsdom이 없어
 * 컴포넌트 렌더 테스트는 만들 수 없다.
 */

import type { ToolId } from "@/features/editor/store/toolStore";

/**
 * 지금 타이핑 중인 곳에서 온 키인가.
 *
 * Delete·Backspace를 window에서 듣기 때문에 필요하다. 캔버스는 포커스를 받을 수
 * 있는 요소가 아니라(div에 tabIndex를 주면 클릭마다 포커스 링이 생기고 탭 순서에도
 * 끼어든다) window에서 듣는데, 그러면 노드 이름이나 텍스트를 고치는 중에 누른
 * Backspace까지 잡힌다. **글자를 지우려다 노드가 지워지면 안 된다.**
 *
 * DOM 타입을 참조하지 않고 두 값만 받는다 — `test/`를 포함하는 tsconfig.node의
 * `lib`에 DOM이 없다.
 */
export function isTypingTarget(
  tagName: string | undefined,
  contentEditable: boolean,
): boolean {
  if (contentEditable) return true;

  const tag = (tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * 브라우저 기본 우클릭 메뉴를 막아야 하는가.
 *
 * "뒤로 / 새로고침 / 다른 이름으로 저장 / 페이지 소스 보기 / 번역"은 편집기 안에서
 * 할 일이 하나도 없다. 데스크톱 앱처럼 보이려는 화면에서 브라우저 메뉴가 튀어나오는
 * 것 자체가 어긋나고, 나중에 캔버스에 커스텀 메뉴를 붙이면 둘이 겹친다(#138).
 *
 * **입력란은 예외다.** 여기서는 브라우저 메뉴가 쓸모없기는커녕 유일한 수단이다 —
 * 복사·붙여넣기·모두 선택·실행 취소·맞춤법 검사가 전부 거기 있다. 속성 패널의
 * TextField·NumberField·ColorField 와 레이어 이름 바꾸기(#129)가 여기 해당한다.
 * 이걸 놓치면 우클릭 메뉴를 없앤 게 아니라 텍스트 편집을 망가뜨린 게 된다.
 *
 * 판정이 isTypingTarget 의 반대인 것은 우연이 아니다 — 키 입력과 같은 경계다.
 * "사용자가 지금 글자를 다루고 있는가"가 두 경우 모두의 기준이다.
 */
export function shouldSuppressContextMenu(
  tagName: string | undefined,
  contentEditable: boolean,
): boolean {
  return !isTypingTarget(tagName, contentEditable);
}

/** `shouldDeleteSelection`이 보는 것 — KeyboardEvent에서 필요한 값만 추린 모양. */
export interface DeleteKeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** `event.target`의 태그 이름. 못 읽었으면 undefined. */
  tagName: string | undefined;
  contentEditable: boolean;
  hasSelection: boolean;
}

/**
 * 이 키 입력으로 선택 노드를 지워야 하는가.
 *
 * 판단을 전부 여기 모아 둔다 — 어떤 키를 받는지, 타이핑 중인지, 고른 게 있는지,
 * 수식키가 눌렸는지. Canvas 쪽에는 "지운다"는 동작만 남는다.
 *
 * **수식키가 눌렸으면 받지 않는다.** Ctrl+Backspace(앞 단어 삭제)와
 * Alt+Backspace(실행 취소)는 편집 중 손버릇으로 흔히 눌리는데, 그걸 노드 삭제로
 * 받으면 글자를 지우려다 노드가 사라진다. Cmd(macOS)도 같은 이유로 막는다.
 * Shift는 막지 않는다 — Shift+Delete에 다른 뜻이 없고, 나중에 다중 선택이
 * 생기면 자연스럽게 함께 동작해야 한다.
 */
export function shouldDeleteSelection(input: DeleteKeyInput): boolean {
  if (input.key !== "Delete" && input.key !== "Backspace") return false;
  if (input.ctrlKey || input.metaKey || input.altKey) return false;
  if (isTypingTarget(input.tagName, input.contentEditable)) return false;

  return input.hasSelection;
}

/**
 * 물리 키 위치 → 도구. 피그마와 같은 배치다.
 *
 * `event.key`가 아니라 **`event.code`로 맞춘다.** `key`는 키보드 레이아웃을 타서
 * 한글 상태에서 V를 누르면 `"ㅍ"`이 오고, IME가 붙으면 `"Process"`가 온다.
 * 그러면 한/영을 전환할 때마다 단축키가 죽는다. `code`는 물리적인 키 위치라
 * `"KeyV"`로 고정이다.
 */
const TOOL_KEYS: Record<string, ToolId> = {
  KeyV: "select",
  KeyH: "hand",
  KeyF: "frame",
  KeyT: "text",
};

/** 도구 단축키 판정이 보는 것 — KeyboardEvent에서 필요한 값만 추린 모양. */
export interface ToolKeyInput {
  /** `event.code` — `event.key`가 아니다. 위 TOOL_KEYS 주석 참고. */
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** `event.target`의 태그 이름. 못 읽었으면 undefined. */
  tagName: string | undefined;
  contentEditable: boolean;
  /** `event.target`의 `role` 속성. 없으면 undefined. */
  role?: string | undefined;
}

/** 수식키·타이핑 중이면 캔버스 단축키를 받지 않는다. 두 판정이 공유하는 관문. */
function isCanvasShortcutContext(input: ToolKeyInput): boolean {
  // Ctrl+V(붙여넣기)·Ctrl+F(찾기)가 도구를 바꾸면 안 된다.
  if (input.ctrlKey || input.metaKey || input.altKey) return false;
  // 레이어 이름에 "Frame"을 치면 도구가 두 번 바뀌는 것을 막는다.
  return !isTypingTarget(input.tagName, input.contentEditable);
}

/**
 * 이 키로 바꿀 도구. 해당 없으면 null.
 *
 * 고정 전환이다 — 누르면 그 도구가 되고 그대로 있는다. 누르는 동안만 바뀌는
 * 스페이스는 `isSpacePanKey`가 따로 본다.
 */
export function toolForKey(input: ToolKeyInput): ToolId | null {
  if (!isCanvasShortcutContext(input)) return null;
  return TOOL_KEYS[input.code] ?? null;
}

/**
 * 스페이스가 버튼·링크를 누르는 자리인가.
 *
 * 스페이스는 `<button>`과 `role="button"`의 **기본 활성화 키**다. 여기서 가로채
 * `preventDefault`를 걸면 도구 모음 버튼에 포커스가 있을 때 **키보드로 도구를
 * 고를 수 없게 된다.** 글자 키(V·H·F·T)에는 이 검사가 필요 없다 — 버튼이 글자를
 * 소비하지 않는다.
 */
function isActivationTarget(
  tagName: string | undefined,
  role: string | undefined,
): boolean {
  const tag = (tagName ?? "").toUpperCase();
  if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return true;
  return role === "button" || role === "link";
}

/**
 * 스페이스를 임시 팬으로 받아야 하는가.
 *
 * 고정 전환과 달리 **누르고 있는 동안만** 손 도구가 되고, 떼면 쓰던 도구로
 * 돌아온다(피그마·포토샵과 같다). 프레임을 그리다 화면만 살짝 옮기고 다시
 * 그리는 흐름이 끊기지 않는다.
 *
 * 받기로 했으면 호출부가 `preventDefault`를 걸어야 한다 — 스페이스는 스크롤
 * 키이고 캔버스가 `overflow-auto`라 한 화면씩 내려간다. 입력란에서는 여기서
 * 먼저 false가 나오므로 띄어쓰기는 멀쩡하다.
 */
export function isSpacePanKey(input: ToolKeyInput): boolean {
  if (input.code !== "Space") return false;
  if (!isCanvasShortcutContext(input)) return false;

  return !isActivationTarget(input.tagName, input.role);
}

/**
 * 활성 도구에 맞는 커서 클래스.
 *
 * 도구를 바꿔도 커서가 그대로면 **지금 무슨 도구인지 알려주는 표시가 툴바 버튼
 * 하이라이트뿐이다.** 캔버스를 보고 있는 동안에는 눈이 툴바에 가 있지 않아서,
 * Frame 도구를 켜 둔 줄 모르고 클릭했다가 노드가 생기는 일이 난다.
 */
export function toolCursorClass(tool: ToolId, panning: boolean): string {
  if (tool === "hand") return panning ? "cursor-grabbing" : "cursor-grab";
  // 만들기 도구는 "여기를 찍으면 생긴다"를 알리는 십자선.
  if (tool === "frame" || tool === "text") return "cursor-crosshair";
  return "";
}

/**
 * 도구 모음이 아트보드의 하단 리사이즈 핸들을 가리기 시작하는 지점(px).
 *
 * 도구 모음은 뷰포트 바닥에서 16px(bottom-4) 띄운 채 42px(size-8 + p-1 + 테두리)을
 * 차지하므로 바닥에서 **58px 까지**를 덮는다. 핸들은 아트보드 아래 여백(p-8, 32px)
 * 위에 앉으니, 남은 스크롤이 26px 밑으로 떨어지면 핸들이 그 띠 안으로 들어온다.
 *
 * 실제로 겹치기 전에 비켜야 "가려서 못 누르는" 순간이 없으므로 여기에 여유를 얹어
 * 48px 로 둔다. 맨 밑에 닿기 조금 전부터 도구 모음이 내려가기 시작한다.
 */
export const TOOLBAR_CLEARANCE_PX = 48;

/**
 * 캔버스가 세로로 끝(또는 끝 부근)까지 내려가 있는가.
 *
 * 하단 도구 모음을 잠깐 치우는 데 쓴다 — 아래쪽에서는 아트보드의 하단 리사이즈
 * 핸들이 도구 모음과 같은 자리에 와서 잡을 수가 없다.
 *
 * 여유(epsilon)는 두 몫을 겸한다. 하나는 위 `TOOLBAR_CLEARANCE_PX` 가 말하는
 * "겹치기 전에 비키는" 거리이고, 다른 하나는 배율이 소수라 scrollHeight 와
 * scrollTop+clientHeight 가 정확히 같아지지 않는 오차다.
 */
export function isScrolledToBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  epsilon: number = TOOLBAR_CLEARANCE_PX,
): boolean {
  // 내용이 뷰포트보다 짧으면 스크롤 자체가 없다 — 이때는 "맨 밑"이 아니다.
  // 도구 모음을 숨길 이유가 없고, 숨기면 도구를 영영 못 고른다.
  if (scrollHeight <= clientHeight) return false;

  return scrollTop + clientHeight >= scrollHeight - epsilon;
}

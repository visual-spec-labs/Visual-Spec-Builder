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

/** 노드 복제·복사·붙여넣기 단축키가 시키는 일. */
export type NodeClipboardCommand = "duplicate" | "copy" | "paste";

/** `nodeClipboardCommandForKey`가 보는 것 — KeyboardEvent에서 필요한 값만 추린 모양. */
export interface ClipboardKeyInput {
  /** `event.code` — 물리 키 위치. 도구 단축키와 같은 이유(TOOL_KEYS 주석 참고). */
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** `event.target`의 태그 이름. 못 읽었으면 undefined. */
  tagName: string | undefined;
  contentEditable: boolean;
  /** `Ctrl+D`·`Ctrl+C`가 대상으로 삼을 노드가 있는가. */
  hasSelection: boolean;
  /** `Ctrl+V`가 붙여넣을 내용이 클립보드에 있는가. */
  hasClipboard: boolean;
}

/**
 * 이 키 입력이 시키는 노드 복제·복사·붙여넣기. 해당 없으면 null.
 *
 * `shouldDeleteSelection`과 같은 이유로 "할 수 있는 일이 있는가"까지 판정에
 * 넣는다(`hasSelection`·`hasClipboard`) — 그러면 호출부는 값을 받았을 때
 * 곧바로 `preventDefault`를 걸어도 안전하다. 대상이 없을 때도 가로채 버리면
 * `Ctrl+D`(브라우저 북마크)·`Ctrl+C`/`Ctrl+V`(브라우저 복사·붙여넣기)가
 * 캔버스에 아무 선택도 없을 때조차 죽는다.
 *
 * 타이핑 중이면 전부 물러선다 — 레이어 이름을 고치거나 속성 패널 입력칸에서
 * 쓰는 `Ctrl+C`/`Ctrl+V`는 글자 복사·붙여넣기지 노드 복제가 아니다.
 */
export function nodeClipboardCommandForKey(
  input: ClipboardKeyInput,
): NodeClipboardCommand | null {
  if (isTypingTarget(input.tagName, input.contentEditable)) return null;
  if (input.altKey) return null;
  if (!(input.ctrlKey || input.metaKey)) return null;

  if (input.code === "KeyD") return input.hasSelection ? "duplicate" : null;
  if (input.code === "KeyC") return input.hasSelection ? "copy" : null;
  if (input.code === "KeyV") return input.hasClipboard ? "paste" : null;
  return null;
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
  /** 보기 단축키(Shift+1)만 본다. 도구 단축키는 Shift를 따지지 않는다. */
  shiftKey?: boolean;
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

/** Tab/Shift+Tab 형제 이동이 시키는 방향. */
export type SiblingNavDirection = "next" | "prev";

/** `siblingNavDirectionForKey`가 보는 것 — KeyboardEvent에서 필요한 값만 추린 모양. */
export interface SiblingNavKeyInput {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** `event.target`의 태그 이름. 못 읽었으면 undefined. */
  tagName: string | undefined;
  contentEditable: boolean;
  /** `event.target`의 `role` 속성. 없으면 undefined. */
  role?: string | undefined;
  /** 옮길 대상이 있는가 — 형제 이동은 지금 선택된 노드를 기준으로 한다. */
  hasSelection: boolean;
  /**
   * 도구 모음이 숨으며 포커스를 뗀 바로 다음 Tab인가(#275 리뷰 2·3차 대응 —
   * 소비 시점은 Tab keydown으로 좁혀져 있다, `shouldConsumeToolbarFocusHandoff` 참고).
   * `viewStore.consumeToolbarFocusHandoffPending()`을 읽은 값을 그대로 넣는다 —
   * true면 `isActivationTarget`과 같은 취지로 한 번 더 물러난다. `target`이
   * `body`라 태그 기준 예외는 못 받지만, 맥락은 "방금까지 컨트롤을 쓰고
   * 있었다"와 같다(#151 §2: 패널·도구 모음 접근을 막으면 안 된다).
   */
  toolbarFocusHandoff: boolean;
}

/**
 * `Tab`/`Shift+Tab`으로 형제를 옮겨야 하는가, 옮긴다면 어느 방향인가. 해당
 * 없으면 null.
 *
 * **`Tab`은 브라우저의 포커스 이동 키다.** 여기서 가로채면 캔버스 다음으로
 * 포커스가 갈 곳(속성 패널 입력칸 등)에 키보드만으로 못 간다. `shouldDeleteSelection`
 * 과 같은 이유로 "옮길 대상이 있는가"(`hasSelection`)까지 판정에 넣는다 —
 * 선택이 없으면 형제 이동이 의미가 없으니 그때는 아예 가로채지 않고 Tab을
 * 페이지 포커스 이동에 돌려준다. 그래도 선택이 있는 동안은 여전히 훔치므로,
 * `isActivationTarget`(Space와 같은 가드)로 버튼·링크에 포커스가 있을 때는
 * 한 번 더 물러난다 — 그러지 않으면 도구 모음 버튼에서 Tab으로 다음 버튼에
 * 갈 수 없다. `toolbarFocusHandoff`도 같은 취지의 물러남이다 — 포커스가 버튼
 * 위에 있는 게 아니라 막 버튼에서 **떨어진** 경우라 태그로는 못 잡는다.
 */
export function siblingNavDirectionForKey(
  input: SiblingNavKeyInput,
): SiblingNavDirection | null {
  if (input.code !== "Tab") return null;
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  if (!input.hasSelection) return null;
  if (input.toolbarFocusHandoff) return null;
  if (isTypingTarget(input.tagName, input.contentEditable)) return null;
  if (isActivationTarget(input.tagName, input.role)) return null;
  // #287 리뷰 대응 — 패널 폭 조절 핸들(role="separator", PanelResizeHandle.tsx)에
  // 포커스가 있을 때는 Tab이 네이티브 포커스 이동을 하게 둔다. 이 리스너가
  // window에 걸려 있어 포커스 위치와 무관하게 Tab을 먼저 가로채므로, 핸들을
  // 빼 주지 않으면 포커스가 핸들에 갇힌 채 선택 노드만 형제로 바뀐다.
  if (input.role === "separator") return null;

  return input.shiftKey ? "prev" : "next";
}

/** `shouldConsumeToolbarFocusHandoff`가 보는 것 — KeyboardEvent에서 필요한 값만 추린 모양. */
export interface ToolbarFocusHandoffConsumeInput {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/**
 * `viewStore`의 `toolbarFocusHandoffPending`을 이 keydown에서 소비해야 하는가
 * (#275 리뷰 3·6차 대응). **Ctrl/Cmd/Alt가 안 눌린 `Tab`일 때만** true다.
 *
 * 처음엔 모든 keydown에서 소비했는데, 실제 키보드의 Shift+Tab은 `ShiftLeft`/
 * `ShiftRight` keydown이 `Tab` keydown보다 **먼저 따로** 들어온다 — 아무 키에서나
 * 소비하면 그 modifier keydown이 신호를 먼저 가로채 버려, 정작 뒤따라오는 진짜
 * `Tab`(`shiftKey: true`)은 신호 없이 형제 이동으로 넘어간다. `Tab` 자체에서만
 * 소비하면 이 순서 문제를 아예 피한다 — modifier만 눌린 keydown은 신호를
 * 건드리지 않고 그대로 남긴다.
 *
 * Shift는 그대로 소비 대상이다(`siblingNavDirectionForKey`가 역방향에도 이
 * 신호로 물러나야 하므로) — 하지만 Ctrl/Cmd/Alt가 눌린 Tab(브라우저 탭 전환
 * 등)은 애초에 `siblingNavDirectionForKey`가 그 조합을 형제 이동 후보에서
 * 아예 제외한다(260행). 그런데도 여기서 소비해 버리면, 그 Tab 바로 다음에
 * 오는 "진짜" 평범한 Tab(사용자가 의도한 탈출)이 이미 꺼진 신호를 만나 다시
 * 형제 이동에 잡힌다 — 필요 없는 소비가 정작 필요한 소비 기회를 가로채는
 * 셈이라 Ctrl/Cmd/Alt가 눌려 있으면 아예 건드리지 않는다.
 */
export function shouldConsumeToolbarFocusHandoff(
  input: ToolbarFocusHandoffConsumeInput,
): boolean {
  return input.code === "Tab" && !input.ctrlKey && !input.metaKey && !input.altKey;
}

/** `isContextMenuKey`가 보는 것 — KeyboardEvent에서 필요한 값만 추린 모양. */
export interface ContextMenuKeyInput {
  /** 컨텍스트 메뉴 전용 키가 있는 키보드에서 온다. `event.key`(code가 아니다) 기준. */
  key: string;
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  tagName: string | undefined;
  contentEditable: boolean;
  /** 메뉴를 띄울 대상 — 선택된 노드가 있어야 한다. */
  hasSelection: boolean;
}

/**
 * 키보드로 컨텍스트 메뉴를 열어야 하는가(#152).
 *
 * 두 키를 받는다 — 컨텍스트 메뉴 전용 키(`event.key === "ContextMenu"`, 있는
 * 키보드에서만)와 `Shift+F10`(그 키가 없는 키보드의 관례적 대체). `shouldDeleteSelection`
 * 과 같은 이유로 "열 대상이 있는가"(`hasSelection`)까지 판정에 넣는다 —
 * 선택이 없으면 열어도 빈 메뉴라 아예 가로채지 않는다.
 */
export function isContextMenuKey(input: ContextMenuKeyInput): boolean {
  if (isTypingTarget(input.tagName, input.contentEditable)) return false;
  if (!input.hasSelection) return false;

  if (input.key === "ContextMenu") return true;
  return input.code === "F10" && input.shiftKey && !input.ctrlKey && !input.metaKey && !input.altKey;
}

/** 보기 단축키가 시키는 일. 캔버스가 이 값으로 viewStore를 부른다. */
export type ViewCommand =
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "zoomFit"
  | "zoomFitSelection"
  | "deselect";

/**
 * 보기 단축키를 명령으로 옮긴다. 해당 없으면 null.
 *
 * 피그마와 같은 배치다 — `Ctrl/Cmd +`·`-`·`0`, `Shift 1`(화면 맞춤).
 * `Ctrl+0`·`Ctrl+-`는 **브라우저 페이지 줌**이기도 해서, 받기로 했으면 호출부가
 * 반드시 `preventDefault`를 걸어야 한다. 안 그러면 캔버스와 페이지가 같이 커진다.
 *
 * 수식키 규칙이 도구 단축키와 다르다 — 저쪽은 수식키가 있으면 전부 물러서지만
 * 여기는 `Ctrl/Cmd`가 **조건**이다. 그래서 `isCanvasShortcutContext`를 쓰지 않고
 * 타이핑 검사만 공유한다.
 */
export function viewCommandForKey(input: ToolKeyInput): ViewCommand | null {
  if (isTypingTarget(input.tagName, input.contentEditable)) return null;

  const mod = input.ctrlKey || input.metaKey;

  if (mod && !input.altKey) {
    // `=`와 `+`가 같은 물리 키다(Shift 여부만 다르다). code로 보면 하나로 묶인다.
    if (input.code === "Equal" || input.code === "NumpadAdd") return "zoomIn";
    if (input.code === "Minus" || input.code === "NumpadSubtract") return "zoomOut";
    if (input.code === "Digit0" || input.code === "Numpad0") return "zoomReset";
    return null;
  }

  if (mod || input.altKey) return null;

  // Shift+1 = 화면 맞춤, Shift+2 = 선택 영역 맞춤. 둘 다 피그마와 같은 배치다.
  if (input.shiftKey && (input.code === "Digit1" || input.code === "Numpad1")) {
    return "zoomFit";
  }
  if (input.shiftKey && (input.code === "Digit2" || input.code === "Numpad2")) {
    return "zoomFitSelection";
  }
  if (!input.shiftKey && input.code === "Escape") return "deselect";

  return null;
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
 * 노드 끌기로 보기 전에 움직여야 하는 거리(화면 px, 축마다가 아니라 직선 거리).
 *
 * 클릭과 끌기는 mousedown 이 같아서, 이 거리 안에서 떼면 **지금과 똑같은 클릭
 * 선택**이어야 한다. 마우스·트랙패드로 클릭할 때 손이 1~2px 떨리는 것은 흔하므로
 * 그보다 넉넉해야 하고, 너무 크면 짧게 끌 때 "안 잡힌다"고 느낀다. 운영체제 기본
 * 끌기 임계값(Windows `SM_CXDRAG` 4px)과 같은 값을 쓴다.
 *
 * 화면 px 인 이유: 손 떨림은 확대율과 무관하다. 스펙 px 로 재면 25% 에서는 화면
 * 1px 만 움직여도 넘어가 버린다.
 */
export const NODE_DRAG_THRESHOLD_PX = 4;

/** `canStartNodeDrag`가 보는 것 — MouseEvent와 스토어에서 필요한 값만 추린 모양. */
export interface NodeDragStartInput {
  /** `event.button`. 0=왼쪽, 1=가운데, 2=오른쪽. */
  button: number;
  tool: ToolId;
  /** 스페이스 임시 팬 중인가(`toolStore.toolBeforeSpace !== null`). */
  spacePanning: boolean;
  /** mousedown 이 리사이즈 핸들(`data-resize-handle`)에서 시작했는가. */
  onResizeHandle: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** `event.target`의 태그 이름. 못 읽었으면 undefined. */
  tagName: string | undefined;
  contentEditable: boolean;
}

/**
 * 이 mousedown 이 노드 끌기(#187)의 후보가 될 수 있는가.
 *
 * 후보일 뿐이다 — 실제로 끌기가 되는지는 `hasPassedDragThreshold`가 정하고, 그
 * 전에 떼면 지금과 똑같은 클릭이다. 그래서 여기서 true 여도 클릭 선택은 그대로 산다.
 *
 * - **왼쪽 버튼 + Select 도구만.** 가운데 버튼과 Hand 도구는 팬이고, Frame·Text 는
 *   클릭이 "여기에 만든다"라 끌기를 얹을 자리가 아니다.
 * - **스페이스 임시 팬 중이면 아니다.** 지금은 activeTool 이 hand 로 바뀌어 위에서
 *   걸리지만, 그 구현에 기대지 않고 뜻을 그대로 적어 둔다.
 * - **리사이즈 핸들에서 시작했으면 아니다.** 핸들은 선택된 노드의 자식이라
 *   `data-node-id`를 따라 올라가면 그 노드가 잡힌다 — 크기를 바꾸려다 노드가 딸려
 *   오면 안 된다. 핸들의 React 핸들러가 stopPropagation 을 해도 캔버스의 네이티브
 *   리스너가 먼저 듣기 때문에 여기서 따로 걸러야 한다.
 * - **Ctrl/Cmd 는 막지 않는다.** 클릭과 같은 뜻(상세 지정 — 가장 안쪽 노드)으로
 *   잡을 대상을 바꿀 뿐이다.
 * - **Alt·Shift 는 막는다.** Alt 는 거리 재기 전용 수식키이고 피그마에서 Alt+끌기는
 *   복제다. Shift+끌기는 피그마에서 축 고정이고 다중 선택에도 쓰일 자리다. 지금
 *   뜻을 정해 두지 않은 조합에 이동을 얹으면 나중에 바꿀 때 손버릇을 깨게 된다.
 * - 타이핑 중인 곳에서 온 mousedown 은 받지 않는다 — 글자를 고르려는 끌기다.
 */
export function canStartNodeDrag(input: NodeDragStartInput): boolean {
  if (input.button !== 0) return false;
  if (input.tool !== "select" || input.spacePanning) return false;
  if (input.onResizeHandle) return false;
  if (input.altKey || input.shiftKey) return false;
  return !isTypingTarget(input.tagName, input.contentEditable);
}

/** mousedown 지점에서 (dx, dy)만큼 움직였을 때 끌기로 볼 만큼 움직였는가. 화면 px. */
export function hasPassedDragThreshold(
  dx: number,
  dy: number,
  threshold: number = NODE_DRAG_THRESHOLD_PX,
): boolean {
  // 경계값(정확히 threshold)은 아직 클릭으로 본다 — "넘어야" 끌기다.
  return dx * dx + dy * dy > threshold * threshold;
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

/** Group은 선택 non-root 노드, Ungroup은 non-root frame에서만 가로챈다. */
export function nodeGroupCommandForKey(input: {
  code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean;
  tagName?: string; contentEditable: boolean; canGroup: boolean; canUngroup: boolean;
}): "group" | "ungroup" | null {
  if (isTypingTarget(input.tagName, input.contentEditable) || input.altKey ||
      !(input.ctrlKey || input.metaKey) || input.code !== "KeyG") return null;
  return input.shiftKey ? (input.canUngroup ? "ungroup" : null) : (input.canGroup ? "group" : null);
}

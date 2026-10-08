import { describe, expect, it } from "vitest";

import {
  NODE_DRAG_THRESHOLD_PX,
  TOOLBAR_CLEARANCE_PX,
  canStartNodeDrag,
  hasPassedDragThreshold,
  isContextMenuKey,
  isScrolledToBottom,
  isSpacePanKey,
  isTypingTarget,
  nodeClipboardCommandForKey,
  shouldConsumeToolbarFocusHandoff,
  shouldDeleteSelection,
  shouldSuppressContextMenu,
  siblingNavDirectionForKey,
  toolCursorClass,
  toolForKey,
  viewCommandForKey,
  type ClipboardKeyInput,
  type ContextMenuKeyInput,
  type DeleteKeyInput,
  type NodeDragStartInput,
  type SiblingNavKeyInput,
  type ToolbarFocusHandoffConsumeInput,
  type ToolKeyInput,
} from "@/features/editor/ui/canvasInput";

/** 캔버스에서 노드를 고른 채 Delete를 누른 상태. 케이스마다 필요한 칸만 덮어쓴다. */
function deleteKey(patch: Partial<DeleteKeyInput> = {}): DeleteKeyInput {
  return {
    key: "Delete",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    tagName: "DIV",
    contentEditable: false,
    hasSelection: true,
    ...patch,
  };
}

describe("isTypingTarget — Delete 키를 비켜설 자리", () => {
  it("입력칸에서 온 키는 캔버스가 받지 않는다", () => {
    // 노드 이름이나 텍스트를 고치다 누른 Backspace로 노드가 지워지면 안 된다.
    expect(isTypingTarget("INPUT", false)).toBe(true);
    expect(isTypingTarget("TEXTAREA", false)).toBe(true);
    expect(isTypingTarget("SELECT", false)).toBe(true);
  });

  it("소문자 태그 이름도 같게 본다", () => {
    // DOM의 tagName은 대문자지만 값의 출처를 하나로 가정하지 않는다.
    expect(isTypingTarget("input", false)).toBe(true);
    expect(isTypingTarget("textarea", false)).toBe(true);
  });

  it("contentEditable이면 태그와 무관하게 타이핑 중으로 본다", () => {
    expect(isTypingTarget("DIV", true)).toBe(true);
    expect(isTypingTarget(undefined, true)).toBe(true);
  });

  it("캔버스의 보통 요소에서 온 키는 받는다", () => {
    expect(isTypingTarget("DIV", false)).toBe(false);
    expect(isTypingTarget("SPAN", false)).toBe(false);
    expect(isTypingTarget("BUTTON", false)).toBe(false);
  });

  it("태그를 못 읽어도 터지지 않는다", () => {
    expect(isTypingTarget(undefined, false)).toBe(false);
    expect(isTypingTarget("", false)).toBe(false);
  });
});

describe("toolCursorClass — 활성 도구 표시", () => {
  it("만들기 도구는 십자선이다 — 찍으면 생긴다는 신호", () => {
    expect(toolCursorClass("frame", false)).toBe("cursor-crosshair");
    expect(toolCursorClass("text", false)).toBe("cursor-crosshair");
  });

  it("Hand는 잡는 손, 끄는 중에는 쥔 손이다", () => {
    expect(toolCursorClass("hand", false)).toBe("cursor-grab");
    expect(toolCursorClass("hand", true)).toBe("cursor-grabbing");
  });

  it("Select는 기본 커서 그대로 둔다", () => {
    expect(toolCursorClass("select", false)).toBe("");
  });

  it("panning은 Hand에서만 뜻이 있다", () => {
    // 다른 도구로 바뀌는 순간 panning이 남아 있어도 커서가 달라지면 안 된다.
    expect(toolCursorClass("select", true)).toBe("");
    expect(toolCursorClass("frame", true)).toBe("cursor-crosshair");
  });
});

describe("shouldDeleteSelection", () => {
  it("Delete와 Backspace를 받는다", () => {
    expect(shouldDeleteSelection(deleteKey({ key: "Delete" }))).toBe(true);
    expect(shouldDeleteSelection(deleteKey({ key: "Backspace" }))).toBe(true);
  });

  it("다른 키는 받지 않는다", () => {
    for (const key of ["a", "Enter", "Escape", "ArrowLeft", " "]) {
      expect(shouldDeleteSelection(deleteKey({ key }))).toBe(false);
    }
  });

  it("고른 노드가 없으면 아무 일도 하지 않는다", () => {
    expect(shouldDeleteSelection(deleteKey({ hasSelection: false }))).toBe(false);
  });

  it("입력칸에서 온 키는 받지 않는다", () => {
    expect(shouldDeleteSelection(deleteKey({ tagName: "INPUT" }))).toBe(false);
    expect(shouldDeleteSelection(deleteKey({ tagName: "TEXTAREA" }))).toBe(false);
    expect(shouldDeleteSelection(deleteKey({ contentEditable: true }))).toBe(false);
  });

  it("Ctrl+Backspace는 받지 않는다 — 앞 단어 삭제 단축키다", () => {
    // 이걸 노드 삭제로 받으면 글자를 지우려다 노드가 사라진다.
    expect(shouldDeleteSelection(deleteKey({ key: "Backspace", ctrlKey: true }))).toBe(
      false,
    );
  });

  it("Alt+Backspace는 받지 않는다 — 실행 취소 단축키다", () => {
    expect(shouldDeleteSelection(deleteKey({ key: "Backspace", altKey: true }))).toBe(
      false,
    );
  });

  it("Cmd(meta)가 눌려도 받지 않는다", () => {
    expect(shouldDeleteSelection(deleteKey({ metaKey: true }))).toBe(false);
  });

  it("Ctrl+Delete도 마찬가지다", () => {
    expect(shouldDeleteSelection(deleteKey({ key: "Delete", ctrlKey: true }))).toBe(
      false,
    );
  });

  it("Shift는 막지 않는다 — 다른 뜻이 없고, 다중 선택이 생기면 함께 동작해야 한다", () => {
    // DeleteKeyInput에 shiftKey가 없는 것 자체가 이 결정이다. 수식키 가드를
    // 넓힐 때 Shift까지 끌어오지 않도록 의도를 남긴다.
    expect(shouldDeleteSelection(deleteKey())).toBe(true);
  });
});

/** 노드가 선택된 채 Ctrl+D를 누른 상태. 케이스마다 필요한 칸만 덮어쓴다. */
function clipboardKey(patch: Partial<ClipboardKeyInput> = {}): ClipboardKeyInput {
  return {
    code: "KeyD",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    tagName: "DIV",
    contentEditable: false,
    hasSelection: true,
    hasClipboard: true,
    ...patch,
  };
}

describe("nodeClipboardCommandForKey — 복제·복사·붙여넣기(#151)", () => {
  it("Ctrl+D·Ctrl+C·Ctrl+V를 각각 구분한다", () => {
    expect(nodeClipboardCommandForKey(clipboardKey({ code: "KeyD" }))).toBe("duplicate");
    expect(nodeClipboardCommandForKey(clipboardKey({ code: "KeyC" }))).toBe("copy");
    expect(nodeClipboardCommandForKey(clipboardKey({ code: "KeyV" }))).toBe("paste");
  });

  it("Cmd(meta)도 같게 본다", () => {
    expect(
      nodeClipboardCommandForKey(clipboardKey({ code: "KeyD", ctrlKey: false, metaKey: true })),
    ).toBe("duplicate");
  });

  it("수식키가 없으면 받지 않는다 — 그냥 D·C·V 타이핑과 겹친다", () => {
    expect(nodeClipboardCommandForKey(clipboardKey({ code: "KeyD", ctrlKey: false }))).toBeNull();
  });

  it("Alt가 섞이면 받지 않는다", () => {
    expect(
      nodeClipboardCommandForKey(clipboardKey({ code: "KeyD", altKey: true })),
    ).toBeNull();
  });

  it("고른 노드가 없으면 복제·복사를 받지 않는다 — 대상이 없다", () => {
    expect(
      nodeClipboardCommandForKey(clipboardKey({ code: "KeyD", hasSelection: false })),
    ).toBeNull();
    expect(
      nodeClipboardCommandForKey(clipboardKey({ code: "KeyC", hasSelection: false })),
    ).toBeNull();
  });

  it("클립보드가 비어 있으면 붙여넣기를 받지 않는다", () => {
    expect(
      nodeClipboardCommandForKey(clipboardKey({ code: "KeyV", hasClipboard: false })),
    ).toBeNull();
  });

  it("붙여넣기는 선택 여부와 무관하다 — 선택 없어도 root에 붙는다", () => {
    expect(
      nodeClipboardCommandForKey(
        clipboardKey({ code: "KeyV", hasSelection: false, hasClipboard: true }),
      ),
    ).toBe("paste");
  });

  it("타이핑 중에는 받지 않는다 — 레이어 이름·속성 패널의 Ctrl+C/V는 글자 복사다", () => {
    expect(nodeClipboardCommandForKey(clipboardKey({ tagName: "INPUT" }))).toBeNull();
    expect(nodeClipboardCommandForKey(clipboardKey({ contentEditable: true }))).toBeNull();
  });

  it("관계없는 키는 받지 않는다", () => {
    expect(nodeClipboardCommandForKey(clipboardKey({ code: "KeyZ" }))).toBeNull();
  });
});

describe("isScrolledToBottom — 도구 모음이 비켜줄 순간", () => {
  it("맨 아래까지 내려가 있으면 참이다", () => {
    expect(isScrolledToBottom(1100, 900, 2000)).toBe(true);
  });

  it("소수 오차를 흡수한다 — 배율이 소수라 정확히 안 맞는다", () => {
    expect(isScrolledToBottom(1099.4, 900, 2000)).toBe(true);
  });

  it("맨 밑에 닿기 전에 비킨다 — 겹치고 나서 숨으면 이미 못 누른 뒤다", () => {
    // 남은 스크롤 40px. 핸들은 아래 여백(32px) 위에 있어 바닥에서 72px 지점인데,
    // 도구 모음이 58px 까지를 덮으므로 곧 겹친다. 그 전에 내려가야 한다.
    expect(isScrolledToBottom(1060, 900, 2000)).toBe(true);
  });

  it("충분히 위에 있으면 거짓이다 — 살짝 올리면 도구 모음이 돌아온다", () => {
    expect(isScrolledToBottom(1000, 900, 2000)).toBe(false);
    expect(isScrolledToBottom(0, 900, 2000)).toBe(false);
  });

  it("경계는 TOOLBAR_CLEARANCE_PX 하나로 정해진다", () => {
    const bottom = 2000 - 900; // scrollTop 의 최대값
    expect(isScrolledToBottom(bottom - TOOLBAR_CLEARANCE_PX, 900, 2000)).toBe(true);
    expect(isScrolledToBottom(bottom - TOOLBAR_CLEARANCE_PX - 1, 900, 2000)).toBe(false);
  });

  it("스크롤이 없으면 거짓이다 — 숨기면 도구를 영영 고를 수 없다", () => {
    // 내용이 뷰포트보다 짧으면 scrollTop은 늘 0이고 scrollTop+clientHeight가
    // scrollHeight를 넘는다. 이걸 "맨 밑"으로 보면 도구 모음이 계속 숨는다.
    expect(isScrolledToBottom(0, 900, 900)).toBe(false);
    expect(isScrolledToBottom(0, 900, 400)).toBe(false);
  });

  it("여유 값을 바꿀 수 있다", () => {
    expect(isScrolledToBottom(1080, 900, 2000, 20)).toBe(true);
    expect(isScrolledToBottom(1079, 900, 2000, 20)).toBe(false);
  });
});

/** 캔버스 단축키를 누른 상태. 케이스마다 필요한 칸만 덮어쓴다. */
function toolKey(patch: Partial<ToolKeyInput> = {}): ToolKeyInput {
  return {
    code: "KeyV",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    tagName: "DIV",
    contentEditable: false,
    role: undefined,
    ...patch,
  };
}

describe("toolForKey — 도구 고정 전환", () => {
  it("V·H·F·T 를 각 도구로 옮긴다", () => {
    expect(toolForKey(toolKey({ code: "KeyV" }))).toBe("select");
    expect(toolForKey(toolKey({ code: "KeyH" }))).toBe("hand");
    expect(toolForKey(toolKey({ code: "KeyF" }))).toBe("frame");
    expect(toolForKey(toolKey({ code: "KeyT" }))).toBe("text");
  });

  it("code 로 판정하므로 한/영 전환에 죽지 않는다", () => {
    // event.key 였다면 한글 상태에서 "ㅍ" 이 와서 안 먹었을 입력이다.
    // code 는 물리 키 위치라 언제나 "KeyV" 다.
    expect(toolForKey(toolKey({ code: "KeyV" }))).toBe("select");
  });

  it("도구에 없는 키는 null 이다", () => {
    expect(toolForKey(toolKey({ code: "KeyG" }))).toBeNull();
    expect(toolForKey(toolKey({ code: "Digit1" }))).toBeNull();
  });

  it("수식키가 켜져 있으면 받지 않는다 — Ctrl+V 는 붙여넣기다", () => {
    expect(toolForKey(toolKey({ ctrlKey: true }))).toBeNull();
    expect(toolForKey(toolKey({ metaKey: true }))).toBeNull();
    expect(toolForKey(toolKey({ code: "KeyF", ctrlKey: true }))).toBeNull();
    expect(toolForKey(toolKey({ altKey: true }))).toBeNull();
  });

  it("타이핑 중에는 받지 않는다 — 이름에 Frame 을 치면 도구가 바뀐다", () => {
    expect(toolForKey(toolKey({ code: "KeyF", tagName: "INPUT" }))).toBeNull();
    expect(toolForKey(toolKey({ tagName: "TEXTAREA" }))).toBeNull();
    expect(toolForKey(toolKey({ contentEditable: true }))).toBeNull();
  });

  it("버튼 위에서는 글자 키를 그대로 받는다 — 버튼이 글자를 소비하지 않는다", () => {
    expect(toolForKey(toolKey({ tagName: "BUTTON" }))).toBe("select");
  });
});

describe("isSpacePanKey — 스페이스 임시 팬", () => {
  const space = (patch: Partial<ToolKeyInput> = {}) =>
    isSpacePanKey(toolKey({ code: "Space", ...patch }));

  it("캔버스 위의 스페이스를 받는다", () => {
    expect(space()).toBe(true);
  });

  it("스페이스가 아니면 받지 않는다", () => {
    expect(isSpacePanKey(toolKey({ code: "KeyV" }))).toBe(false);
  });

  it("버튼·링크 위에서는 받지 않는다 — 스페이스는 그것들의 활성화 키다", () => {
    // 가로채면 도구 모음 버튼에 포커스가 있을 때 키보드로 도구를 못 고른다.
    expect(space({ tagName: "BUTTON" })).toBe(false);
    expect(space({ tagName: "A" })).toBe(false);
    expect(space({ tagName: "DIV", role: "button" })).toBe(false);
    expect(space({ tagName: "DIV", role: "link" })).toBe(false);
  });

  it("입력란에서는 받지 않는다 — 띄어쓰기가 멀쩡해야 한다", () => {
    expect(space({ tagName: "INPUT" })).toBe(false);
    expect(space({ tagName: "TEXTAREA" })).toBe(false);
    expect(space({ contentEditable: true })).toBe(false);
  });

  it("수식키가 켜져 있으면 받지 않는다", () => {
    expect(space({ ctrlKey: true })).toBe(false);
    expect(space({ metaKey: true })).toBe(false);
    expect(space({ altKey: true })).toBe(false);
  });
});

describe("shouldSuppressContextMenu — 브라우저 기본 우클릭 메뉴", () => {
  it("캔버스·패널·레이어 트리 위에서는 막는다", () => {
    // "뒤로 / 새로고침 / 페이지 소스 보기"는 편집기 안에서 할 일이 없다.
    expect(shouldSuppressContextMenu("DIV", false)).toBe(true);
    expect(shouldSuppressContextMenu("SPAN", false)).toBe(true);
    expect(shouldSuppressContextMenu("BUTTON", false)).toBe(true);
    expect(shouldSuppressContextMenu("MAIN", false)).toBe(true);
  });

  it("입력란에서는 막지 않는다 — 복사·붙여넣기가 거기 있다", () => {
    // 막으면 우클릭 메뉴를 없앤 게 아니라 텍스트 편집을 망가뜨린 게 된다.
    // 속성 패널의 TextField·NumberField·ColorField 와 레이어 이름 바꾸기(#129).
    expect(shouldSuppressContextMenu("INPUT", false)).toBe(false);
    expect(shouldSuppressContextMenu("TEXTAREA", false)).toBe(false);
    expect(shouldSuppressContextMenu("SELECT", false)).toBe(false);
    expect(shouldSuppressContextMenu("DIV", true)).toBe(false);
  });

  it("태그를 못 읽었으면 막는다 — 기본값은 편집기 쪽이다", () => {
    expect(shouldSuppressContextMenu(undefined, false)).toBe(true);
  });

  it("소문자 태그도 같게 본다", () => {
    expect(shouldSuppressContextMenu("input", false)).toBe(false);
    expect(shouldSuppressContextMenu("div", false)).toBe(true);
  });
});

describe("viewCommandForKey — 보기 단축키", () => {
  const view = (patch: Partial<ToolKeyInput>) => viewCommandForKey(toolKey(patch));

  it("Ctrl/Cmd + · - · 0 으로 확대·축소·100%", () => {
    expect(view({ code: "Equal", ctrlKey: true })).toBe("zoomIn");
    expect(view({ code: "Minus", ctrlKey: true })).toBe("zoomOut");
    expect(view({ code: "Digit0", ctrlKey: true })).toBe("zoomReset");
    expect(view({ code: "Equal", metaKey: true })).toBe("zoomIn");
  });

  it("숫자패드도 같게 본다", () => {
    expect(view({ code: "NumpadAdd", ctrlKey: true })).toBe("zoomIn");
    expect(view({ code: "NumpadSubtract", ctrlKey: true })).toBe("zoomOut");
    expect(view({ code: "Numpad0", ctrlKey: true })).toBe("zoomReset");
  });

  it("Shift+1 은 화면 맞춤이다 — 피그마와 같다", () => {
    expect(view({ code: "Digit1", shiftKey: true })).toBe("zoomFit");
  });

  it("Shift+2 는 선택 영역 맞춤이다(#151) — 피그마와 같다", () => {
    expect(view({ code: "Digit2", shiftKey: true })).toBe("zoomFitSelection");
    expect(view({ code: "Numpad2", shiftKey: true })).toBe("zoomFitSelection");
  });

  it("Shift 없는 2 는 받지 않는다", () => {
    expect(view({ code: "Digit2" })).toBeNull();
  });

  it("Escape 는 선택 해제다", () => {
    expect(view({ code: "Escape" })).toBe("deselect");
  });

  it("수식키 없는 = - 0 은 받지 않는다 — 글자 입력과 겹친다", () => {
    expect(view({ code: "Equal" })).toBeNull();
    expect(view({ code: "Minus" })).toBeNull();
    expect(view({ code: "Digit0" })).toBeNull();
  });

  it("Shift 없는 1 도 받지 않는다", () => {
    expect(view({ code: "Digit1" })).toBeNull();
  });

  it("Alt 가 섞이면 받지 않는다 — 브라우저·OS 단축키 자리다", () => {
    expect(view({ code: "Equal", ctrlKey: true, altKey: true })).toBeNull();
    expect(view({ code: "Digit1", shiftKey: true, altKey: true })).toBeNull();
    expect(view({ code: "Digit2", shiftKey: true, altKey: true })).toBeNull();
  });

  it("타이핑 중에는 받지 않는다 — Ctrl+0 도 입력칸에서는 브라우저 몫이다", () => {
    expect(view({ code: "Digit0", ctrlKey: true, tagName: "INPUT" })).toBeNull();
    expect(view({ code: "Escape", tagName: "INPUT" })).toBeNull();
    expect(view({ code: "Digit1", shiftKey: true, contentEditable: true })).toBeNull();
    expect(view({ code: "Digit2", shiftKey: true, contentEditable: true })).toBeNull();
  });

  it("도구 단축키와 서로 침범하지 않는다", () => {
    // Ctrl+V 는 도구도 보기도 아니다(붙여넣기).
    expect(view({ code: "KeyV", ctrlKey: true })).toBeNull();
    expect(toolForKey(toolKey({ code: "Equal", ctrlKey: true }))).toBeNull();
  });
});

/** 노드가 선택된 채 Tab을 누른 상태. 케이스마다 필요한 칸만 덮어쓴다. */
function tabKey(patch: Partial<SiblingNavKeyInput> = {}): SiblingNavKeyInput {
  return {
    code: "Tab",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    tagName: "DIV",
    contentEditable: false,
    role: undefined,
    hasSelection: true,
    toolbarFocusHandoff: false,
    ...patch,
  };
}

describe("siblingNavDirectionForKey — Tab/Shift+Tab 형제 이동(#151)", () => {
  it("Tab은 다음, Shift+Tab은 이전이다", () => {
    expect(siblingNavDirectionForKey(tabKey())).toBe("next");
    expect(siblingNavDirectionForKey(tabKey({ shiftKey: true }))).toBe("prev");
  });

  it("Tab이 아닌 키는 받지 않는다", () => {
    expect(siblingNavDirectionForKey(tabKey({ code: "KeyD" }))).toBeNull();
  });

  it("수식키(Ctrl/Cmd/Alt)가 섞이면 받지 않는다", () => {
    expect(siblingNavDirectionForKey(tabKey({ ctrlKey: true }))).toBeNull();
    expect(siblingNavDirectionForKey(tabKey({ metaKey: true }))).toBeNull();
    expect(siblingNavDirectionForKey(tabKey({ altKey: true }))).toBeNull();
  });

  it("선택이 없으면 받지 않는다 — 페이지 포커스 이동에 Tab을 돌려준다", () => {
    expect(siblingNavDirectionForKey(tabKey({ hasSelection: false }))).toBeNull();
  });

  it("타이핑 중에는 받지 않는다", () => {
    expect(siblingNavDirectionForKey(tabKey({ tagName: "INPUT" }))).toBeNull();
    expect(siblingNavDirectionForKey(tabKey({ contentEditable: true }))).toBeNull();
  });

  it("버튼·링크에 포커스가 있으면 받지 않는다 — 거기서는 Tab이 포커스 이동이다", () => {
    expect(siblingNavDirectionForKey(tabKey({ tagName: "BUTTON" }))).toBeNull();
    expect(siblingNavDirectionForKey(tabKey({ tagName: "A" }))).toBeNull();
    expect(siblingNavDirectionForKey(tabKey({ role: "button" }))).toBeNull();
  });

  it("role=separator에 포커스가 있으면 받지 않는다 — 패널 폭 조절 핸들에서 Tab은 네이티브 포커스 이동이어야 한다(#287 리뷰 대응)", () => {
    expect(siblingNavDirectionForKey(tabKey({ tagName: "DIV", role: "separator" }))).toBeNull();
    expect(
      siblingNavDirectionForKey(tabKey({ tagName: "DIV", role: "separator", shiftKey: true })),
    ).toBeNull();
  });

  it("도구 모음에서 막 떨어진 포커스(toolbarFocusHandoff)면 받지 않는다 — 문서 탐색에 Tab을 돌려준다(#275 리뷰 2차 대응)", () => {
    expect(siblingNavDirectionForKey(tabKey({ toolbarFocusHandoff: true }))).toBeNull();
    expect(
      siblingNavDirectionForKey(tabKey({ toolbarFocusHandoff: true, shiftKey: true })),
    ).toBeNull();
  });
});

/** Ctrl/Cmd/Alt가 안 눌린 Tab keydown. 케이스마다 필요한 칸만 덮어쓴다. */
function handoffKey(
  patch: Partial<ToolbarFocusHandoffConsumeInput> = {},
): ToolbarFocusHandoffConsumeInput {
  return { code: "Tab", ctrlKey: false, metaKey: false, altKey: false, ...patch };
}

describe("shouldConsumeToolbarFocusHandoff — Ctrl/Cmd/Alt가 안 눌린 Tab에서만 신호를 소비한다(#275 리뷰 3·6차 대응)", () => {
  it("Tab(Shift+Tab 포함)은 소비한다 — Shift는 소비 대상에서 빼지 않는다", () => {
    expect(shouldConsumeToolbarFocusHandoff(handoffKey())).toBe(true);
  });

  it("단독 modifier keydown은 소비하지 않는다 — 실제 키보드의 Shift+Tab은 ShiftLeft/ShiftRight가 Tab보다 먼저 따로 들어온다", () => {
    expect(shouldConsumeToolbarFocusHandoff(handoffKey({ code: "ShiftLeft" }))).toBe(false);
    expect(shouldConsumeToolbarFocusHandoff(handoffKey({ code: "ShiftRight" }))).toBe(false);
    expect(shouldConsumeToolbarFocusHandoff(handoffKey({ code: "ControlLeft" }))).toBe(false);
    expect(shouldConsumeToolbarFocusHandoff(handoffKey({ code: "AltLeft" }))).toBe(false);
    expect(shouldConsumeToolbarFocusHandoff(handoffKey({ code: "MetaLeft" }))).toBe(false);
  });

  it("그 밖의 키도 소비하지 않는다", () => {
    expect(shouldConsumeToolbarFocusHandoff(handoffKey({ code: "KeyD" }))).toBe(false);
    expect(shouldConsumeToolbarFocusHandoff(handoffKey({ code: "Escape" }))).toBe(false);
  });

  it("Ctrl/Cmd/Alt가 눌린 Tab은 소비하지 않는다(#275 리뷰 6차 대응) — siblingNavDirectionForKey가 애초에 그 조합을 제외하므로, 여기서 소비하면 다음 평범한 Tab이 신호를 잃는다", () => {
    expect(shouldConsumeToolbarFocusHandoff(handoffKey({ ctrlKey: true }))).toBe(false);
    expect(shouldConsumeToolbarFocusHandoff(handoffKey({ metaKey: true }))).toBe(false);
    expect(shouldConsumeToolbarFocusHandoff(handoffKey({ altKey: true }))).toBe(false);
  });
});

/** 노드가 선택된 채 컨텍스트 메뉴 키를 누른 상태. 케이스마다 필요한 칸만 덮어쓴다. */
function menuKey(patch: Partial<ContextMenuKeyInput> = {}): ContextMenuKeyInput {
  return {
    key: "ContextMenu",
    code: "ContextMenu",
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    tagName: "DIV",
    contentEditable: false,
    hasSelection: true,
    ...patch,
  };
}

describe("isContextMenuKey — 키보드로 컨텍스트 메뉴 열기(#152)", () => {
  it("컨텍스트 메뉴 전용 키를 받는다", () => {
    expect(isContextMenuKey(menuKey())).toBe(true);
  });

  it("Shift+F10도 같은 뜻이다", () => {
    expect(isContextMenuKey(menuKey({ key: "F10", code: "F10", shiftKey: true }))).toBe(
      true,
    );
  });

  it("Shift 없는 F10은 받지 않는다", () => {
    expect(isContextMenuKey(menuKey({ key: "F10", code: "F10", shiftKey: false }))).toBe(
      false,
    );
  });

  it("Ctrl/Cmd/Alt가 섞인 Shift+F10은 받지 않는다", () => {
    expect(
      isContextMenuKey(menuKey({ key: "F10", code: "F10", shiftKey: true, ctrlKey: true })),
    ).toBe(false);
    expect(
      isContextMenuKey(menuKey({ key: "F10", code: "F10", shiftKey: true, altKey: true })),
    ).toBe(false);
  });

  it("선택이 없으면 받지 않는다 — 열어도 빈 메뉴다", () => {
    expect(isContextMenuKey(menuKey({ hasSelection: false }))).toBe(false);
  });

  it("타이핑 중에는 받지 않는다", () => {
    expect(isContextMenuKey(menuKey({ tagName: "INPUT" }))).toBe(false);
    expect(isContextMenuKey(menuKey({ contentEditable: true }))).toBe(false);
  });

  it("관계없는 키는 받지 않는다", () => {
    expect(isContextMenuKey(menuKey({ key: "F9", code: "F9", shiftKey: true }))).toBe(
      false,
    );
  });
});

/** Select 도구로 노드 위를 왼쪽 버튼으로 누른 상태. 케이스마다 필요한 칸만 덮어쓴다. */
function dragStart(patch: Partial<NodeDragStartInput> = {}): NodeDragStartInput {
  return {
    button: 0,
    tool: "select",
    spacePanning: false,
    onResizeHandle: false,
    altKey: false,
    shiftKey: false,
    tagName: "DIV",
    contentEditable: false,
    ...patch,
  };
}

describe("canStartNodeDrag — 캔버스 노드 끌기(#187)를 시작할 수 있는가", () => {
  it("Select 도구 + 왼쪽 버튼이면 끌기 후보다", () => {
    expect(canStartNodeDrag(dragStart())).toBe(true);
  });

  it("Hand 도구는 팬이다 — 노드를 끌지 않는다", () => {
    expect(canStartNodeDrag(dragStart({ tool: "hand" }))).toBe(false);
  });

  it("만들기 도구는 클릭이 '여기에 만든다'라 끌지 않는다", () => {
    expect(canStartNodeDrag(dragStart({ tool: "frame" }))).toBe(false);
    expect(canStartNodeDrag(dragStart({ tool: "text" }))).toBe(false);
  });

  it("가운데 버튼은 도구와 무관하게 팬이다", () => {
    expect(canStartNodeDrag(dragStart({ button: 1 }))).toBe(false);
  });

  it("오른쪽 버튼은 컨텍스트 메뉴다", () => {
    expect(canStartNodeDrag(dragStart({ button: 2 }))).toBe(false);
  });

  it("스페이스 임시 팬 중이면 끌지 않는다 — activeTool 이 아직 select 로 보여도", () => {
    // 지금 구현은 스페이스를 누르면 activeTool 이 hand 로 바뀌지만, 그 구현에 기대지 않는다.
    expect(canStartNodeDrag(dragStart({ spacePanning: true }))).toBe(false);
    expect(canStartNodeDrag(dragStart({ tool: "hand", spacePanning: true }))).toBe(false);
  });

  it("리사이즈 핸들에서 시작한 mousedown 은 끌기가 아니다 — 크기를 바꾸려다 노드가 딸려 오면 안 된다", () => {
    expect(canStartNodeDrag(dragStart({ onResizeHandle: true }))).toBe(false);
  });

  it("Alt·Shift 를 누른 채면 끌지 않는다 — 거리 재기·(피그마의) 복제·축 고정 자리다", () => {
    expect(canStartNodeDrag(dragStart({ altKey: true }))).toBe(false);
    expect(canStartNodeDrag(dragStart({ shiftKey: true }))).toBe(false);
    expect(canStartNodeDrag(dragStart({ altKey: true, shiftKey: true }))).toBe(false);
  });

  it("Ctrl/Cmd 는 막지 않는다 — 클릭처럼 잡을 대상을 가장 안쪽으로 바꿀 뿐이다", () => {
    // 그래서 입력 모양에 ctrl/meta 칸이 없다 — Ctrl/Cmd 는 대상 해석(resolveClickTarget)이
    // deep 으로 받는다. 여기서 막는 칸을 더하면 이 테스트부터 고쳐야 한다.
    const input: NodeDragStartInput & { ctrlKey?: boolean; metaKey?: boolean } = {
      ...dragStart(),
      ctrlKey: true,
      metaKey: true,
    };
    expect(canStartNodeDrag(input)).toBe(true);
  });

  it("타이핑 중인 곳에서 시작했으면 끌지 않는다 — 글자를 고르려는 끌기다", () => {
    expect(canStartNodeDrag(dragStart({ tagName: "INPUT" }))).toBe(false);
    expect(canStartNodeDrag(dragStart({ contentEditable: true }))).toBe(false);
  });
});

describe("hasPassedDragThreshold — 클릭과 끌기의 경계", () => {
  it("임계값은 4px 이다", () => {
    expect(NODE_DRAG_THRESHOLD_PX).toBe(4);
  });

  it("안 움직였거나 손 떨림 정도면 아직 클릭이다", () => {
    expect(hasPassedDragThreshold(0, 0)).toBe(false);
    expect(hasPassedDragThreshold(2, -2)).toBe(false);
  });

  it("정확히 임계값이면 아직 클릭이다 — 넘어야 끌기다", () => {
    expect(hasPassedDragThreshold(4, 0)).toBe(false);
    expect(hasPassedDragThreshold(0, -4)).toBe(false);
  });

  it("임계값을 넘으면 끌기다 — 방향과 무관하다", () => {
    expect(hasPassedDragThreshold(5, 0)).toBe(true);
    expect(hasPassedDragThreshold(0, -5)).toBe(true);
    expect(hasPassedDragThreshold(-4, 4)).toBe(true); // 대각선 직선 거리 ≈ 5.66
  });

  it("축마다가 아니라 직선 거리로 잰다", () => {
    // 축마다 보면 3px·3px 은 둘 다 4 미만이라 클릭이지만, 직선 거리는 ≈ 4.24 다.
    expect(hasPassedDragThreshold(3, 3)).toBe(true);
  });
});


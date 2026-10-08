import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seedSpec } from "@/features/editor/store/seedSpec";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useExportStore } from "@/features/editor/store/exportStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { useViewStore } from "@/features/editor/store/viewStore";
import { openExportPanel } from "@/features/editor/ui/openExportPanel";
import { openTicketPanel } from "@/features/editor/ui/openTicketPanel";

// openExportPanel/openTicketPanel이 접힌 속성 패널을 펼 때 togglePropsPanel을
// 거치고(#287 리뷰 4차 대응), 그 함수가 window.innerWidth를 읽는다.
beforeEach(() => {
  vi.stubGlobal("window", { innerWidth: 1024 });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * `EditorLayout.tsx`는 `showExport`·`showTickets`가 둘 다 켜져 있으면 Export를
 * 우선 렌더링한다(`showExport ? ExportPanel : showTickets ? TicketPanel : ...`).
 * 그래서 Export가 열린 채로 "구현 티켓 열기"를 눌러도 `ticketStore.isOpen`만
 * 켜면 화면은 그대로 Export다 — 클릭이 아무 일도 안 한 것처럼 보인다(#283
 * 리뷰 대응). `openTicketPanel`이 Export를 같이 닫는지 고정한다.
 */
describe("openTicketPanel — Export가 열려 있으면 같이 닫는다(#283)", () => {
  beforeEach(() => {
    useEditorStore.getState().loadSpec(seedSpec);
    useExportStore.setState({ isOpen: false, status: "idle", files: [], report: null, target: null });
    useTicketStore.setState({ isOpen: false, tickets: [], sourcePageId: null, sourcePage: null });
    useViewStore.setState({ showPanels: true });
  });

  it("Export가 열려 있으면 openTicketPanel이 Export를 닫고 티켓 패널만 연다", () => {
    useExportStore.setState({ isOpen: true });

    openTicketPanel();

    expect(useExportStore.getState().isOpen).toBe(false);
    expect(useTicketStore.getState().isOpen).toBe(true);
  });

  it("아무 패널도 안 열려 있으면 티켓 패널만 연다(회귀 없음)", () => {
    openTicketPanel();

    expect(useExportStore.getState().isOpen).toBe(false);
    expect(useTicketStore.getState().isOpen).toBe(true);
  });
});

/**
 * 속성 패널이 32px 레일로 접혀 있을 때(#287) Export/구현 티켓을 열면 그
 * 자리에 전체 내용이 레일 폭으로 눌려 렌더될 수 있었다(#287 리뷰 대응) —
 * `view.showPanels`만 켜고 `view.propsCollapsed`는 안 풀었기 때문이다.
 * 두 open 함수 모두 접힘을 함께 푸는지 고정한다.
 */
describe("openExportPanel/openTicketPanel — 접힌 속성 패널을 함께 편다(#287 리뷰 대응)", () => {
  beforeEach(() => {
    useEditorStore.getState().loadSpec(seedSpec);
    useExportStore.setState({ isOpen: false, status: "idle", files: [], report: null, target: null });
    useTicketStore.setState({ isOpen: false, tickets: [], sourcePageId: null, sourcePage: null });
    useViewStore.setState({ showPanels: true, propsCollapsed: true });
  });

  it("openExportPanel은 propsCollapsed를 푼다", () => {
    openExportPanel();
    expect(useViewStore.getState().propsCollapsed).toBe(false);
  });

  it("openTicketPanel은 propsCollapsed를 푼다", () => {
    openTicketPanel();
    expect(useViewStore.getState().propsCollapsed).toBe(false);
  });

  it("이미 펼쳐져 있으면 그대로 둔다(회귀 없음)", () => {
    useViewStore.setState({ propsCollapsed: false });
    openExportPanel();
    expect(useViewStore.getState().propsCollapsed).toBe(false);
  });

  it("저장된 폭이 지금 기준 상한을 넘으면 그대로 복원하지 않는다(#287 리뷰 4차 대응) — 접기 전 openExportPanel.ts가 view.togglePropsCollapsed()를 직접 불러 이 보정을 비켜 갔었다", () => {
    useViewStore.setState({
      treeCollapsed: false,
      treeWidth: 480,
      propsCollapsed: true,
      propsWidth: 480,
    });

    openExportPanel();

    expect(useViewStore.getState().propsCollapsed).toBe(false);
    expect(useViewStore.getState().propsWidth).toBeLessThan(480);
  });
});

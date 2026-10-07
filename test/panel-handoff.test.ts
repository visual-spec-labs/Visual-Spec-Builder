import { beforeEach, describe, expect, it } from "vitest";

import { seedSpec } from "@/features/editor/store/seedSpec";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useExportStore } from "@/features/editor/store/exportStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { useViewStore } from "@/features/editor/store/viewStore";
import { openTicketPanel } from "@/features/editor/ui/openTicketPanel";

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

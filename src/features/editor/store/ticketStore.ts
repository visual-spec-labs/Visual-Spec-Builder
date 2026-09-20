import { create } from "zustand";

import type { PageId, ScreenSpec } from "@/features/editor/schema";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import { markTicketStatus } from "@/features/editor/ticket/ticketStatus";
import type { Ticket, TicketStatus } from "@/features/editor/ticket/types";

interface TicketState {
  tickets: Ticket[];
  sourcePageId: PageId | null;
  /** 컴파일 시점 참조. 현재 page 참조와 달라지면 UI가 오래된 계획임을 알린다. */
  sourcePage: ScreenSpec | null;
  isOpen: boolean;
  compile: (pageId: PageId, page: ScreenSpec) => void;
  markStatus: (id: string, status: TicketStatus) => void;
  close: () => void;
}

/**
 * GUI의 구현 티켓 패널 상태(#156).
 *
 * editorStore에 넣지 않는다. 티켓은 IR 자체도 Undo 대상도 아니고, 화면을 구현하기
 * 위한 파생 계획이다. navigationStore/viewStore/documentStore처럼 수명이 다른 상태를
 * 분리한다. 실제 에이전트 실행 루프는 아직 없으며 이 스토어가 그 상태 자리를 먼저 만든다.
 */
export const useTicketStore = create<TicketState>((set) => ({
  tickets: [],
  sourcePageId: null,
  sourcePage: null,
  isOpen: false,
  compile: (pageId, page) =>
    set({
      tickets: compileTickets(page),
      sourcePageId: pageId,
      sourcePage: page,
      isOpen: true,
    }),
  markStatus: (id, status) =>
    set((state) => ({ tickets: markTicketStatus(state.tickets, id, status) })),
  close: () => set({ isOpen: false }),
}));

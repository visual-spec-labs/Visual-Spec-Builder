import { create } from "zustand";

import type { PageId, ScreenSpec } from "@/features/editor/schema";
import { compileTickets } from "@/features/editor/ticket/compileTickets";
import { useEditorStore } from "./editorStore";
import { markTicketStatus } from "@/features/editor/ticket/ticketStatus";
import type { Ticket, TicketStatus } from "@/features/editor/ticket/types";

interface TicketState {
  tickets: Ticket[];
  sourcePageId: PageId | null;
  /** 컴파일 시점 참조. 현재 page 참조와 달라지면 UI가 오래된 계획임을 알린다. */
  sourcePage: ScreenSpec | null;
  /** 컴파일 시점의 `editorStore.documentId`(#271). 페이지가 같은 참조여도 문서가 바뀌었는지 가른다. */
  sourceDocumentId: number | null;
  isOpen: boolean;
  /** 웨이브 하나가 요청을 보내고 응답을 기다리는 동안 true다. `ui/ticketRunner.ts`가 쓴다. */
  running: boolean;
  /** 마지막 웨이브의 전송·타임아웃 오류(개별 티켓 실패가 아니라 배치 자체의 실패). */
  runError: string | null;
  /**
   * `runError`가 timeout이라 "위쪽 전달 버튼을 다시 눌러 새 요청을 만들라"는
   * 안내가 뜻이 있는가(#283 리뷰 대응). timeout이 아닌 다른 원인(작업공간 연결
   * 끊김·다른 탭 잠금 등)은 같은 안내를 붙이면 엉뚱한 해결책을 가리키게 된다.
   */
  runErrorRetryable: boolean;
  /**
   * `compile`이 불릴 때마다 하나씩 늘어난다(이슈 #184). `ui/ticketRunner.ts`가 웨이브를
   * 시작할 때 이 값을 함께 들고 있다가, 응답을 받은 뒤 값이 달라졌으면(그 사이
   * 재컴파일됐으면) 응답을 버린다. `sourcePage` 참조 비교가 아니라 이 값을 쓰는
   * 이유는, 내용이 같은 페이지로 재컴파일해도(사용자가 그냥 "다시 생성"을 눌러도)
   * `sourcePage`가 우연히 같은 참조일 수 있어 그 비교만으로는 놓치는 경우가 있어서다.
   */
  generation: number;
  compile: (pageId: PageId, page: ScreenSpec) => void;
  markStatus: (id: string, status: TicketStatus) => void;
  close: () => void;
}

/**
 * GUI의 구현 티켓 패널 상태(#156의 A안 → #184에서 실행 왕복 추가).
 *
 * editorStore에 넣지 않는다. 티켓은 IR 자체도 Undo 대상도 아니고, 화면을 구현하기
 * 위한 파생 계획이다. navigationStore/viewStore/documentStore처럼 수명이 다른 상태를
 * 분리한다.
 *
 * **이 파일은 순수하다 — `fetch`도 `ui/workspaceClient.ts`도 import하지 않는다.**
 * `tsconfig.uitest.json`의 규칙이 그 경계다: DOM 타입을 만지는 코드는 `ui/`에만
 * 두고, `store/`는 `tsconfig.node.json`(`lib: ["ES2022"]`, DOM 없음)으로 검사해
 * 경계를 타입 단계에서 강제한다. 실제 요청/폴링·웨이브 체이닝·취소는
 * `ui/ticketRunner.ts`가 이 스토어를 `getState`/`setState`로 조작하며 맡는다
 * (`nl/nlAgentClient.ts`가 store가 아니라 `ui/NaturalLanguageBar.tsx`에서만
 * 쓰이는 것과 같은 이유).
 */
export const useTicketStore = create<TicketState>((set) => ({
  tickets: [],
  sourcePageId: null,
  sourcePage: null,
  sourceDocumentId: null,
  isOpen: false,
  running: false,
  runError: null,
  runErrorRetryable: false,
  generation: 0,
  compile: (pageId, page) =>
    set((state) => ({
      tickets: compileTickets(page),
      sourcePageId: pageId,
      sourcePage: page,
      sourceDocumentId: useEditorStore.getState().documentId,
      isOpen: true,
      running: false,
      runError: null,
      runErrorRetryable: false,
      generation: state.generation + 1,
    })),
  markStatus: (id, status) =>
    set((state) => ({ tickets: markTicketStatus(state.tickets, id, status) })),
  close: () => set({ isOpen: false }),
}));

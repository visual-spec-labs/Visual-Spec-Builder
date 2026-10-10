import { describe, expect, it } from "vitest";

import {
  buildTicketRequest,
  parseTicketResponse,
  TICKET_PROTOCOL_VERSION,
  TICKET_REQUEST_PATH,
  TICKET_RESPONSE_PATH,
  ticketOutputPath,
} from "@/features/editor/ticket/ticketProtocol";
import { GENERATION_MANIFEST_PATH } from "@/features/editor/export/generationManifest";
import { ticketFilePath } from "@/features/editor/export/generatedPaths";
import type { Ticket } from "@/features/editor/ticket/types";
import { resolveWorkspaceFile } from "@/features/workspace/workspacePath";
import type { ScreenSpec } from "@/features/editor/schema";

/**
 * 티켓 실행 요청/응답 규약 (이슈 #184). `nl-protocol.test.ts`와 같은 태도다 —
 * 응답은 바깥에서 온 값이라 절반은 "망가진 입력"을 다룬다.
 */

const page: ScreenSpec = {
  name: "Home",
  size: { width: 390, height: 844 },
  root: "root",
  nodes: {
    root: {
      type: "frame",
      name: "Screen",
      box: { width: "fill", height: "fill" },
      layout: {
        direction: "column",
        gap: 8,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        mainAxis: "start",
        crossAxis: "stretch",
      },
      background: [{ type: "solid", color: "#FFFFFF" }],
      children: [],
    },
  },
};

const pageTicket: Ticket = {
  id: "Home",
  componentName: "Home",
  kind: "page",
  instances: ["root"],
  dependsOn: [],
  status: "pending",
};

function responseText(body: unknown): string {
  return JSON.stringify(body);
}

describe("buildTicketRequest", () => {
  it("규약 버전과 응답 자리를 요청에 함께 싣고, 각 티켓의 filePath를 채운다", () => {
    const request = buildTicketRequest({
      id: "wave-1",
      pageId: "home",
      page,
      tickets: [pageTicket],
      generatedRoot: "shop/home",
    });

    expect(request).toMatchObject({
      protocol: TICKET_PROTOCOL_VERSION,
      id: "wave-1",
      pageId: "home",
      responsePath: TICKET_RESPONSE_PATH,
    });
    // 에이전트가 노드 구조를 여기서 읽는다 — 요약본이 아니라 그대로다.
    expect(request.page).toBe(page);
    expect(request.tickets).toEqual([
      {
        id: "Home",
        componentName: "Home",
        kind: "page",
        instances: ["root"],
        // 확정될 자리는 프로젝트·페이지 생성 자리 아래다(#281).
        filePath: `shop/home/${ticketFilePath(pageTicket)}`,
        // 에이전트는 확정될 자리가 아니라 요청 전용 임시 출력에 쓴다(#284).
        outputPath: `staging/wave-1/shop/home/${ticketFilePath(pageTicket)}`,
      },
    ]);
    expect(request.outputRoot).toBe("staging/wave-1");
    expect(request.generatedRoot).toBe("shop/home");
  });
});

describe("요청·응답 경로는 미들웨어 화이트리스트를 통과한다", () => {
  const ROOT = "/tmp/proj/.visual-spec";

  it.each([TICKET_REQUEST_PATH, TICKET_RESPONSE_PATH])("%s", (path) => {
    expect(resolveWorkspaceFile(ROOT, path).ok).toBe(true);
  });

  // GUI가 확정할 때 읽는 임시 출력과 쓰는 수용 기록도 같은 방어를 지난다(#284).
  it.each([
    ticketOutputPath("8f14e45f-ceea-467f-a0e6-7b7f5f3a1c2d", "pages/Home.tsx"),
    ticketOutputPath("ticket-1700000000000-abc123", "components/Card.tsx"),
    GENERATION_MANIFEST_PATH,
  ])("%s", (path) => {
    expect(resolveWorkspaceFile(ROOT, path).ok).toBe(true);
  });
});

describe("parseTicketResponse — 기다림을 끝낼지 판정한다", () => {
  it("파일이 아직 없으면 stale이다 — 계속 기다린다", () => {
    expect(parseTicketResponse(null, "wave-1")).toEqual({ kind: "stale" });
  });

  it("requestId가 다르면 stale이다 — 낡은 응답을 이번 답으로 쓰지 않는다", () => {
    const text = responseText({
      protocol: TICKET_PROTOCOL_VERSION,
      requestId: "wave-0",
      results: [{ ticketId: "Home", status: "done" }],
    });

    expect(parseTicketResponse(text, "wave-1")).toEqual({ kind: "stale" });
  });

  it("JSON이 아니면 malformed — 예외를 던지지 않는다", () => {
    expect(parseTicketResponse("{ 이건 JSON이 아니다", "wave-1").kind).toBe("malformed");
  });

  it("객체가 아니면 malformed", () => {
    expect(parseTicketResponse("[]", "wave-1").kind).toBe("malformed");
    expect(parseTicketResponse("42", "wave-1").kind).toBe("malformed");
    expect(parseTicketResponse("null", "wave-1").kind).toBe("malformed");
  });

  it("규약 버전이 다르면 malformed", () => {
    const text = responseText({ protocol: 99, requestId: "wave-1", results: [] });
    const result = parseTicketResponse(text, "wave-1");

    expect(result.kind).toBe("malformed");
    if (result.kind === "malformed") expect(result.message).toContain("99");
  });

  it("results가 배열이 아니면 malformed", () => {
    const text = responseText({ protocol: TICKET_PROTOCOL_VERSION, requestId: "wave-1" });

    expect(parseTicketResponse(text, "wave-1").kind).toBe("malformed");
  });

  it("results 항목에 알 수 없는 status가 섞이면 malformed", () => {
    const text = responseText({
      protocol: TICKET_PROTOCOL_VERSION,
      requestId: "wave-1",
      results: [{ ticketId: "Home", status: "in-progress" }],
    });

    expect(parseTicketResponse(text, "wave-1").kind).toBe("malformed");
  });

  it("results 항목에 ticketId가 없으면 malformed", () => {
    const text = responseText({
      protocol: TICKET_PROTOCOL_VERSION,
      requestId: "wave-1",
      results: [{ status: "done" }],
    });

    expect(parseTicketResponse(text, "wave-1").kind).toBe("malformed");
  });

  it("빈 results 배열도 통과한다 — 웨이브에 티켓이 없을 수 있다는 뜻은 아니지만 규약상 막을 이유가 없다", () => {
    const text = responseText({ protocol: TICKET_PROTOCOL_VERSION, requestId: "wave-1", results: [] });

    expect(parseTicketResponse(text, "wave-1")).toEqual({ kind: "results", results: [] });
  });

  it("규약을 지키면 done·failed 결과를 그대로 돌려준다", () => {
    const text = responseText({
      protocol: TICKET_PROTOCOL_VERSION,
      requestId: "wave-1",
      results: [
        { ticketId: "Header", status: "done" },
        { ticketId: "Card", status: "failed", message: "props 추론 실패" },
      ],
    });

    expect(parseTicketResponse(text, "wave-1")).toEqual({
      kind: "results",
      results: [
        { ticketId: "Header", status: "done" },
        { ticketId: "Card", status: "failed", message: "props 추론 실패" },
      ],
    });
  });
});

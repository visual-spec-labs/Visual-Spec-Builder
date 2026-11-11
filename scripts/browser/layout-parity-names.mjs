// layout-parity.mjs가 생성 페이지 파일을 고르는 이름(PR #358 리뷰).
// Export·티켓 전달과 같은 compileTickets 결과에서 kind=page 티켓의 componentName을 쓴다.
// screen.name이나 toPascalCase만 따로 적용하면 공백·한글 이름, 자식 컴포넌트와의 충돌 접미사(Header2 등)가 어긋난다.
// layout-parity.mjs는 GUI 탭의 Vite로 이 모듈을 불러 같은 TS 소스를 쓴다(Node에서 TS를 직접 읽지 않는다).
import { compileTickets } from "../../src/features/editor/ticket/compileTickets.ts";

/** 생성 결과 `pages/<이름>.tsx`의 <이름>. page 티켓이 없으면(root가 frame이 아님) null. */
export function pageComponentName(screen) {
  return compileTickets(screen).find((ticket) => ticket.kind === "page")?.componentName ?? null;
}

# visual-spec-ticket-response — 설명

[배포 스킬](../../skills/visual-spec-ticket-response/SKILL.md)은 GUI가 남긴
`.visual-spec/runtime/ticket-request.json`을 읽고, 해당 웨이브의 React/Tailwind 파일과
`ticket-response.json`을 작성하는 외부 에이전트 지침이다. 앱이 AI를 직접 호출하는 기능이나
결정적인 코드 생성 엔진은 아니다.

## 사용 흐름

1. 사용자 프로젝트에서 `visual-spec skills`로 스킬 사본을 설치/갱신한다. 설치 명령은
   `.claude/skills/`(Claude Code)와 `.agents/skills/`(Codex)에 복사한다. 그 밖의 에이전트에는
   설치된 SKILL.md 경로를 직접 알려준다.
2. `visual-spec`을 인자 없이 실행해 GUI를 열고, 티켓을 생성한 뒤 실행한다.
3. 같은 프로젝트를 여는 외부 에이전트에게 현재 `ticket-request.json` 처리를 요청한다.
4. 에이전트는 to-react 매핑을 참고하되 요청의 `filePath`에 해당하는 파일만 작성한다.
   경로는 `.visual-spec/generated/` 기준이다. 이전 웨이브의 의존 파일은 보존한다.
5. `{ protocol, requestId, results }` 응답을 쓰면 GUI가 티켓 상태를 갱신하고, 전체 실행이면
   다음 웨이브를 요청한다. 실패에는 티켓별 이유가 표시된다.
6. 완료 후 GUI Export 검사를 수행한다. 컴파일·렌더링·화면 일치는 별도 확인한다.

요청은 `TicketRequest`, 응답은 `TicketResultItem[]`를 담는 별도 프로토콜이다.
Ticket 스키마나 자연어 `commands` 형식을 응답에 쓰지 않는다. 정본은
[ticketProtocol.ts](../../src/features/editor/ticket/ticketProtocol.ts)이고 실행 절차·완전한
요청/성공/실패 예제는 배포 스킬에 있다.

## 한계

GUI의 중지는 에이전트 프로세스를 종료하지 않는다. 에이전트가 요청 ID를 다시 확인해도
파일 교환에는 잠금·취소 신호가 없어 동시 작업의 완전한 방지는 보장되지 않는다.
오래된 요청을 자동 재처리하지 말고, 중지 후 파일이 남았다면 사용자에게 알린다.

스킬 계약 테스트는 예제와 실제 파서의 호환성 및 CLI 배포를 검사한다. 외부 AI가 인증된
상태에서 작업을 수행했다는 증거는 아니다.

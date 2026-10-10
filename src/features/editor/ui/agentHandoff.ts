/**
 * 수동 에이전트에게 그대로 건넬 지시문을 만든다(#283).
 *
 * GUI는 LLM을 직접 실행하지 않는다(#219, A안) — 사람이 터미널에서 띄운
 * Claude Code/Codex가 요청 파일을 읽고 응답 파일을 쓸 때까지 기다릴 뿐이다.
 * 지금까지는 그 사실을 "에이전트에게 `.visual-spec/runtime/...`를 읽게
 * 하세요" 같은 구현 세부사항으로만 전달했다 — 정작 에이전트 세션에 무엇을
 * 입력해야 하는지는 `docs/14-getting-started.md` 4·5절에만 적혀 있었다.
 *
 * 여기 문구는 그 문서의 지시문과 같은 내용을 같은 소스(프로토콜 경로 상수)에서
 * 만든다 — 경로가 바뀌면 문서와 GUI가 같이 바뀐다. 요청 ID는 넣지 않는다 —
 * ID는 전달 버튼을 눌러야 생기고, "현재 요청을 처리해 줘"라는 일반형 문장은
 * ID 없이도 성립한다(`docs/14`의 지시문도 ID를 넣지 않는다).
 *
 * 설치 위치(`.claude/skills/` 또는 `.agents/skills/`)는 말하지 않는다 — GUI는
 * 사용자가 Claude Code와 Codex 중 무엇을 설치했는지 모른다(`visual-spec skills`
 * 는 기본으로 둘 다에 설치한다, `docs/14` 2절).
 */

import { NL_REQUEST_PATH } from "@/features/editor/nl/nlProtocol";
import { TICKET_PROTOCOL_VERSION, TICKET_REQUEST_PATH } from "@/features/editor/ticket/ticketProtocol";
import { WORKSPACE_DIR_NAME } from "@/features/workspace/protocol";

/** 자연어 편집 요청에 응답하도록 에이전트에게 건넬 문단. */
export function buildNlAgentInstruction(): string {
  return (
    `visual-spec-nl-response 스킬을 읽고 현재 ${WORKSPACE_DIR_NAME}/${NL_REQUEST_PATH}에 ` +
    `응답해 줘. 요청의 ID·범위를 지키고, 문서 파일을 직접 수정하지 말고 그 스킬의 ` +
    `Command 응답 형식으로 작성해 줘.`
  );
}

/** 구현 티켓 웨이브를 처리하도록 에이전트에게 건넬 문단. */
export function buildTicketAgentInstruction(): string {
  return (
    `visual-spec-ticket-response 스킬과 그 스킬이 참조하는 visual-spec-to-react ` +
    `지침을 읽고, 현재 ${WORKSPACE_DIR_NAME}/${TICKET_REQUEST_PATH}의 한 웨이브를 처리해 줘. ` +
    `요청된 파일을 실제로 생성·확인한 뒤 결과 응답을 써 줘. 수행한 검증과 미실행 ` +
    `검증을 구분해 줘. 요청의 protocol(티켓 요청 규약 v${TICKET_PROTOCOL_VERSION})을 스킬이 지원하지 않으면 ` +
    `파일을 쓰지 말고 \`visual-spec skills\`로 스킬을 갱신하라고 알려 줘.`
  );
}

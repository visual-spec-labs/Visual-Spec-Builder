import { WORKSPACE_DIR_NAME } from "@/features/workspace/protocol";

/**
 * 요청/응답 경로(와 있으면 작업공간 절대 경로) — 기본으로 접혀 있다(#283).
 * `TicketPanel`·`NaturalLanguageBar`가 거의 같은 모양으로 각자 갖고 있던 것을
 * 하나로 묶었다(#283 리뷰 대응) — 둘 다 "자세히"를 열면 요청/응답 파일 경로를
 * 보여주는 같은 목적이라, 따로 둘 이유가 없었다.
 */
export function HandoffDetails({
  requestPath,
  responsePath,
  workspaceRoot = null,
}: {
  requestPath: string;
  responsePath: string;
  workspaceRoot?: string | null;
}) {
  return (
    <details className="text-content-subtle">
      <summary className="cursor-pointer select-none">자세히</summary>
      <p className="mt-1">
        요청: <code>{WORKSPACE_DIR_NAME}/{requestPath}</code> · 응답:{" "}
        <code>{WORKSPACE_DIR_NAME}/{responsePath}</code>
        {workspaceRoot !== null && (
          <>
            {" "}
            · 작업공간: <code>{workspaceRoot}</code>
          </>
        )}
      </p>
    </details>
  );
}

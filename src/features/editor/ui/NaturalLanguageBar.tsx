import { useEffect, useRef, useState, type FormEvent } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import type { ProjectSpec } from "@/features/editor/schema";
import {
  describeCommandIssues,
  describeCommands,
  describeTransactionFailure,
} from "@/features/editor/nl/nlMessage";
import {
  createNlRequestId,
  requestNlEdit,
  type NlCancelToken,
} from "@/features/editor/nl/nlAgentClient";
import { NL_REQUEST_PATH, NL_RESPONSE_PATH, type NlScopeKind } from "@/features/editor/nl/nlProtocol";
import type { Command } from "@/features/editor/command/types";
import { runTransactionGates } from "@/features/editor/command/transactionGate";
import { changedBackgroundNodes } from "@/features/editor/nl/backgroundChange";
import { resolveScope, scopeOptions } from "@/features/editor/nl/nlScope";
import { buildNlAgentInstruction } from "@/features/editor/ui/agentHandoff";
import { CopyButton } from "@/features/editor/ui/CopyButton";
import { HandoffDetails } from "@/features/editor/ui/HandoffDetails";

/**
 * 캔버스 아래 전폭 행에 붙는 자연어 입력창 (이슈 #155).
 *
 * 자리는 docs/08-natural-language.md 6.3이 정했다 — 04-gui-spec.md §3 도식의
 * *"AI 입력: 선택한 요소를 어떻게 변경할까요?"* 행이다. 좌우 패널 폭 안이 아니라
 * 3열 전폭인 이유도 거기 있다: 적용 대상 표시와 결과 한 줄이 입력칸과 같은 자리에
 * 들어가야 하기 때문이다.
 *
 * ## 이 컴포넌트가 하는 일과 안 하는 일
 *
 * 하는 일은 넷이다 — 적용 대상 표시(03-user-flow.md), 자연어를 에이전트에게
 * 건네고 Command 배열을 받아오기(`nl/nlAgentClient.ts`), 받은 배열을
 * `applyGuardedTransaction`에 넣기, 그 결과를 **한 자리에** 내기.
 *
 * 검증 규칙은 재정의하지 않는다 — G1은 `nlProtocol.parseNlResponse`가 맡는다.
 * 배경 확인 전 G2·G3 순수 관문으로 미리 계산하고, 동의 후에는
 * `editorStore.applyGuardedTransaction`이 같은 관문으로 재검증한다(docs/08 4.2).
 *
 * ## 알림은 한 자리로만
 *
 * docs/08 4.3의 결정이다 — `window.alert`도 `console.warn`도 쓰지 않는다.
 * 성공·실패·진행 중이 전부 입력칸 아래 같은 줄에 나온다. 성공 줄의 `[되돌리기]`는
 * `editorStore.undo`를 그대로 부른다(5절: 요청 하나 = Undo 한 단계).
 */

type Feedback =
  | { kind: "none" }
  | { kind: "pending" }
  | {
      kind: "error";
      message: string;
      /**
       * timeout일 때만 true다(#283 리뷰 대응) — 그때만 "위쪽 요청을 다시 눌러
       * 새 요청을 만든 뒤 전달하라"는 안내가 맞다. 다른 실패(작업공간 연결
       * 끊김·다른 탭 잠금·Command 검증 실패 등)는 폴링이 아예 없었거나 이미
       * 정상 종료된 뒤라 같은 안내가 엉뚱한 해결책을 가리킨다.
       */
      retryable?: boolean;
    }
  | {
      kind: "confirmation";
      spec: ProjectSpec;
      pageId: string;
      commands: Command[];
      names: string[];
      revision: number;
    }
  /**
   * `spec`은 이 트랜잭션이 커밋한 바로 그 프로젝트 참조다.
   *
   * `[되돌리기]`가 **자기 요청만** 되돌리게 하려고 들고 있는다. 이게 없으면
   * 사용자가 Ctrl+Z로 먼저 되돌린 뒤 그대로 남아 있는 `[되돌리기]`를 눌러
   * **그 앞의 남의 편집**을 되돌린다. 스토어의 spec이 커밋 직후와 달라졌다면
   * 그 사이 무엇인가 있었다는 뜻이므로 줄을 통째로 거둔다.
   */
  | { kind: "success"; message: string; spec: ProjectSpec };

export function NaturalLanguageBar() {
  const pageId = useEditorStore((state) => state.activePageId);
  const spec = useEditorStore((state) => state.spec);
  const page = useEditorStore((state) => state.spec.pages[state.activePageId]);
  const selectedId = useEditorStore((state) => state.selectedId);

  const [instruction, setInstruction] = useState("");
  const [scopeOverride, setScopeOverride] = useState<NlScopeKind | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "none" });

  // 페이지를 바꿨다 돌아오거나 Undo로 같은 참조를 복원해도 낡은 동의는 재사용하지 않는다.
  const revisionRef = useRef(0);
  useEffect(() => useEditorStore.subscribe((next, previous) => {
    if (next.spec !== previous.spec || next.activePageId !== previous.activePageId) {
      revisionRef.current += 1;
    }
  }), []);

  // 진행 중인 요청의 취소 토큰. 값이 있으면 "기다리는 중"이다.
  const cancelRef = useRef<NlCancelToken | null>(null);

  // 선택이나 페이지가 바뀌면 사용자가 고른 범위를 버리고 기본값으로 돌아간다 —
  // 다른 노드를 고른 뒤에도 "현재 화면"이 남아 있으면 적용 대상이 조용히 어긋난다.
  useEffect(() => {
    setScopeOverride(null);
  }, [selectedId, pageId]);

  // 언마운트되면 돌고 있던 폴링 루프를 끊는다. 안 끊으면 사라진 컴포넌트가
  // 3분 동안 1초마다 GET을 보낸다.
  useEffect(() => {
    return () => {
      if (cancelRef.current !== null) cancelRef.current.cancelled = true;
    };
  }, []);

  const scope = resolveScope(page, selectedId, scopeOverride);
  const options = scopeOptions(page, selectedId);
  const pending = feedback.kind === "pending" || feedback.kind === "confirmation";
  // 성공 줄은 그 편집이 아직 현재 상태일 때만 유효하다(위 Feedback 주석).
  const shown: Feedback =
    feedback.kind === "success" && feedback.spec !== spec ? { kind: "none" } : feedback;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = instruction.trim();
    if (text === "" || pending) return;

    const requestRevision = revisionRef.current;
    const token: NlCancelToken = { cancelled: false };
    cancelRef.current = token;
    setFeedback({ kind: "pending" });

    const outcome = await requestNlEdit(
      { id: createNlRequestId(), instruction: text, scope, pageId, page },
      token,
    );

    // 취소됐거나 그 사이 다른 요청이 시작됐으면 이 결과는 버린다.
    if (token.cancelled || cancelRef.current !== token) return;
    cancelRef.current = null;

    if (outcome.kind === "cancelled") {
      setFeedback({ kind: "none" });
      return;
    }
    if (outcome.kind !== "response") {
      // timeout일 때만 재전달 안내를 붙인다 — unavailable·busy·writeFailed는
      // 애초에 요청이 안 쓰였거나 다른 탭이 잠금을 쥐고 있어, "다시 눌러 새
      // 요청을 만들라"는 문구가 실제 원인과 안 맞는다(#283 리뷰 대응).
      setFeedback({ kind: "error", message: outcome.message, retryable: outcome.kind === "timeout" });
      return;
    }

    const result = outcome.result;
    if (result.kind === "malformed" || result.kind === "agentError") {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    if (result.kind === "invalid") {
      setFeedback({ kind: "error", message: describeCommandIssues(result.issues) });
      return;
    }
    if (result.kind === "stale") {
      // requestNlEdit이 stale을 돌려주지 않지만(계속 기다린다) 타입은 열려 있다.
      setFeedback({ kind: "error", message: "이번 요청의 응답이 아닙니다." });
      return;
    }

    const current = useEditorStore.getState();
    if (
      revisionRef.current !== requestRevision || current.spec !== spec ||
      current.activePageId !== pageId
    ) {
      setFeedback({ kind: "error", message: "문서나 화면이 바뀌었습니다. 변경된 상태에서 다시 요청하세요." });
      return;
    }
    const preview = runTransactionGates(current.spec, pageId, result.commands);
    if (!preview.ok) {
      setFeedback({ kind: "error", message: describeTransactionFailure(preview.failure) });
      return;
    }
    const names = changedBackgroundNodes(page, preview.screen);
    if (names.length > 0) {
      setFeedback({
        kind: "confirmation", spec: current.spec, pageId,
        commands: result.commands, names, revision: requestRevision,
      });
      return;
    }
    commit(result.commands, pageId);
  }

  function commit(commands: Command[], targetPageId: string) {
    // G2·G3 + 커밋. 실패하면 spec은 전혀 바뀌지 않는다(전부-또는-전무).
    const gate = useEditorStore.getState().applyGuardedTransaction(targetPageId, commands);
    if (!gate.ok) {
      setFeedback({ kind: "error", message: describeTransactionFailure(gate.failure) });
      return;
    }

    setInstruction("");
    setFeedback({
      kind: "success",
      message: describeCommands(commands),
      spec: useEditorStore.getState().spec,
    });
  }

  function confirmBackground() {
    if (feedback.kind !== "confirmation") return;
    const current = useEditorStore.getState();
    if (
      revisionRef.current !== feedback.revision || current.spec !== feedback.spec ||
      current.activePageId !== feedback.pageId
    ) {
      setFeedback({ kind: "error", message: "확인 중 문서나 화면이 바뀌었습니다. 다시 요청하세요." });
      return;
    }
    commit(feedback.commands, feedback.pageId);
  }

  function cancelPending() {
    if (cancelRef.current !== null) cancelRef.current.cancelled = true;
    cancelRef.current = null;
    setFeedback({ kind: "none" });
  }

  return (
    // z-20 으로 둔다 — 도구 모음(z-10)이 숨을 때 아래로 미끄러지며 이 행 위를
    // 스쳐 지나간다. 그때 입력칸이 가려지지 않게 이쪽이 위에 있어야 한다.
    <section
      aria-label="자연어 편집"
      className="z-20 flex flex-col gap-2 border-t border-line bg-surface px-4 py-3 [grid-area:ai]"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-semibold tracking-wide text-content-muted uppercase">
          적용 대상
        </span>
        {/* 03-user-flow.md 의 라디오 두 칸. "전체 프로젝트"는 1차에서 뺐다(docs/08 7.2). */}
        {options.map((option) => (
          <label
            key={option.kind}
            className={`flex items-center gap-1 text-xs ${
              option.disabled ? "text-content-subtle" : "text-content"
            }`}
          >
            <input
              type="radio"
              name="nl-scope"
              value={option.kind}
              checked={scope.kind === option.kind}
              disabled={option.disabled}
              onChange={() => setScopeOverride(option.kind)}
            />
            {option.label}
          </label>
        ))}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          type="text"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          disabled={pending}
          aria-label="자연어 편집 요청"
          placeholder={`${scope.label} — 어떻게 변경할까요? (예: 간격을 24로 해줘)`}
          className="min-w-0 flex-1 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-content placeholder:text-content-muted disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || instruction.trim() === ""}
          className="rounded-control bg-primary px-3 py-2 text-sm text-text-on-accent disabled:opacity-50"
        >
          요청
        </button>
        {pending && (
          <button
            type="button"
            onClick={cancelPending}
            className="rounded-control border border-line px-3 py-2 text-sm text-content hover:bg-hover"
          >
            취소
          </button>
        )}
      </form>

      {/* 알림 한 자리(docs/08 4.3). role=status 라 스크린 리더도 같은 줄을 읽는다.
          div로 두는 이유는 pending 상태의 <details>가 <p> 안에 못 들어가서다
          (HTML이 <p> 안의 블록 요소를 만나면 <p>를 조기에 닫아 버린다). */}
      <div role="status" aria-live="polite" className="min-h-4 text-xs">
        {shown.kind === "pending" && (
          <div className="flex flex-col gap-1 text-content-muted">
            <span className="flex flex-wrap items-center gap-2">
              에이전트 응답 대기 중 — 아직 전달하지 않았다면 지시를 복사해 에이전트에
              붙여 넣으세요.
              <CopyButton text={buildNlAgentInstruction()} />
            </span>
            <HandoffDetails requestPath={NL_REQUEST_PATH} responsePath={NL_RESPONSE_PATH} />
          </div>
        )}
        {shown.kind === "confirmation" && (
          <span className="text-content">
            기존 배경 겹이 없어지거나 순서·내용이 바뀝니다: {shown.names.join(", ")}. 적용할까요?{" "}
            <button type="button" onClick={confirmBackground} className="underline hover:text-content">
              변경 적용
            </button>{" "}
            <button type="button" onClick={cancelPending} className="underline hover:text-content">
              적용 취소
            </button>
          </span>
        )}
        {shown.kind === "error" && (
          <div className="flex flex-col gap-1">
            <span className="text-error">{shown.message}</span>
            {/* timeout일 때만 보여준다 — 그때만 GUI 폴링이 이미 끝나고 요청 잠금도
                풀려서, 지금 지시를 복사해 에이전트에 줘도 GUI가 응답을 받을
                리스너가 없다(#283 리뷰 대응). 입력칸의 문구는 그대로 남아 있으니
                "요청"을 다시 누르면 같은 내용으로 새 요청이 되고, 그때 지시 복사
                버튼(= `pending` 분기)이 뜬다. */}
            {shown.retryable && (
              <span className="text-content-muted">
                다시 보내려면 위쪽 "요청"을 다시 눌러 새 요청을 만든 뒤 그 지시를
                에이전트에 전달하세요.
              </span>
            )}
            {/* timeout 메시지는 원시 경로를 더 이상 담지 않는다(#283, nlAgentClient.ts) —
                실패 상태에서도 "자세히"로 같은 정보를 볼 수 있어야 한다. */}
            <HandoffDetails requestPath={NL_REQUEST_PATH} responsePath={NL_RESPONSE_PATH} />
          </div>
        )}
        {shown.kind === "success" && (
          <span className="text-content-muted">
            {shown.message}{" "}
            <button
              type="button"
              onClick={() => {
                useEditorStore.getState().undo();
                setFeedback({ kind: "none" });
              }}
              className="underline hover:text-content"
            >
              되돌리기
            </button>
          </span>
        )}
      </div>
    </section>
  );
}

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
import { resolveScope, scopeOptions } from "@/features/editor/nl/nlScope";

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
 * 검증은 하지 않는다 — G1은 `nlProtocol.parseNlResponse`가, G2·G3는
 * `editorStore.applyGuardedTransaction`이 이미 한다(docs/08 4.2). 여기서 다시
 * 재면 같은 규칙이 두 벌이 된다.
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
  | { kind: "error"; message: string }
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
  const pending = feedback.kind === "pending";
  // 성공 줄은 그 편집이 아직 현재 상태일 때만 유효하다(위 Feedback 주석).
  const shown: Feedback =
    feedback.kind === "success" && feedback.spec !== spec ? { kind: "none" } : feedback;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = instruction.trim();
    if (text === "" || pending) return;

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
      setFeedback({ kind: "error", message: outcome.message });
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

    // G2·G3 + 커밋. 실패하면 spec은 전혀 바뀌지 않는다(전부-또는-전무).
    const gate = useEditorStore.getState().applyGuardedTransaction(pageId, result.commands);
    if (!gate.ok) {
      setFeedback({ kind: "error", message: describeTransactionFailure(gate.failure) });
      return;
    }

    setInstruction("");
    setFeedback({
      kind: "success",
      message: describeCommands(result.commands),
      spec: useEditorStore.getState().spec,
    });
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
          className="min-w-0 flex-1 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-content placeholder:text-content-subtle disabled:opacity-60"
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

      {/* 알림 한 자리(docs/08 4.3). role=status 라 스크린 리더도 같은 줄을 읽는다. */}
      <p role="status" aria-live="polite" className="min-h-4 text-xs">
        {shown.kind === "pending" && (
          <span className="text-content-muted">
            에이전트 응답을 기다리는 중… 에이전트에게 <code>{NL_REQUEST_PATH}</code>를 읽고{" "}
            <code>{NL_RESPONSE_PATH}</code>에 Command 배열을 쓰게 하세요.
          </span>
        )}
        {shown.kind === "error" && <span className="text-error">{shown.message}</span>}
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
      </p>
    </section>
  );
}

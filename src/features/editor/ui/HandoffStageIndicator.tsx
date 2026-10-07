/**
 * 편집→에이전트 전달→코드 생성→Export 네 단계 표시기(#283).
 *
 * `TicketPanel`·`ExportPanel`이 공유한다 — 둘 다 "지금 이 패널이 전체 흐름의
 * 어디인가"를 보여줘야 하고, 모양이 둘 다 같아야 같은 흐름이라는 인상을 준다.
 * 캔버스·속성 패널(=편집)에는 달지 않는다 — 편집은 늘 가능한 기본 상태라
 * "지금 몇 단계냐"를 물을 필요가 없다.
 */

export type HandoffStage = "edit" | "handoff" | "generate" | "export";

const STAGES: { id: HandoffStage; label: string }[] = [
  { id: "edit", label: "편집" },
  { id: "handoff", label: "에이전트 전달" },
  { id: "generate", label: "코드 생성" },
  { id: "export", label: "Export" },
];

export function HandoffStageIndicator({ current }: { current: HandoffStage }) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === current);

  return (
    <ol className="flex items-center gap-1 border-b border-line px-3 py-2 text-2xs text-content-muted">
      {STAGES.map((stage, index) => {
        const isCurrent = stage.id === current;
        const isPast = index < currentIndex;
        return (
          <li key={stage.id} className="flex items-center gap-1">
            {index > 0 && <span aria-hidden="true">→</span>}
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={
                isCurrent
                  ? "font-semibold text-content-strong"
                  : isPast
                    ? "text-content"
                    : "text-content-muted"
              }
            >
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

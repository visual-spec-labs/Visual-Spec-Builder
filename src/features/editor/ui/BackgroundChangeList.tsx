import type { BackgroundChange } from "@/features/editor/nl/backgroundChange";

/**
 * 배경 적용 전 확인에서 "무엇이 무엇으로 바뀌는가"를 노드마다 한 줄씩 보인다(#441).
 * 자연어 입력창(`NaturalLanguageBar`)과 외부 에이전트 알림(`AgentEditNotice`)이 같은 목록을 쓴다.
 */
export function BackgroundChangeList({ changes }: { changes: readonly BackgroundChange[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {changes.map((change, index) => (
        <li key={`${change.name}-${index}`}>
          <span className="font-semibold">{change.name}</span> 배경: {change.before} → {change.after}
        </li>
      ))}
    </ul>
  );
}

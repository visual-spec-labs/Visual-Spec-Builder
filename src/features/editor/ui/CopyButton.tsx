import { useEffect, useRef, useState } from "react";

import { copyToClipboard } from "./copyToClipboard";
import { createMountedGuard } from "./mountedGuard";

/** 복사 뒤 "복사됨"/"복사 실패"를 보여주는 시간. */
const FEEDBACK_MS = 2000;

/**
 * 지시문을 클립보드로 복사하는 버튼(#283). `NaturalLanguageBar`·`TicketPanel`이
 * 공유한다 — 복사 상태를 잠깐 보여주고 되돌리는 타이머 로직이 똑같다.
 */
export function CopyButton({ text, label = "지시 복사" }: { text: string; label?: string }) {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 복사 중(클립보드 권한 대기 등) 패널이 닫히는 레이스를 막는다(#283 리뷰
  // 대응) — TicketPanel의 작업공간 확인 effect와 같은 패턴. `mountedGuard.ts`
  // 참고 — setup에서 꼭 true로 되돌려야 StrictMode의 setup→cleanup→setup을
  // 견딘다(#283 리뷰 2차 대응 — 처음엔 cleanup만 있어 그 왕복 뒤로 영영
  // "언마운트됨"으로 읽는 버그였다).
  const guardRef = useRef(createMountedGuard());

  useEffect(() => {
    guardRef.current.setup();
    return () => {
      guardRef.current.cleanup();
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleClick() {
    const ok = await copyToClipboard(text);
    if (!guardRef.current.isMounted()) return;
    setFeedback(ok ? "copied" : "failed");
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback("idle"), FEEDBACK_MS);
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className="shrink-0 rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-hover"
    >
      {feedback === "copied" ? "복사됨" : feedback === "failed" ? "복사 실패" : label}
    </button>
  );
}

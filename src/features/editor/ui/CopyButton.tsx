import { useEffect, useRef, useState } from "react";

import { copyToClipboard } from "./copyToClipboard";

/** 복사 뒤 "복사됨"/"복사 실패"를 보여주는 시간. */
const FEEDBACK_MS = 2000;

/**
 * 지시문을 클립보드로 복사하는 버튼(#283). `NaturalLanguageBar`·`TicketPanel`이
 * 공유한다 — 복사 상태를 잠깐 보여주고 되돌리는 타이머 로직이 똑같다.
 */
export function CopyButton({ text, label = "지시 복사" }: { text: string; label?: string }) {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  async function handleClick() {
    const ok = await copyToClipboard(text);
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

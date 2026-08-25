import type { ReactNode } from "react";

/** 라벨 + 컨트롤 세로 배치. 모든 필드 컨트롤의 공통 껍데기. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wide text-content-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

/** 필드 컨트롤이 공유하는 인풋 스타일. */
export const inputClass =
  "w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-content tabular-nums focus:border-primary focus:outline-none";

/** 잘못된 값일 때 덧입히는 스타일. */
export const invalidClass = "border-error focus:border-error";

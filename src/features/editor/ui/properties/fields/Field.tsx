import type { ReactNode } from "react";

/** 필드/그룹 라벨 공통 텍스트 스타일. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-2xs font-medium tracking-wide text-content-muted">
      {children}
    </span>
  );
}

/** 라벨 + 컨트롤 세로 배치. 모든 필드 컨트롤의 공통 껍데기. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

/** 필드 2개를 가로로 나란히 배치. 너비/높이, 두께/라운드 같은 짝 필드에 사용. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

/** 필드 컨트롤이 공유하는 인풋 스타일. */
export const inputClass =
  "w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-content tabular-nums focus:border-primary focus:outline-none";

/** 잘못된 값일 때 덧입히는 스타일. */
export const invalidClass = "border-error focus:border-error";

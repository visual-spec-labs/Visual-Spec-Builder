import type { ReactNode, WheelEvent } from "react";

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

/**
 * 숫자 입력칸(`type="number"`)은 포커스가 있는 동안 휠을 굴리면 브라우저가 값을
 * 증감시킨다. 칸을 한 번 눌러둔 채로 스크롤하려던 사용자가 크기나 불투명도를
 * 의도치 않게 바꾸게 되므로 휠이 닿으면 포커스를 뗀다.
 *
 * preventDefault가 아니라 blur인 이유:
 * - React의 onWheel은 passive 리스너로 등록돼 preventDefault가 무시된다.
 *   (Canvas가 휠을 네이티브 리스너로 직접 다는 것과 같은 이유)
 * - 세부설정 패널 자체가 overflow-auto라, 기본 동작을 막으면 칸 위에서는
 *   패널 스크롤까지 죽는다. blur는 스크롤을 그대로 두면서 값만 지킨다.
 *
 * 브라우저는 포커스가 없는 칸을 휠로 증감시키지 않고, 기본 동작은 이벤트 전파가
 * 끝난 뒤에 실행된다. 그래서 이 시점의 blur로 증감을 막을 수 있다.
 */
export function blurOnWheel(event: WheelEvent<HTMLElement>) {
  event.currentTarget.blur();
}

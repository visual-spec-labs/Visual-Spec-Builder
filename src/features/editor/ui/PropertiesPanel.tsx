import type { ReactNode } from "react";

const inputCls =
  "rounded-control border border-line bg-surface-inset px-2 py-1 text-xs text-content";

/** 섹션(그룹) — 디자인의 LAYOUT/COLOR 등 대문자 라벨 그룹. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line px-3 py-3">
      <h3 className="text-xs font-semibold tracking-wide text-content-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * 라벨 + 입력 한 줄. 입력은 uncontrolled(포커스·타이핑만 되는 UI 인터랙션)이며
 * 값을 저장·처리하지 않는다(비즈니스 로직 없음).
 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-content-muted">
      <span className="shrink-0">{label}</span>
      <input type="text" defaultValue={value} className={`w-32 ${inputCls}`} />
    </label>
  );
}

/** 색상 스와치(피커) + 값 입력. 값은 어디에도 반영되지 않는 표시·인터랙션용. */
function ColorRow({ color, value }: { color: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        defaultValue={color}
        aria-label="색상"
        className="size-6 shrink-0 rounded-control border border-line bg-surface-inset"
      />
      <input
        type="text"
        defaultValue={value}
        aria-label="색상 값"
        className={`flex-1 ${inputCls}`}
      />
    </div>
  );
}

/** 우측 세부설정 패널 — Figma 디자인 기준 레이아웃 + UI 인터랙션(비즈니스 로직 없음). */
export function PropertiesPanel() {
  return (
    <aside className="flex flex-col overflow-auto border-l border-line bg-surface [grid-area:props]">
      <header className="flex items-center gap-2 px-3 py-3">
        <span className="truncate font-semibold text-content">ProductTable</span>
        <span className="rounded-control bg-surface-raised px-1.5 py-0.5 text-xs text-content-muted">
          Table
        </span>
      </header>

      <Section title="Layout">
        <Row label="X" value="244" />
        <Row label="Y" value="180" />
        <Row label="W" value="772" />
        <Row label="H" value="210" />
        <Row label="Rotation" value="0°" />
      </Section>

      <Section title="Color">
        <ColorRow color="#1c1e22" value="#1C1E22 100%" />
      </Section>

      <Section title="Background">
        <ColorRow color="#ffffff" value="#FFFFFF 100%" />
      </Section>

      <Section title="Font">
        <Row label="Family" value="Manrope" />
        <Row label="Weight" value="Semibold" />
        <Row label="Size" value="14 px" />
      </Section>

      <Section title="Border">
        <ColorRow color="#ececed" value="#ECECED" />
        <Row label="Width" value="1 px" />
        <Row label="Radius" value="10" />
      </Section>

      <Section title="Shadow">
        <Row label="Blur" value="24" />
        <Row label="Spread" value="0" />
        <ColorRow color="#000000" value="#000000 18%" />
      </Section>

      <div className="mt-auto flex gap-2 border-t border-line p-3">
        <button
          type="button"
          className="flex-1 rounded-control bg-primary px-3 py-1.5 text-center text-xs font-semibold text-text-on-accent hover:bg-primary-hover"
        >
          Apply
        </button>
        <button
          type="button"
          className="flex-1 rounded-control border border-line px-3 py-1.5 text-center text-xs font-semibold text-content hover:bg-hover"
        >
          Export JSON
        </button>
      </div>
    </aside>
  );
}

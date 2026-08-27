import { useState } from "react";
import type { ReactNode } from "react";

interface PropertySectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** 접히는 제목 그룹. LAYOUT, COLOR 같은 섹션 단위. */
export function PropertySection({
  title,
  children,
  defaultOpen = true,
}: PropertySectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-[11px] font-semibold tracking-wide text-content-muted uppercase hover:text-content"
      >
        {title}
        <span className="text-content-subtle">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-3 px-3 pb-3.5">{children}</div>
      ) : null}
    </section>
  );
}

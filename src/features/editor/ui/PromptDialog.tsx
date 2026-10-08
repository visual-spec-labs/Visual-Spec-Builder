import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePromptDialogStore } from "@/features/editor/store/promptDialogStore";

/**
 * `window.prompt`를 대신하는 모달(#288). `SaveConflictDialog.tsx`와 같은 오버레이
 * 모양을 쓴다 — 이 저장소에 범용 Modal 컴포넌트가 아직 없고, 이 둘 정도의 반복은
 * 추상화보다 그대로 베끼는 쪽이 더 읽기 쉽다.
 */
export function PromptDialog() {
  const state = usePromptDialogStore((s) => s.state);
  const resolve = usePromptDialogStore((s) => s.resolve);

  const root = useRef<HTMLDivElement>(null);
  const requestId = state.kind === "closed" ? null : state.requestId;
  useEffect(() => {
    if (requestId === null) return;
    const previous = document.activeElement;
    root.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [requestId]);

  if (state.kind === "closed") return null;
  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      // Close only this dialog. The window listener would otherwise see the
      // now-closed store during this same event and deselect the canvas.
      event.preventDefault();
      event.stopPropagation();
      resolve(null);
    } else if (event.key === "Tab") {
      const controls = event.currentTarget.querySelectorAll<HTMLElement>("input:not(:disabled), button:not(:disabled)");
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
      event.stopPropagation();
    }
  }
  return (
    <div ref={root} onKeyDown={handleKeyDown} className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-sunken/80">
      {state.kind === "pick"
        ? <PickDialog key={state.requestId} state={state} resolve={resolve} />
        : <TextDialog key={state.requestId} state={state} resolve={resolve} />}
    </div>
  );
}

function TextDialog({
  state,
  resolve,
}: {
  state: { title: string; message?: string; initialValue: string; placeholder?: string; confirmLabel: string; cancelLabel: string };
  resolve: (value: string | null) => void;
}) {
  const [value, setValue] = useState(state.initialValue);

  return (
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="prompt-dialog-title"
      className="w-full max-w-sm rounded-lg bg-surface-raised p-6 text-content shadow-xl"
    >
      <h2 id="prompt-dialog-title" className="mb-3 text-lg font-semibold">
        {state.title}
      </h2>
      {state.message && <p className="mb-3 text-sm text-content-muted">{state.message}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          resolve(value);
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={state.placeholder}
          className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-content"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded border px-3 py-2" onClick={() => resolve(null)}>
            {state.cancelLabel}
          </button>
          <button type="submit" className="rounded border px-3 py-2 bg-primary text-text-on-accent">
            {state.confirmLabel}
          </button>
        </div>
      </form>
    </section>
  );
}

function PickDialog({
  state,
  resolve,
}: {
  state: { title: string; message?: string; items: readonly string[]; cancelLabel: string };
  resolve: (value: string | null) => void;
}) {
  return (
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="prompt-pick-title"
      className="w-full max-w-sm rounded-lg bg-surface-raised p-6 text-content shadow-xl"
    >
      <h2 id="prompt-pick-title" className="mb-3 text-lg font-semibold">
        {state.title}
      </h2>
      {state.message && <p className="mb-3 text-sm text-content-muted">{state.message}</p>}
      <ul className="max-h-64 overflow-auto divide-y divide-line rounded-control border border-line">
        {state.items.map((item) => (
          <li key={item}>
            <button
              type="button"
              onClick={() => resolve(item)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-hover"
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <button type="button" className="rounded border px-3 py-2" onClick={() => resolve(null)}>
          {state.cancelLabel}
        </button>
      </div>
    </section>
  );
}

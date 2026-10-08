import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePromptDialogStore } from "@/features/editor/store/promptDialogStore";

/**
 * `window.prompt`를 대신하는 모달(#288). `SaveConflictDialog.tsx`와 같은 오버레이
 * 모양을 쓴다 — 이 저장소에 범용 Modal 컴포넌트가 아직 없고, 이 둘 정도의 반복은
 * 추상화보다 그대로 베끼는 쪽이 더 읽기 쉽다.
 */
export function PromptDialog() {
  const state = usePromptDialogStore((s) => s.state);
  const resolve = usePromptDialogStore((s) => s.resolve);

  if (state.kind === "closed") return null;
  // window.prompt는 Escape로 취소할 수 있었다 — 이 오버레이도 같게 둔다.
  // 캔버스까지 Escape가 새지 않는 건 canvasKeys.ts의 별도 가드가 막는다(#288).
  function handleKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "Escape") resolve(null);
  }
  if (state.kind === "pick") return <PickDialog state={state} resolve={resolve} onKeyDown={handleKeyDown} />;
  return <TextDialog state={state} resolve={resolve} onKeyDown={handleKeyDown} />;
}

function TextDialog({
  state,
  resolve,
  onKeyDown,
}: {
  state: { title: string; message?: string; initialValue: string; placeholder?: string; confirmLabel: string; cancelLabel: string };
  resolve: (value: string | null) => void;
  onKeyDown: (event: ReactKeyboardEvent) => void;
}) {
  const [value, setValue] = useState(state.initialValue);

  return (
    <div onKeyDown={onKeyDown} className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-sunken/80">
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
            autoFocus
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
    </div>
  );
}

function PickDialog({
  state,
  resolve,
  onKeyDown,
}: {
  state: { title: string; message?: string; items: readonly string[]; cancelLabel: string };
  resolve: (value: string | null) => void;
  onKeyDown: (event: ReactKeyboardEvent) => void;
}) {
  return (
    <div onKeyDown={onKeyDown} className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-sunken/80">
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
          {state.items.map((item, index) => (
            <li key={item}>
              <button
                type="button"
                autoFocus={index === 0}
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
    </div>
  );
}

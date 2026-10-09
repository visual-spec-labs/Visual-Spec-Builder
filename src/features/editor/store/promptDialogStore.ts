import { create } from "zustand";

/**
 * `window.prompt`를 앱 내 모달로 바꾼다(#288). `SaveConflictDialog.tsx`/
 * `saveConflictStore.ts`와 같은 패턴이다 — 상태를 스토어에 두고 `App.tsx`
 * 루트에서 `PromptDialog`를 한 번만 그려서, Open/Save as가 `HomeScreen.tsx`
 * 뿐 아니라 `MenuBar.tsx`(에디터 안)에서도 똑같이 띄울 수 있게 한다.
 *
 * `promptText`/`promptPick`은 평범한 비동기 함수다(훅이 아니다) — 호출부가
 * 전부 이미 `async` 함수 안에서 `window.prompt(...)`을 쓰고 있었으므로,
 * `await promptText(...)`로 그대로 바꿔 끼울 수 있다. 취소 시 `null`을
 * 돌려주는 것도 `window.prompt`와 같아서, 호출부의 `if (answer === null) return;`
 * 분기가 그대로 산다.
 */

interface TextPromptState {
  requestId: number;
  kind: "text";
  title: string;
  message?: string;
  initialValue: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: string | null) => void;
}

interface PickPromptState {
  requestId: number;
  kind: "pick";
  title: string;
  message?: string;
  items: readonly string[];
  cancelLabel: string;
  resolve: (value: string | null) => void;
}

interface ConfirmPromptState {
  requestId: number;
  kind: "confirm";
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: string | null) => void;
}

type PromptDialogState = { kind: "closed" } | TextPromptState | PickPromptState | ConfirmPromptState;

let nextRequestId = 0;

export const usePromptDialogStore = create<{
  state: PromptDialogState;
  /** 확인/취소/항목 선택 — 전부 결국 "결과값 하나를 정하고 닫는다"로 모인다. */
  resolve: (value: string | null, requestId?: number) => void;
}>((set, get) => ({
  state: { kind: "closed" },
  resolve: (value, requestId) => {
    const current = get().state;
    if (current.kind === "closed" || (requestId !== undefined && current.requestId !== requestId)) return;
    current.resolve(value);
    set({ state: { kind: "closed" } });
  },
}));

export interface TextPromptOptions {
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * 이미 열린 다이얼로그가 있으면 취소로 정리한다. `window.prompt`는 한 번에
 * 하나만 뜨고 다음 게 뜨려면 반드시 먼저 답해야 했지만, 이 스토어는 상태를
 * 그냥 덮어써서 — 가드 없이 두면 먼저 연 쪽의 `resolve` 콜백이 영영 안 불려
 * 그 `await`가 끝나지 않는다(#288 리뷰 대응). 나중 걸 우선한다 — 나중에 연
 * 쪽이 보통 사용자가 지금 보고 있는 그 요청이다.
 */
function cancelPending(): void {
  if (usePromptDialogStore.getState().state.kind !== "closed") {
    usePromptDialogStore.getState().resolve(null);
  }
}

/** 텍스트 한 칸을 입력받는다. Save as(파일명)·Rename(이름)이 쓴다. */
export function promptText(options: TextPromptOptions): Promise<string | null> {
  cancelPending();
  return new Promise((resolve) => {
    usePromptDialogStore.setState({
      state: {
        kind: "text",
        requestId: ++nextRequestId,
        title: options.title,
        message: options.message,
        initialValue: options.initialValue ?? "",
        placeholder: options.placeholder,
        confirmLabel: options.confirmLabel ?? "확인",
        cancelLabel: options.cancelLabel ?? "취소",
        resolve,
      },
    });
  });
}

export interface PickPromptOptions {
  title: string;
  message?: string;
  items: readonly string[];
  cancelLabel?: string;
}

/** 목록에서 하나를 고른다. Open(.visual-spec/specs/ 파일 선택)이 쓴다. */
export function promptPick(options: PickPromptOptions): Promise<string | null> {
  cancelPending();
  return new Promise((resolve) => {
    usePromptDialogStore.setState({
      state: {
        kind: "pick",
        requestId: ++nextRequestId,
        title: options.title,
        message: options.message,
        items: options.items,
        cancelLabel: options.cancelLabel ?? "취소",
        resolve,
      },
    });
  });
}

/** Destructive transition: cancellation is the default, and abort only closes its own request. */
export function promptConfirm(options: { title: string; message: string; signal: AbortSignal }): Promise<boolean> {
  if (options.signal.aborted) return Promise.resolve(false);
  cancelPending();
  const requestId = ++nextRequestId;
  return new Promise((resolve) => {
    const abort = () => usePromptDialogStore.getState().resolve(null, requestId);
    options.signal.addEventListener("abort", abort, { once: true });
    usePromptDialogStore.setState({ state: {
      kind: "confirm", requestId, title: options.title, message: options.message,
      confirmLabel: "계속하기", cancelLabel: "취소",
      resolve: (value) => {
        options.signal.removeEventListener("abort", abort);
        resolve(value === "confirm");
      },
    } });
  });
}

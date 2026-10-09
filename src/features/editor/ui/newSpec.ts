import { blankSpec } from "@/features/editor/store/blankSpec";
import { beginDocumentTransition } from "./documentTransition";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";

/**
 * File ▸ New — 빈 스펙으로 갈아 끼우고 **현재 문서 이름을 비운다**
 * (PR #145 리뷰, wook3964).
 *
 * 비우지 않으면 방금 만든 새 문서의 Save가 **직전에 열어 두었던 파일**을 덮어쓴다 —
 * New 다음의 Save는 사용자 눈에 "새 파일 저장"인데 실제로는 남의 파일을 날린다.
 *
 * 두 군데가 New다 — 메뉴의 File ▸ New(`MenuBar.tsx`)와 홈 화면의 "+ 새 화면"
 * (`HomeScreen.tsx`). 둘이 각자 `loadSpec(blankSpec)`을 부르고 있으면 한쪽만 이름을
 * 비우는 실수가 쉽게 난다(실제로 이 결함이 그 모양이었다). "New가 무엇인가"를
 * 여기 한 줄로 모아 둔다.
 *
 * 갈아 끼우기 전에 현재 문서의 대기 중 자동저장을 먼저 끝낸다(#267). false면 현재
 * 문서를 그대로 둔다 — 다른 탭과 충돌했거나 사용자가 폐기를 거절했다.
 */
export async function newSpec(): Promise<boolean> {
  const transition = beginDocumentTransition();
  if (!await transition.settle(null) || !transition.current()) return false;
  useEditorStore.getState().loadSpec(blankSpec);
  useDocumentStore.getState().clearFileName();
  return true;
}

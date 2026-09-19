import { create } from "zustand";

/**
 * **지금 편집 중인 문서가 어느 파일인가**만 다루는 스토어 (PR #145 리뷰, wook3964).
 *
 * ## 왜 필요한가
 *
 * Save는 "현재 파일명 그대로 작업공간에 쓴다"고 해 놓고 실제로는 매번
 * `spec.name + ".json"`을 **다시 계산**했다. 그래서 `customer-copy.json`(내부
 * `spec.name`은 `"Dashboard"`)을 열어 고친 뒤 Save하면 원본은 그대로 있고
 * `Dashboard.json`이 새로 생겼다 — 사용자가 방금 고친 내용은 자기가 연 파일이
 * 아니라 다른 파일에 들어간다. Save as로 이름을 정해 저장한 뒤의 Save도 같았다.
 * 파일 이름은 스펙 내용에서 유도할 수 없는 값이라 **따로 기억하는 수밖에 없다.**
 *
 * ## 왜 editorStore가 아니라 별도 스토어인가
 *
 * `docs/EDITOR_STORE_CONTRACT.md`의 계약은 **IR(spec)과 선택 상태** 전용이다 —
 * 세 파트(캔버스·레이어 트리·세부설정 패널)가 공유해야 하는 것들만 거기 있다.
 * "이 문서를 어느 파일에 저장하는가"는 IR이 아니고 그 셋 중 누구도 읽지 않는다.
 * 계약에 필드를 하나 더 얹으면 계약 문서와 16개 목록이 함께 무거워지는 데 비해
 * 얻는 게 없다. 화면 전환만 다루는 `navigationStore`, 줌·그리드만 다루는
 * `viewStore`와 같은 선례를 따라 작은 스토어를 하나 더 둔다.
 *
 * ## 누가 쓰나
 *
 * - `ui/openSpecFromFile.ts` — Open이 성공하면 연 파일 이름을 적는다
 * - `ui/exportSpecAsJson.ts` — Save는 여기 적힌 이름에 쓰고, Save as는 새 이름을 적는다
 * - `ui/newSpec.ts` — New는 비운다(아직 어느 파일도 아니다)
 */
export interface DocumentState {
  /**
   * 작업공간 `specs/` 안에서의 파일 이름(`customer-copy.json`). 폴더는 담지 않는다 —
   * GUI가 스펙을 쓰는 자리는 `.visual-spec/specs/` 하나뿐이라(`protocol.ts`의
   * 화이트리스트) 폴더까지 들고 다니면 같은 값이 두 군데서 조립된다.
   *
   * `null`이면 **아직 어느 파일도 아니다**(New 직후, 또는 한 번도 저장하지 않은 세션).
   * 그때의 Save는 예전처럼 `spec.name`에서 이름을 만들어 쓴다.
   */
  fileName: string | null;
  setFileName: (fileName: string) => void;
  clearFileName: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  fileName: null,
  setFileName: (fileName) => set({ fileName }),
  clearFileName: () => set({ fileName: null }),
}));

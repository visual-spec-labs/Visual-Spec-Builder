import { useEditorStore } from "@/features/editor/store/editorStore";
import { parseSpecJson } from "@/features/editor/store/loadSpec";

/**
 * 파일 선택 다이얼로그를 열어 JSON 스펙을 읽고 스토어에 로드한다(DOM 부수효과).
 * exportSpecAsJson.ts와 대칭 — 검증(parseSpecJson)은 store에, 파일 I/O는 여기.
 * 실패 시 조용히 메뉴만 닫히면 원인을 알 수 없으므로 최소한의 alert로 알린다.
 */
export function openSpecFromFile(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";

  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = parseSpecJson(text);
      if (!result.ok) {
        window.alert(`파일을 열 수 없습니다 (검증 실패 ${result.issueCount}건). 콘솔을 확인하세요.`);
        return;
      }
      useEditorStore.getState().loadSpec(result.spec);
    };
    reader.readAsText(file);
  };

  input.click();
}

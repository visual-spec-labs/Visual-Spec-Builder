import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { resolveSpecChoice } from "@/features/editor/ui/specChoice";
import {
  listWorkspaceFiles,
  readWorkspaceTextFile,
} from "@/features/editor/ui/workspaceClient";
import { SPEC_DIR } from "@/features/workspace/protocol";

/**
 * 검증한 JSON 텍스트를 스토어에 앉힌다. 작업공간 경로와 파일 다이얼로그 경로가 공유한다.
 *
 * **연 파일의 이름을 함께 기억한다**(PR #145 리뷰, wook3964) — 그래야 뒤이은 Save가
 * `spec.name`에서 이름을 다시 만들지 않고 방금 연 그 파일에 쓴다. 검증에 실패하면
 * 스펙도 이름도 바꾸지 않는다: 열리지 않은 파일이 Save 대상이 되면 다음 Save가
 * **화면에 떠 있지도 않은 문서의 파일을 덮어쓴다.**
 */
function loadSpecText(text: string, fileName: string): void {
  const result = parseSpecJson(text);
  if (!result.ok) {
    window.alert(
      `${fileName}을(를) 열 수 없습니다 (검증 실패 ${result.issueCount}건). 콘솔을 확인하세요.`,
    );
    return;
  }
  useEditorStore.getState().loadSpec(result.spec);
  useDocumentStore.getState().setFileName(fileName);
}

/**
 * 파일 선택 다이얼로그를 열어 JSON 스펙을 읽고 스토어에 로드한다(DOM 부수효과).
 *
 * 이슈 #133 이후로는 **작업공간이 없을 때의 폴백**이다 — `vite build` 결과물처럼
 * 개발 서버 미들웨어가 없는 자리에서도 스펙을 열 수 있어야 한다.
 *
 * 이 경로로 연 파일도 이름을 기억한다. 고른 파일이 작업공간 **밖**에 있을 수 있지만,
 * 브라우저는 그 파일의 실제 경로를 알려주지 않고 거기에 되쓸 수단도 없다 — 어차피
 * Save가 쓸 수 있는 자리는 `.visual-spec/specs/` 하나다. 이름이라도 이어가는 편이
 * `spec.name`으로 되돌아가 엉뚱한 파일을 만드는 것보다 낫다.
 */
export function openSpecFromFileDialog(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";

  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      loadSpecText(text, file.name);
    };
    reader.readAsText(file);
  };

  input.click();
}

/**
 * `.visual-spec/specs/`에 있는 스펙 중 하나를 골라 연다(이슈 #133).
 *
 * 02-mvp-scope.md가 정의한 "Open = 작업공간 specs에서 고르기"가 이 경로다. 작업공간이
 * 없거나(개발 서버 미들웨어 없음) 폴더가 비어 있으면 예전의 파일 다이얼로그로 되돌아간다.
 *
 * 고르는 UI가 `window.prompt`인 것은 절충이다 — 메뉴에서 바로 뜨는 모달 목록이
 * 더 낫지만 이 저장소엔 아직 다이얼로그 컴포넌트가 없고, 같은 파일의 Save as도
 * prompt를 쓰고 있다. 목록 UI는 별도 이슈로 남긴다.
 */
export async function openSpec(): Promise<void> {
  const names = await listWorkspaceFiles(SPEC_DIR);
  if (names === null) {
    openSpecFromFileDialog();
    return;
  }
  if (names.length === 0) {
    window.alert(".visual-spec/specs/ 에 스펙이 없습니다 — 파일에서 엽니다.");
    openSpecFromFileDialog();
    return;
  }

  const listing = names.map((name, index) => `${index + 1}. ${name}`).join("\n");
  const answer = window.prompt(
    `.visual-spec/specs/ 에서 열 스펙의 번호나 이름:\n\n${listing}`,
    "1",
  );
  if (answer === null) return;

  const chosen = resolveSpecChoice(answer, names);
  if (chosen === null) {
    window.alert(`목록에 없는 스펙입니다: ${answer.trim()}`);
    return;
  }

  const text = await readWorkspaceTextFile(`${SPEC_DIR}/${chosen}`);
  if (text === null) {
    window.alert(`${chosen}을(를) 읽지 못했습니다.`);
    return;
  }
  loadSpecText(text, chosen);
}

import { useEditorStore } from "@/features/editor/store/editorStore";
import { generateNodeId } from "@/features/editor/store/nodeId";
import { resolveImportParent } from "@/features/editor/store/resolveImportParent";
import type { ImageNode } from "@/features/editor/schema";

function baseName(fileName: string): string {
  const stripped = fileName.replace(/\.[^./]+$/, "");
  return stripped.trim() || "Image";
}

/**
 * 파일 선택 다이얼로그를 열어 이미지를 읽고, 선택된 프레임(없으면 화면
 * root)의 자식으로 삽입한다(DOM 부수효과). openSpecFromFile.ts와 같은
 * 구조로 나눴다 — 부모 결정(resolveImportParent)과 id 생성(generateNodeId)은
 * 순수 함수로 분리해 테스트하고, 파일 I/O와 store 호출만 여기 둔다.
 *
 * 워크스페이스 assets 저장소가 아직 없어(06-schema-freeze.md 참고) 이미지를
 * base64 data URI로 스펙 안에 직접 담는다. Export/Save JSON이 그만큼
 * 커지는 대신 별도 파일 관리 없이 지금 스키마로 바로 동작한다.
 */
export function importImageFromFile(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => {
      window.alert("파일을 읽을 수 없습니다.");
    };
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        window.alert("파일을 읽을 수 없습니다.");
        return;
      }

      const image = new Image();
      image.onerror = () => {
        window.alert("이미지를 불러올 수 없습니다. 이미지 파일이 맞는지 확인하세요.");
      };
      image.onload = () => {
        const { spec, selectedId, insertNode } = useEditorStore.getState();
        const parentId = resolveImportParent(spec, selectedId);
        const id = generateNodeId("image", spec.screen.nodes);

        const node: ImageNode = {
          type: "image",
          name: baseName(file.name),
          box: { width: image.naturalWidth, height: image.naturalHeight },
          src: dataUrl,
          fit: "cover",
        };

        insertNode(parentId, id, node);
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  input.click();
}

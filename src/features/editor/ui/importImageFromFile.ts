import { useEditorStore } from "@/features/editor/store/editorStore";
import { generateNodeId } from "@/features/editor/store/nodeId";
import { resolveImportParent } from "@/features/editor/store/resolveImportParent";
import {
  listWorkspaceFiles,
  writeWorkspaceFile,
} from "@/features/editor/ui/workspaceClient";
import type { ImageNode, NodeId, PageId } from "@/features/editor/schema";
import { sanitizeAssetFileName, uniqueAssetName } from "@/features/workspace/assetName";
import { ASSET_DIR } from "@/features/workspace/protocol";

function baseName(fileName: string): string {
  const stripped = fileName.replace(/\.[^./]+$/, "");
  return stripped.trim() || "Image";
}

/** 이미지의 원본 픽셀 크기를 잰다. 이미지가 아니면 null. */
function measureImage(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onerror = () => resolve(null);
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = url;
  });
}

/** 파일을 base64 data URI로 읽는다. 실패하면 null. */
function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  });
}

/**
 * 이미지를 `.visual-spec/assets/`에 저장하고 스펙에 넣을 상대 경로를 돌려준다.
 * 작업공간이 없거나 확장자가 허용 목록 밖이면 null — 호출 측이 data URI로 되돌아간다.
 *
 * 파일명에 UUID를 붙여 병렬 Import의 list→PUT 경합에서도 기존 자산을 덮지 않는다.
 * 안전한 UUID를 만들 수 없으면 data URI로 보존한다.
 */
async function storeInWorkspace(file: File): Promise<string | null> {
  const existing = await listWorkspaceFiles(ASSET_DIR);
  if (existing === null) return null;

  const safeName = sanitizeAssetFileName(file.name);
  if (safeName === null) return null;

  const nonce = globalThis.crypto?.randomUUID?.();
  if (nonce === undefined) return null;
  const isolatedName = safeName.replace(/(\.[^.]+)$/, `-${nonce}$1`);
  const relativePath = `${ASSET_DIR}/${uniqueAssetName(isolatedName, existing)}`;
  const written = await writeWorkspaceFile(
    relativePath,
    file,
    file.type || "application/octet-stream",
  );
  if (!written.ok) {
    console.warn("Import: 작업공간에 저장하지 못해 data URI로 넣는다 —", written.error);
    return null;
  }
  return written.path;
}

/**
 * 고른 이미지를 작업공간에 저장하고 선택된 프레임(없으면 화면 root)의 자식으로 넣는다.
 *
 * **이슈 #133으로 `src`가 다시 경로가 됐다.** 예전에는 작업공간 assets 저장소가 없어
 * 파일 전체를 base64 data URI로 스펙 안에 담았는데(06-schema-freeze.md의 미해결 항목),
 * 이제 저장소가 생겨 `assets/hero.png` 같은 경로를 넣는다 — 스펙 JSON이 이미지 크기만큼
 * 커지지 않고, 스키마 `ImageNode.src`의 본래 의도(워크스페이스 assets 참조)와도 맞는다.
 *
 * data URI 경로는 **폴백으로 남는다**: 작업공간이 없거나(빌드 결과물), 저장이 실패했거나,
 * 확장자가 assets 화이트리스트 밖(예: `.heic`)일 때다. 이미 data URI로 저장된 기존
 * 스펙도 그대로 열리고 그려진다(`properties/imageSrc.ts`가 두 형태를 구분한다).
 */
export async function loadImageAsset(file: File): Promise<{ src: string; width: number; height: number } | null> {
  // 크기는 파일에서 바로 잰다 — 작업공간에 쓰기 전에 이미지가 맞는지부터 확인해야
  // 엉뚱한 파일이 assets에 남지 않는다. objectURL은 재지 않는 경로에서도 꼭 회수한다.
  const objectUrl = URL.createObjectURL(file);
  let size: { width: number; height: number } | null;
  try {
    size = await measureImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  if (size === null) {
    window.alert("이미지를 불러올 수 없습니다. 이미지 파일이 맞는지 확인하세요.");
    return null;
  }

  const src = (await storeInWorkspace(file)) ?? (await readAsDataUrl(file));
  if (src === null) {
    window.alert("파일을 읽을 수 없습니다.");
    return null;
  }

  return { src, ...size };
}

type ImageImportIntent = {
  documentId: number;
  pageId: PageId;
  destination:
    | { kind: "replace"; nodeId: NodeId; node: ImageNode }
    | { kind: "insert"; parentId: NodeId };
};

/** 파일 선택 대화상자를 열기 전에 캡처해 비동기 작업 중 선택 변화에 흔들리지 않게 한다. */
function captureImageImportIntent(): ImageImportIntent | null {
  const { spec, documentId, activePageId, selectedId } = useEditorStore.getState();
  const page = spec.pages[activePageId];
  if (!page) return null;
  const selected = selectedId === null ? undefined : page.nodes[selectedId];
  return {
    documentId,
    pageId: activePageId,
    destination: selectedId !== null && selected?.type === "image"
      ? { kind: "replace", nodeId: selectedId, node: selected }
      : { kind: "insert", parentId: resolveImportParent(page, selectedId) },
  };
}

function reportStaleImageImport(): void {
  window.alert("가져오는 동안 문서나 대상이 바뀌어 이미지 가져오기를 취소했습니다. 다시 시도하세요.");
}

export async function importImageFile(file: File, intent = captureImageImportIntent()): Promise<void> {
  if (intent === null) return;
  const asset = await loadImageAsset(file);
  if (asset === null) return;
  const { src, ...size } = asset;

  const state = useEditorStore.getState();
  if (state.documentId !== intent.documentId || state.activePageId !== intent.pageId) {
    reportStaleImageImport();
    return;
  }
  const page = state.spec.pages[intent.pageId];
  if (!page) {
    reportStaleImageImport();
    return;
  }

  if (intent.destination.kind === "replace") {
    const node = page.nodes[intent.destination.nodeId];
    if (node?.type !== "image" || node !== intent.destination.node) {
      reportStaleImageImport();
      return;
    }
    // src만 바꿔 이미지 노드의 크기·맞춤 방식을 유지한다.
    // 스토어 필드 업데이트 한 번이므로 교체 전체가 Undo 한 단계다.
    state.setNodeField(intent.destination.nodeId, "src", src);
    return;
  }

  const parentId = intent.destination.parentId;
  if (page.nodes[parentId]?.type !== "frame") {
    reportStaleImageImport();
    return;
  }
  const id = generateNodeId("image", page.nodes);
  const node: ImageNode = {
    type: "image",
    name: baseName(file.name),
    box: { width: size.width, height: size.height },
    src,
    fit: "cover",
  };
  state.insertNode(parentId, id, node);
}

/**
 * 파일 선택 다이얼로그를 열어 이미지를 가져온다(DOM 부수효과).
 * openSpecFromFile.ts와 같은 구조로 나눴다 — 부모 결정(resolveImportParent)과
 * id 생성(generateNodeId)은 순수 함수로 분리해 테스트하고, 파일 I/O와 store 호출만
 * 여기 둔다.
 */
export function importImageFromFile(): void {
  const intent = captureImageImportIntent();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    void importImageFile(file, intent);
  };

  input.click();
}

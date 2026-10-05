import { useRef, useState } from "react";
import type { Background, ImageFill } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { loadImageAsset } from "../importImageFromFile";
import { FIT_OPTIONS } from "./ContentSection";
import { EMPTY_IMAGE_SRC, setImageFill } from "./backgroundPatch";
import { describeImageSrc } from "./imageSrc";
import { SegmentedControl, TextField } from "./fields";

export function ImageFillFields({ fill, index, background, onCommit }: {
  fill: ImageFill;
  index: number;
  background: Background;
  onCommit: (next: Background | undefined, continueEdit?: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const display = describeImageSrc(fill.src);

  async function importFile(file: File) {
    const before = useEditorStore.getState();
    const nodeId = before.selectedId;
    if (nodeId === null) return;
    setBusy(true);
    setError("");
    try {
      const asset = await loadImageAsset(file);
      if (asset === null) return;
      const now = useEditorStore.getState();
      // I/O 중 문서/노드/겹이 바뀌면 오래된 배열로 새 편집을 덮지 않는다.
      if (now.spec !== before.spec || now.activePageId !== before.activePageId || now.selectedId !== nodeId) {
        setError("가져오는 동안 문서나 선택이 바뀌었습니다. 현재 겹에서 다시 선택하세요.");
        return;
      }
      onCommit(setImageFill(background, index, { src: asset.src }));
    } catch {
      setError("이미지를 가져오지 못했습니다. 기존 배경은 보존됩니다.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <input ref={input} type="file" accept="image/*" className="hidden" aria-label="배경 이미지 파일"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void importFile(file);
      }} />
    <button type="button" disabled={busy} onClick={() => input.current?.click()}
      className="rounded-control border border-line px-2 py-1.5 text-sm">
      {busy ? "이미지 가져오는 중…" : "배경 이미지 가져오기"}
    </button>
    {fill.src === EMPTY_IMAGE_SRC || display.kind === "path" ?
      <TextField label="이미지 경로 (src)" value={fill.src === EMPTY_IMAGE_SRC ? "" : fill.src}
        placeholder="assets/hero.png"
        onChange={(src, continued) => onCommit(setImageFill(background, index, { src: src || EMPTY_IMAGE_SRC }), continued)} />
      : <div className="text-sm text-content-muted">
        {display.label}
        <button type="button" onClick={() => onCommit(setImageFill(background, index, { src: EMPTY_IMAGE_SRC }))}
          className="ml-2 rounded-control border border-line px-2 py-1">지우기</button>
      </div>}
    <SegmentedControl label="배경 채우기 방식 (fit)" value={fill.fit} options={FIT_OPTIONS}
      onChange={(fit: ImageFill["fit"]) => onCommit(setImageFill(background, index, { fit }))} />
    {error && <p role="alert" className="text-sm text-content-muted">{error}</p>}
  </>;
}

import { describeImageSrc } from "./imageSrc";
import type { NodeType } from "./nodeSections";
import { PropertySection } from "./PropertySection";
import { useNodeField } from "./useNodeField";
import { Field, FieldLabel, SegmentedControl, TextField } from "./fields";

type ImageFit = "cover" | "contain" | "fill";

const FIT_OPTIONS = [
  { value: "cover", content: "채우기", title: "채우기 (cover) — 비율 유지, 넘치면 잘린다" },
  { value: "contain", content: "맞추기", title: "맞추기 (contain) — 비율 유지, 남으면 빈다" },
  { value: "fill", content: "늘이기", title: "늘이기 (fill) — 비율을 무시하고 상자를 채운다" },
] as const;

/** text · button의 라벨. 여러 줄이 필요한 건 text뿐이다. */
function TextContentField({ multiline }: { multiline: boolean }) {
  const [content, setContent] = useNodeField<string>("content");

  return (
    <TextField label="텍스트" value={content} onChange={setContent} multiline={multiline} />
  );
}

/** input이 보여줄 안내 문구. 실제 입력값(value)은 v0.1 스키마에 없다. */
function PlaceholderField() {
  const [placeholder, setPlaceholder] = useNodeField<string>("placeholder");

  return (
    <TextField
      label="안내 문구 (placeholder)"
      value={placeholder}
      onChange={setPlaceholder}
    />
  );
}

/** image의 원본과 채우기 방식. */
function ImageFields() {
  const [src, setSrc] = useNodeField<string>("src");
  const [fit, setFit] = useNodeField<ImageFit>("fit");

  const display = describeImageSrc(src);

  return (
    <>
      {display.kind === "path" ? (
        <TextField
          label="경로 (src)"
          value={display.value}
          onChange={setSrc}
          placeholder="assets/hero.png"
        />
      ) : (
        // Import로 들어온 이미지는 파일 전체가 base64 data URI로 담겨 있다.
        // 입력칸에 그대로 띄우면 수백 KB짜리 한 줄이 되어 칸이 먹통이 되고,
        // 손으로 고칠 수 있는 값도 아니라 요약만 보여준다.
        <Field label="경로 (src)">
          <p className="rounded-control border border-line bg-surface-inset px-2 py-1.5 text-sm text-content-muted">
            {display.label}
          </p>
          <FieldLabel>
            가져온 이미지는 스펙 안에 직접 담겨 있어 경로를 고칠 수 없다.
          </FieldLabel>
        </Field>
      )}
      <SegmentedControl
        label="채우기 방식 (fit)"
        value={fit}
        options={FIT_OPTIONS}
        onChange={setFit}
      />
    </>
  );
}

/**
 * "이 노드가 무엇을 담고 있는가" — 타입마다 필드가 다른 유일한 섹션이다.
 *
 * text·button은 `content`, input은 `placeholder`, image는 `src`·`fit`이다.
 * 경로가 서로 달라 한 컨트롤로 못 묶지만, "무엇을 담았나"라는 자리는 같으므로
 * 섹션 하나로 두고 안에서 갈랐다. frame은 자식이 곧 내용이라 이 섹션이 없다.
 */
export function ContentSection({ type }: { type: NodeType }) {
  return (
    <PropertySection title="Content">
      {type === "text" && <TextContentField multiline />}
      {type === "button" && <TextContentField multiline={false} />}
      {type === "input" && <PlaceholderField />}
      {type === "image" && <ImageFields />}
    </PropertySection>
  );
}

/**
 * image 노드의 src를 패널에 어떻게 보여줄지 정한다.
 *
 * src는 두 가지가 섞여 들어온다. 손으로 쓴 스펙은 assets 상대 경로를 담지만,
 * File ▸ Import 는 작업공간 assets 저장소가 없어 **파일 전체를 base64 data URI로**
 * 넣는다(`ui/importImageFromFile.ts` 주석이 이 절충을 밝히고 있다).
 *
 * 그 둘을 같은 입력칸에 그대로 띄우면 안 된다 — data URI는 수백 KB짜리 한 줄이라
 * 칸이 먹통이 되고, 고칠 수 있는 값도 아니다. 경로일 때만 편집칸을 주고 data URI는
 * 요약만 보여준다.
 */

export type ImageSrcDisplay =
  | { kind: "path"; value: string }
  | { kind: "data"; label: string };

/** data URI 앞머리(`data:image/png;base64,` 등)를 알아본다. */
const DATA_URI = /^data:([^;,]*)[^,]*,/;

export function describeImageSrc(src: string | undefined): ImageSrcDisplay {
  const match = DATA_URI.exec(src ?? "");
  if (match === null) {
    return { kind: "path", value: src ?? "" };
  }

  const mediaType = match[1] === "" ? "이미지" : match[1];
  return {
    kind: "data",
    label: `가져온 ${mediaType} · ${formatBytes((src ?? "").length)}`,
  };
}

/**
 * src를 CSS `background-image` 값으로 만든다.
 *
 * **따옴표가 필수다.** 따옴표 없는 `url(...)` 토큰에는 공백·괄호·따옴표가 들어갈 수
 * 없다(CSS 명세). `assets/hero (1).png` 처럼 흔한 파일명이 그대로 들어가면 값 전체가
 * 무효가 되고, React가 CSSOM에 넣는 순간 조용히 버려져 **이미지가 아무 오류 없이
 * 사라진다.**
 *
 * 지금까지는 src가 손으로 쓴 스펙이나 Import(data URI)로만 들어와 드러나기 어려웠는데,
 * #92로 패널에서 경로를 직접 타이핑할 수 있게 되면서 바로 닿는 자리가 됐다.
 */
export function imageUrlCss(src: string): string {
  // 따옴표 안에서 뜻을 갖는 두 글자만 막으면 된다. 역슬래시를 먼저 바꿔야
  // 따옴표 이스케이프가 무효화되지 않는다.
  const escaped = src.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

/**
 * 바이트 수를 읽기 쉬운 크기로. data URI 문자열 길이를 그대로 넣는다 —
 * base64라 실제 파일보다 3분의 1쯤 크지만, 스펙 JSON에 실리는 건 이 길이다.
 */
function formatBytes(length: number): string {
  if (length < 1024) return `${length} B`;
  if (length < 1024 * 1024) return `${Math.round(length / 1024)} KB`;
  return `${(length / (1024 * 1024)).toFixed(1)} MB`;
}

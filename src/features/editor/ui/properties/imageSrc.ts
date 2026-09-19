/**
 * image 노드의 src를 패널에 어떻게 보여주고, 화면에 어떻게 그릴지 정한다.
 *
 * src는 두 가지가 섞여 들어온다. 손으로 쓴 스펙과 File ▸ Import(이슈 #133 이후)는
 * 작업공간 assets 상대 경로를 담지만, **#133 이전에 Import한 기존 스펙은 파일 전체가
 * base64 data URI로 들어 있다.** 그 스펙들도 계속 열려야 하므로 둘 다 받는다.
 *
 * 그 둘을 같은 입력칸에 그대로 띄우면 안 된다 — data URI는 수백 KB짜리 한 줄이라
 * 칸이 먹통이 되고, 고칠 수 있는 값도 아니다. 경로일 때만 편집칸을 주고 data URI는
 * 요약만 보여준다.
 */

import { workspaceFileUrl } from "@/features/workspace/protocol";

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
 * 스펙의 src를 **브라우저가 실제로 받아올 수 있는 URL**로 바꾼다(순수 함수).
 *
 * `assets/hero.png`는 작업공간(`.visual-spec/assets/hero.png`) 기준 경로지 개발 서버의
 * URL이 아니다 — 그대로 두면 `http://localhost:5173/assets/hero.png`를 찾다가 404가
 * 난다(개발 서버의 cwd는 이 패키지 루트다, 이슈 #133). 작업공간 파일 라우트를 앞에
 * 붙여야 미들웨어가 워크스페이스에서 꺼내 준다.
 *
 * 그대로 두는 것들 — data URI(#133 이전 스펙), blob/http(s) URL, 그리고 `/`로 시작하는
 * 절대 경로(사용자가 개발 서버 public/에 직접 둔 파일을 가리킬 수 있다).
 *
 * **경로는 세그먼트마다 URL 인코딩한다**(PR #145 리뷰, wook3964). 저장 요청은 이미
 * `workspaceFileUrl`로 인코딩해 보내는데 그리는 쪽만 상대 경로를 그대로 이어 붙이고
 * 있었다 — `hero#1.png`는 `#`부터가 조각으로 잘려 서버에 `hero`까지만 닿고, `%`가 든
 * 이름은 디코딩 오류로 거부됐다. **Import는 성공했는데 그 이미지가 화면에서만
 * 안 보이는** 모양이라 원인을 찾기도 어렵다. 이제 양쪽이 같은 함수를 쓴다.
 */
export function resolveImageSrc(src: string): string {
  if (src === "") return src;
  if (src.startsWith("/")) return src;
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return src; // data:, blob:, http:, https: …
  return workspaceFileUrl(src);
}

/**
 * src를 CSS `background-image` 값으로 만든다. 위 `resolveImageSrc`를 거친다 —
 * 이 함수를 부르는 쪽(Canvas·홈 미리보기)은 "스펙의 src"만 알면 되고, 그게 어느
 * URL에서 오는지는 여기 한 군데서 정한다.
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
  const escaped = resolveImageSrc(src).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

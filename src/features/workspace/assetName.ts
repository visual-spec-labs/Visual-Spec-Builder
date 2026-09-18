/**
 * Import한 이미지를 `.visual-spec/assets/`에 어떤 이름으로 둘지 정한다 (이슈 #133).
 *
 * `workspacePath.ts`와 달리 `node:*`를 쓰지 않는다 — 이름을 정하는 쪽은 브라우저
 * (`ui/importImageFromFile.ts`)라서 번들에 들어간다. 서버가 아니라 클라이언트가
 * 이름을 정하는 이유: 덮어쓰기를 피하려면 "이미 있는 이름"을 알아야 하는데, 클라이언트는
 * 어차피 목록 라우트를 부를 수 있고 그러면 서버 쪽 PUT은 "받은 경로에 쓴다"로 단순하게
 * 남는다(= 검증할 동작이 하나 줄어든다).
 */

import { WORKSPACE_DIR_RULES } from "./protocol";

/** 파일 이름에 쓰지 않을 글자 — 경로 구분자와 OS가 싫어하는 것들. */
const UNSAFE_CHARS = /[/\\:*?"<>|\s]+/g;

/**
 * 원본 파일 이름을 assets에 둘 수 있는 이름으로 다듬는다.
 * 허용 확장자가 아니면 null — 호출 측이 data URI 폴백으로 돌아간다.
 *
 * 다듬기만 하고 통과 여부는 서버가 다시 판단한다. 여기서 만든 이름도 결국
 * `resolveWorkspaceFile`을 거치므로, 이 함수가 뚫려도 파일이 엉뚱한 데 써지지는 않는다.
 */
export function sanitizeAssetFileName(fileName: string): string | null {
  // 브라우저 File.name에 경로가 섞여 들어오는 경우(디렉터리 업로드)를 먼저 떼어낸다.
  const base = fileName.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(UNSAFE_CHARS, "-").replace(/^\.+/, "").trim();

  const dot = cleaned.lastIndexOf(".");
  if (dot <= 0) return null;

  const stem = cleaned.slice(0, dot).replace(/\.+$/, "").trim();
  const extension = cleaned.slice(dot).toLowerCase();
  if (stem === "") return null;

  const allowed: readonly string[] = WORKSPACE_DIR_RULES.assets;
  if (!allowed.includes(extension)) return null;

  return `${stem}${extension}`;
}

/**
 * 이미 있는 이름이면 `-1`, `-2`를 붙여 겹치지 않는 이름을 만든다.
 *
 * 같은 이름에 덮어쓰지 않는다 — `hero.png`를 두 번 Import했을 때 앞서 넣은 이미지를
 * 쓰고 있는 다른 노드까지 조용히 바뀌어 버리기 때문이다. 비교는 대소문자를 무시한다
 * (Windows·macOS 기본 파일 시스템이 그렇다 — 거기서는 `Hero.png`가 `hero.png`를 덮는다).
 */
export function uniqueAssetName(fileName: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((name) => name.toLowerCase()));
  if (!taken.has(fileName.toLowerCase())) return fileName;

  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : "";

  for (let index = 1; ; index += 1) {
    const candidate = `${stem}-${index}${extension}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

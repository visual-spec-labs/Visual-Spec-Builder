import { useCallback, useEffect, useSyncExternalStore } from "react";

import type { Node as SpecNode, NodeId } from "@/features/editor/schema";

import type { PreviewImageSrc } from "./homePreview";
import { resolveImageSrc } from "./properties/imageSrc";

/**
 * 홈 카드 미리보기가 원본 대신 쓰는 축소 이미지(#322).
 *
 * 미리보기가 원본을 CSS 배경으로 그리면 브라우저는 카드가 208×140이어도 원본 해상도 그대로
 * 디코드해 들고 있다. 2400×1600 PNG 한 장이 약 15MB라 프로젝트마다 다른 이미지가 있는 50개 홈이
 * 1.16GB를 더 썼다(docs/22 후속 6, #318). 여기서는 원본을 한 번 디코드해 카드에 필요한 해상도로
 * 줄인 뒤 그 작은 이미지의 blob URL만 미리보기에 넘긴다. 원본 디코드는 줄이는 동안만 잡혀 있다가
 * 바로 놓인다. 편집 캔버스는 이 모듈을 거치지 않고 계속 원본을 쓴다.
 *
 * 줄일 수 없는 경우(SVG, 불러오기·디코드 실패, `createImageBitmap`이 없는 환경)에는 원본 src를
 * 돌려준다 — 카드가 예전처럼 원본을 그린다. 메모리는 아끼지 못해도 그림이 사라지지는 않는다.
 */

/** 동시에 디코드하는 원본 수. 원본 디코드가 잠깐씩 수십 MB를 잡으므로 몇 장으로 묶는다. */
const MAX_CONCURRENT = 2;

/** 원본 하나를 받는 데 기다리는 최대 시간(ms). 작업공간 파일은 보통 수십 ms 안에 온다. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * 원본 크기(width×height)를 짧은 변이 `shortSide` 픽셀이 되게 줄인 크기. 이미 작으면 그대로.
 *
 * 짧은 변을 기준으로 잡는 근거 — 상자 안에 cover·contain·fill 어느 방식으로 그려도 이미지가
 * 화면에 차지하는 짧은 변은 상자의 긴 변을 넘지 못하고, 미리보기 안의 상자는 카드보다 크게
 * 보이지 않는다. 그래서 `shortSide`를 카드의 긴 변 × 기기 픽셀 비율로 주면 어떤 상자에서도
 * 화면 픽셀 하나에 축소 이미지 픽셀이 하나 이상 온다. 긴 변을 기준으로 줄이면 가늘고 긴
 * 이미지를 cover로 넓은 상자에 채울 때 짧은 변이 모자라 흐려진다.
 */
export function thumbnailSize(
  width: number,
  height: number,
  shortSide: number,
): { width: number; height: number } {
  const shorter = Math.min(width, height);
  if (shorter <= shortSide) return { width, height };
  const ratio = shortSide / shorter;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * 미리보기가 실제로 그릴 이미지 src를 모은다 — 이미지 노드와 배경의 이미지 겹. 순서대로, 중복 없이.
 * `PreviewNode`(HomeScreen.tsx)와 같은 길로 간다: root에서 children을 따라가고, 숨긴 노드는 그 아래까지
 * 건너뛴다. 그리지 않는 이미지를 받아 디코드하면 #322가 없애려는 비용이 그대로 남는다.
 */
export function collectImageSrcs(nodes: Record<NodeId, SpecNode>, root: NodeId): string[] {
  const srcs = new Set<string>();
  const visit = (id: NodeId) => {
    const node = nodes[id];
    if (node === undefined || node.visible === false) return;
    if (node.type === "image") {
      if (node.src !== "") srcs.add(node.src);
      return;
    }
    if (node.type === "text") return;
    for (const fill of node.background ?? []) {
      if (fill.type === "image" && fill.src !== "") srcs.add(fill.src);
    }
    if (node.type === "frame") for (const child of node.children) visit(child.node);
  };
  visit(root);
  return [...srcs];
}

/**
 * 움직이는 이미지인가 — 한 장으로 구우면 첫 프레임에서 멈춰 카드 모습이 달라지므로 줄이지 않는다.
 * 파일 머리만 본다. GIF는 프레임 수를 세지 않고 모두 움직인다고 본다. PNG는 `IDAT` 앞의 `acTL`(APNG),
 * WebP는 `VP8X`의 애니메이션 비트, AVIF는 `ftyp`의 `avis` 브랜드로 가린다.
 */
export function isAnimatedImage(bytes: Uint8Array): boolean {
  const ascii = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));
  const u32 = (at: number) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;

  if (ascii(0, 4) === "GIF8") return true;
  if (bytes[0] === 0x89 && ascii(1, 3) === "PNG") {
    for (let at = 8; at + 8 <= bytes.length; at += 12 + u32(at)) {
      const type = ascii(at + 4, 4);
      if (type === "acTL") return true;
      if (type === "IDAT" || type === "IEND") return false;
    }
    return false;
  }
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    return ascii(12, 4) === "VP8X" && (bytes[20] & 0x02) !== 0;
  }
  if (ascii(4, 4) === "ftyp") {
    const end = Math.min(u32(0), bytes.length);
    for (let at = 8; at + 4 <= end; at += 4) {
      if (at === 12) continue; // minor_version
      if (ascii(at, 4) === "avis") return true;
    }
  }
  return false;
}

/**
 * 끝난 결과. `result`는 미리보기가 쓸 src(축소 이미지의 blob URL이거나 원본 src), `fingerprint`는
 * 그때 받은 원본 내용의 해시, `visit`은 마지막으로 확인한 홈 방문 번호다.
 */
interface Entry { result: string; fingerprint: string | null; visit: number; revision: number }
/** 확인 한 번의 결과 — 저장할 때 `revision`을 붙인다. */
type Checked = Omit<Entry, "revision">;
const entries = new Map<string, Entry>();
/**
 * 카드가 마지막으로 이미지를 요청한 방문. 확인이 차례를 기다리다 홈을 떠나 끝나지 못해도(`entry.visit`이
 * 오르지 않는다) 그 방문에 카드에 보인 것이므로 잊지 않는다.
 */
const requested = new Map<string, number>();
const pending = new Map<string, { visit: number; job: Promise<string> }>();
/** 자리를 기다리는 요청 — 줄 선 태스크별 묶음. */
const waiting: Array<Array<() => void>> = [];
let batchOpen = false;
/** 이 모듈이 만든 축소본 blob URL. 해제는 이것만 한다 — 스펙의 src가 blob URL일 수도 있다. */
const created = new Set<string>();
/** 결과가 바뀌면 알림을 받는 카드들(`usePreviewThumbnails`). */
const listeners = new Set<() => void>();
let running = 0;
let visit = 0;
/** 결과가 바뀔 때마다 오르는 번호. 카드는 결과 문자열(수 MB data URI일 수 있다) 대신 이것으로 바뀜을 본다. */
let revision = 0;
let visitOwner: object | null = null;
/** 홈 화면이 떠 있는가(`beginPreviewVisit`~`endPreviewVisit`). */
let homeActive = false;

/**
 * 홈에 새로 들어올 때 부른다. 그 뒤 처음 그리는 카드는 원본을 다시 받아 내용이 바뀌었는지 본다 —
 * 같은 경로의 파일이 디스크에서 바뀌었을 수 있다(손으로 쓴 경로, 에이전트·디스크 변경). 파일
 * 라우트가 `no-store`라 원본은 원래도 홈에 들어올 때마다 다시 받았다. 내용이 같으면 디코드는 하지 않는다.
 * `owner`는 홈 화면 마운트마다 하나인 객체다.
 */
export function beginPreviewVisit(owner: object): number {
  homeActive = true;
  // 같은 홈 화면이 다시 부르면(StrictMode의 effect 재실행) 새 방문으로 치지 않는다.
  if (owner === visitOwner) return visit;
  visitOwner = owner;
  visit += 1;
  // 두 방문 넘게 어느 카드도 그리지 않은 이미지는 잊는다 — 지운 프로젝트의 이미지(data URI면 키가
  // 수 MB 문자열이다)와 그 축소본이 세션 내내 남지 않게. 다시 보이면 다시 줄인다.
  for (const [src, entry] of entries) {
    const lastSeen = Math.max(entry.visit, requested.get(src) ?? 0);
    if (lastSeen >= visit - 2 || pending.has(src)) continue;
    entries.delete(src);
    requested.delete(src);
    notify();
    revokeIfBlob(entry.result);
  }
  return visit;
}

/**
 * 홈을 떠날 때 부른다. 아직 자리를 잡지 못한 확인은 자리를 잡아도 일하지 않고 끝난다 — 편집하는
 * 동안 원본 디코드가 메모리를 잡지 않게. 다음 방문의 카드가 필요한 것을 다시 요청한다.
 */
export function endPreviewVisit(owner: object): void {
  if (owner === visitOwner) homeActive = false;
}

/**
 * 동시에 `MAX_CONCURRENT`개까지만 돌린다. 끝난 작업은 자리를 놓지 않고 기다리던 작업에 바로 넘긴다 —
 * 놓았다가 다시 잡게 하면 그 사이에 들어온 새 요청이 먼저 자리를 차지해 한도를 넘긴다.
 *
 * 기다리는 순서: 같은 태스크에서 함께 줄 선 요청(한 번의 렌더로 보이게 된 카드들)은 먼저 온 순서대로 —
 * 처음 홈에 들어오면 위 카드부터다. 그보다 나중에 생긴 묶음은 앞 묶음보다 먼저 — 빠르게 스크롤해 내려가면
 * 지금 화면의 카드가 지나온 카드보다 먼저다.
 */
async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => enqueue(resolve));
  else running += 1;
  try {
    return await task();
  } finally {
    const next = dequeue();
    if (next === undefined) running -= 1;
    else next();
  }
}

function enqueue(resolve: () => void): void {
  if (!batchOpen) {
    waiting.push([]);
    batchOpen = true;
    setTimeout(() => { batchOpen = false; }, 0);
  }
  waiting[waiting.length - 1].push(resolve);
}

function dequeue(): (() => void) | undefined {
  while (waiting.length > 0) {
    const newest = waiting[waiting.length - 1];
    const next = newest.shift();
    if (next !== undefined) return next;
    waiting.pop();
  }
  return undefined;
}

function canShrink(): boolean {
  return typeof createImageBitmap === "function" && typeof fetch === "function"
    && (typeof OffscreenCanvas === "function" || typeof document !== "undefined");
}

/**
 * 이 화면과 같은 출처(작업공간 파일·`/` 경로)이거나 data·blob URL인가. 다른 출처는 줄이지 않는다 —
 * 느리거나 멈춘 외부 호스트가 두 자리를 오래 붙잡아 다른 카드의 이미지까지 막을 수 있고, CORS를
 * 허용하지 않으면 받지도 못한다. 이때는 예전처럼 원본을 CSS 배경으로 그린다.
 */
function isLocal(url: string): boolean {
  if (/^(data|blob):/i.test(url)) return true;
  const here = globalThis.location?.href;
  if (here === undefined) return !/^[a-z][a-z0-9+.-]*:/i.test(url);
  try {
    return new URL(url, here).origin === new URL(here).origin;
  } catch {
    return false;
  }
}

/**
 * 원본을 받는다. 실패하거나 `FETCH_TIMEOUT_MS` 안에 다 받지 못하면 null. 자리가 둘뿐이라 멈춘 요청
 * (쓰는 중인 파일, 느린 네트워크 드라이브)이 자리를 붙잡으면 다른 카드 이미지까지 빈 채로 남는다.
 * 그때는 줄여 둔 것이나 원본을 그린다 — 원본 CSS 배경은 이미지마다 따로 받으므로 다른 카드를 막지 않는다.
 */
async function download(url: string): Promise<Blob | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? await response.blob() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 원본 내용의 지문(SHA-256). */
async function fingerprintOf(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    // 보안 컨텍스트가 아닌 주소(http LAN IP 등)에는 crypto.subtle이 없다. 그래도 방문마다 다시 디코드하지
    // 않도록 FNV-1a(32비트)와 길이로 대신한다 — 같은 경로의 파일이 바뀌었는지만 보면 된다.
    let hash = 0x811c9dc5;
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193);
    return `fnv:${bytes.length}:${(hash >>> 0).toString(16)}`;
  }
  const digest = new Uint8Array(await subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** 원본 blob을 줄인 이미지의 blob URL. 줄일 필요가 없거나 줄일 수 없으면 null. */
async function shrink(blob: Blob, bytes: Uint8Array, shortSide: number): Promise<string | null> {
  // 벡터는 그릴 크기로 래스터화되므로 원본을 써도 큰 비트맵이 생기지 않는다.
  if (blob.type === "image/svg+xml" || isAnimatedImage(bytes)) return null;

  // CSS 배경처럼 EXIF 방향을 따른다 — 기본값이 이를 무시하던 엔진에서도 휴대폰 사진이 눕지 않게.
  const original = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    const size = thumbnailSize(original.width, original.height, shortSide);
    if (size.width === original.width && size.height === original.height) return null;
    const encoded = await drawShrunk(original, size.width, size.height);
    if (encoded === null) return null;
    const url = URL.createObjectURL(encoded);
    created.add(url);
    return url;
  } finally {
    original.close();
  }
}

/**
 * 비트맵을 width×height 캔버스에 줄여 그린 뒤 굽는다. `createImageBitmap`의 resize 옵션은
 * 브라우저마다 지원이 달라 쓰지 않는다. 투명도를 살리면서 작게 담으려고 WebP로 굽고, WebP를
 * 못 굽는 브라우저는 명세대로 PNG를 낸다.
 */
async function drawShrunk(bitmap: ImageBitmap, width: number, height: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (context === null) return null;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/webp", quality: 0.92 });
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
}

/** 원본을 받아 확인하고, 내용이 처음이거나 바뀌었으면 줄인다. 이전 결과가 있으면 그것을 고쳐 쓴다. */
async function refresh(
  src: string, shortSide: number, previous: Entry | undefined, visit: number,
): Promise<Checked> {
  // data URI는 src가 곧 내용이라 바뀌지 않는다. blob URL도 만든 뒤 내용이 바뀌지 않는다.
  if (previous !== undefined && /^(data|blob):/i.test(src)) return { ...previous, visit };
  const url = resolveImageSrc(src);
  if (!canShrink() || !isLocal(url)) return { result: src, fingerprint: null, visit };

  const blob = await download(url);
  // 다시 확인하다 실패하면(에이전트가 파일을 쓰는 중, 서버 재시작 등) 줄여 둔 것을 그대로 쓴다.
  if (blob === null) return previous === undefined ? { result: src, fingerprint: null, visit } : { ...previous, visit };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const fingerprint = await fingerprintOf(bytes);
  if (previous !== undefined && previous.fingerprint === fingerprint) {
    return { ...previous, visit };
  }
  const thumbnail = await shrink(blob, bytes, shortSide);
  return { result: thumbnail ?? src, fingerprint, visit };
}

/**
 * src 하나의 미리보기용 src를 얻는다. 같은 src는 한 번만 줄여 기억하고, 홈 방문마다 한 번 원본이
 * 바뀌었는지 확인한다(`beginPreviewVisit`). 불러오기·디코드에 실패하면 원본 src — 예전처럼 원본을 그린다.
 */
export function previewThumbnail(src: string, shortSide: number): Promise<string> {
  requested.set(src, visit);
  const known = entries.get(src);
  if (known !== undefined && known.visit === visit) return Promise.resolve(known.result);
  const inFlight = pending.get(src);
  if (inFlight !== undefined && inFlight.visit === visit) return inFlight.job;

  // 같은 src의 확인은 한 번에 하나만, 시작한 순서대로 돈다. 앞 방문의 확인이 아직 돌고 있으면
  // (그 방문 전에 받은 원본일 수 있어 이 방문의 확인으로 치지 않는다) 끝난 뒤에 다시 확인한다.
  // 이전 결과는 줄을 설 때가 아니라 돌기 시작할 때 읽는다 — 앞 확인이 바꾸거나 해제한 결과를
  // 들고 있다가 되살리지 않도록.
  const startedVisit = visit;
  const job = (inFlight?.job ?? Promise.resolve(""))
    .catch(() => "")
    // 자리를 잡았을 때 이미 다음 방문이 시작됐거나 홈을 떠났으면 일하지 않는다(null) — 지나간 방문의
    // 대기열이 지금 화면의 카드를 막거나, 편집하는 동안 디코드하지 않게.
    .then(() => withSlot(async () => (startedVisit === visit && homeActive
      ? refresh(src, shortSide, entries.get(src), startedVisit)
      : null)))
    .catch((): Checked => {
      const current = entries.get(src);
      return current === undefined
        ? { result: src, fingerprint: null, visit: startedVisit }
        : { ...current, visit: startedVisit };
    })
    .then((entry) => {
      if (pending.get(src)?.job === job) pending.delete(src);
      const current = entries.get(src);
      if (entry === null) return current?.result ?? src;
      if (current !== undefined && current.result !== entry.result) revokeIfBlob(current.result);
      // 결과가 그대로면(확인만 하고 내용이 같았다) 카드를 다시 그리지 않는다.
      const changed = current?.result !== entry.result;
      entries.set(src, { ...entry, revision: changed ? ++revision : current.revision });
      if (changed) notify();
      return entry.result;
    });
  pending.set(src, { visit: startedVisit, job });
  return job;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function revokeIfBlob(url: string): void {
  if (!created.delete(url)) return;
  URL.revokeObjectURL(url);
}

/**
 * 카드가 그려질 때(`enabled`) 그 페이지 이미지들의 축소본을 요청하고, 준비된 것부터 돌려준다.
 * 이미 줄여 둔 src는 처음 그릴 때부터 바로 쓴다 — 홈에 다시 돌아와도 이미지가 깜빡이지 않는다.
 * 그 사이 원본이 바뀌었으면 확인이 끝나는 대로 새 축소본으로 바뀐다.
 * `srcs`는 호출 측이 메모해서 넘긴다 — 매 렌더 새 배열이면 그때마다 요청을 다시 훑는다.
 */
export function usePreviewThumbnails(
  srcs: readonly string[],
  enabled: boolean,
  shortSide: number,
): PreviewImageSrc {
  // 결과는 모듈 캐시(외부 저장소)에 있다. `useSyncExternalStore`로 읽어야 렌더와 구독 사이에 끝난
  // 작업(다른 카드가 먼저 시작한 같은 이미지 등)도 놓치지 않는다 — 구독 직후 스냅샷을 다시 비교한다.
  // 스냅샷은 이 카드가 쓰는 src의 결과만 담아, 다른 이미지가 준비될 때 이 카드를 다시 그리지 않는다.
  const snapshot = useCallback(
    () => srcs.map((src) => entries.get(src)?.revision ?? 0).join(","),
    [srcs],
  );
  useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (!enabled) return;
    for (const src of srcs) {
      if (entries.get(src)?.visit !== visit) void previewThumbnail(src, shortSide);
    }
  }, [srcs, enabled, shortSide]);

  return (src) => entries.get(src)?.result ?? null;
}

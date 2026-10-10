/**
 * 생성 출력의 내용 해시와 입력 지문 — 순수 함수 (이슈 #284).
 *
 * 수용 기록(`generationManifest.ts`)이 "확정한 바이트가 지금도 그대로인가"와 "어떤 입력으로
 * 만든 출력인가"를 비교하는 데 쓴다.
 *
 * **`crypto.subtle`을 쓰지 않는다.** 그건 보안 컨텍스트(https·localhost)에서만 있고 비동기다.
 * GUI를 LAN 주소로 열면 없어지는데, 그때 다른 해시로 떨어지면 같은 파일이 컨텍스트마다
 * 다른 값을 갖게 된다. 여기서 필요한 성질은 "같은 바이트면 같은 값, 다르면 다른 값"뿐이라
 * 짧은 순수 TS SHA-256으로 충분하다 — 서명·보안 경계가 아니다(docs/26 "남은 한계").
 */

import type { PageId, ScreenSpec } from "@/features/editor/schema";

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/** 바이트 배열의 SHA-256(소문자 16진수 64자). */
export function sha256Hex(bytes: Uint8Array): string {
  const bitLength = bytes.length * 8;
  // 1바이트 0x80 + 0 채움 + 8바이트 길이가 64바이트 블록 경계에 맞게 붙는다.
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choice + K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    hash[0] += a; hash[1] += b; hash[2] += c; hash[3] += d;
    hash[4] += e; hash[5] += f; hash[6] += g; hash[7] += h;
  }
  return [...hash].map((word) => word.toString(16).padStart(8, "0")).join("");
}

/** 생성 파일 내용(텍스트)의 해시. UTF-8 바이트 기준이며 `sha256:` 접두사를 붙인다. */
export function contentHash(text: string): string {
  return `sha256:${sha256Hex(new TextEncoder().encode(text))}`;
}

/**
 * 키를 정렬한 JSON. 편집이 노드 필드를 지웠다 다시 넣으면 키 순서가 바뀌는데, 내용이 같은
 * 페이지를 "입력이 바뀌었다"로 읽으면 멀쩡한 출력이 오래됨으로 보인다. 컴포넌트 단위 지문
 * (`generationIdentity.ticketInputFingerprint`, #281)도 같은 규칙을 쓴다.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * 페이지 전체 입력의 지문. 페이지 티켓의 지문이고, #284 시절(protocol 1) 기록의 지문이기도 하다.
 * 컴포넌트 티켓은 자기 하위 트리만 보는 지문을 쓴다(`generationIdentity.ticketInputFingerprint`, #281).
 */
export function inputFingerprint(pageId: PageId, page: ScreenSpec): string {
  return contentHash(canonicalJson({ pageId, page }));
}

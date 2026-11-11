/**
 * 의존성 없는 ZIP 작성기 — 압축 없이 담기만 한다(store, method 0) (이슈 #157).
 *
 * ## 왜 직접 쓰는가
 *
 * 결과 폴더를 브라우저에서 내려받으려면 파일 여러 개를 하나로 묶어야 한다. `jszip`
 * 같은 패키지를 넣는 것이 보통이지만 이 작업은 **의존성 추가가 금지**돼 있고,
 * 실제로 필요한 것은 ZIP 규격 중 가장 단순한 조각뿐이다 — 압축하지 않는 항목,
 * 중앙 디렉터리, 끝 레코드. 세 구조체를 순서대로 쓰면 끝이라 100줄 남짓이다.
 *
 * ## 압축하지 않는다
 *
 * `CompressionStream("deflate-raw")`로 실제 압축을 걸 수 있지만 비동기가 되고
 * 브라우저 지원을 따져야 한다. 내보내는 것은 TSX 몇 개와 이미지 몇 장이라 크기가
 * 문제 될 규모가 아니다. 압축 없는 ZIP도 모든 압축 해제 도구가 그대로 연다
 * (Windows 탐색기·`Expand-Archive`·`unzip` 전부).
 *
 * ## 시각은 고정값이다
 *
 * DOS 시각 필드에 1980-01-01 00:00을 박는다. 같은 입력이면 같은 바이트가 나와야
 * 단위 테스트로 증명할 수 있고, 내보낸 파일에 굳이 시각을 남길 이유도 없다.
 */

/** ZIP에 담을 항목 하나. `path`는 `/` 구분자 상대 경로다. */
export interface ZipEntry {
  path: string;
  bytes: Uint8Array;
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_SIGNATURE = 0x06054b50;

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_OF_CENTRAL_SIZE = 22;

/** 파일명이 UTF-8임을 알리는 general purpose 비트 11. 한글 파일명이 깨지지 않게 한다. */
const FLAG_UTF8 = 0x0800;

/** 1980-01-01. DOS 날짜는 (년-1980)<<9 | 월<<5 | 일 — 0은 유효한 날짜가 아니다. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const DOS_TIME = 0;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

/** ZIP이 각 항목에 요구하는 CRC-32(IEEE). */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** 문자열을 UTF-8 바이트로. 파일 내용과 항목 이름이 같은 함수를 쓴다. */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * 반환 타입을 `Uint8Array<ArrayBuffer>`로 못박는다 — 그냥 `Uint8Array`면 버퍼가
 * `SharedArrayBuffer`일 수도 있다고 보고 `Blob`에 그대로 못 넘긴다(TS 5.7+).
 * 아래에서 `new ArrayBuffer`로 직접 잡으므로 실제로도 공유 버퍼일 수 없다.
 */
export function createZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const prepared = entries.map((entry) => ({
    nameBytes: utf8Bytes(entry.path),
    bytes: entry.bytes,
    crc: crc32(entry.bytes),
  }));

  const localSize = prepared.reduce(
    (sum, entry) => sum + LOCAL_HEADER_SIZE + entry.nameBytes.length + entry.bytes.length,
    0,
  );
  const centralSize = prepared.reduce(
    (sum, entry) => sum + CENTRAL_HEADER_SIZE + entry.nameBytes.length,
    0,
  );

  const output = new Uint8Array(new ArrayBuffer(localSize + centralSize + END_OF_CENTRAL_SIZE));
  const view = new DataView(output.buffer);
  let offset = 0;

  const u16 = (value: number) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const u32 = (value: number) => {
    view.setUint32(offset, value >>> 0, true);
    offset += 4;
  };
  const raw = (bytes: Uint8Array) => {
    output.set(bytes, offset);
    offset += bytes.length;
  };

  const localOffsets: number[] = [];

  for (const entry of prepared) {
    localOffsets.push(offset);
    u32(LOCAL_HEADER_SIGNATURE);
    u16(20); // 풀려면 필요한 최소 버전 (2.0)
    u16(FLAG_UTF8);
    u16(0); // 압축 방식: store
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(entry.crc);
    u32(entry.bytes.length); // 압축 크기 = 원본 크기 (store)
    u32(entry.bytes.length);
    u16(entry.nameBytes.length);
    u16(0); // extra field 없음
    raw(entry.nameBytes);
    raw(entry.bytes);
  }

  const centralStart = offset;

  prepared.forEach((entry, index) => {
    u32(CENTRAL_HEADER_SIGNATURE);
    u16(20); // 만든 쪽 버전
    u16(20); // 풀려면 필요한 최소 버전
    u16(FLAG_UTF8);
    u16(0);
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(entry.crc);
    u32(entry.bytes.length);
    u32(entry.bytes.length);
    u16(entry.nameBytes.length);
    u16(0); // extra
    u16(0); // comment
    u16(0); // 시작 디스크 번호
    u16(0); // 내부 속성
    u32(0); // 외부 속성
    u32(localOffsets[index]);
    raw(entry.nameBytes);
  });

  // 끝 레코드를 쓰기 시작하면 offset이 더 움직이므로 중앙 디렉터리 크기를 먼저 잡는다.
  const centralBytes = offset - centralStart;

  u32(END_OF_CENTRAL_SIGNATURE);
  u16(0); // 이 디스크 번호
  u16(0); // 중앙 디렉터리가 시작하는 디스크
  u16(prepared.length);
  u16(prepared.length);
  u32(centralBytes);
  u32(centralStart);
  u16(0); // 주석 없음

  return output;
}

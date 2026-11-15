/**
 * 작업공간 API 요청이 **어디서 왔는지**를 판정하는 순수 함수 (이슈 #133).
 *
 * `workspacePath.ts`가 "이 경로를 만져도 되는가"를 보는 자리라면, 여기는 그 앞에
 * 오는 질문 — **"이 요청을 받아도 되는가"** — 를 본다. 둘을 나눈 이유도 같다:
 * 판정에 `node:*`도 파일 시스템도 필요 없으니 순수 함수로 떼어내야 단위 테스트가 된다.
 *
 * ## 왜 미들웨어가 스스로 봐야 하는가
 *
 * Vite 8은 개발 서버 앞단에 두 겹의 방어를 깔아 둔다(CVE-2025-24010 대응).
 * `_createServer`의 등록 순서는 이렇다:
 *
 * ```
 * rejectInvalidRequest → cors → hostValidation → [configureServer 훅 = 우리] → transform → ... → SPA 폴백
 * ```
 *
 * 우리 미들웨어는 **보안 두 겹 뒤**에 들어간다. 그래서 위조 Host는 실제로 우리까지
 * 오지 못한다(실측: `Host: evil.example` → Vite가 403 "Blocked request"). 그런데도
 * 여기서 한 번 더 보는 이유가 셋이다.
 *
 * 1. **Vite의 Host 검증은 조건부다.** `allowedHosts === true`이거나 `server.https`가
 *    켜져 있으면 그 미들웨어를 **아예 등록하지 않는다**(`node.js`의
 *    `if (allowedHosts !== true && !serverConfig.https)`). 설정 한 줄이면 방어가 사라진다.
 * 2. **쓰기를 막는 건 서버가 아니라 브라우저였다.** 실측에서 `Origin: http://evil.example`을
 *    단 PUT은 **200으로 파일을 썼다.** 브라우저가 preflight 응답에
 *    `Access-Control-Allow-Origin`이 없는 것을 보고 요청을 안 보내 줄 뿐이다. 즉 파일을
 *    쓰는 API의 마지막 방어선이 **브라우저의 선의**에 있었다. `server.cors: true` 한 줄이면
 *    (흔한 "CORS 고치기" 처방이다) 그 선의마저 사라진다.
 * 3. **등록 위치는 우리가 손대는 값이다.** `vite.config.ts`는 SPA 폴백을 피하려고 등록
 *    시점을 일부러 고르고 있다. 나중에 누가 그 줄을 옮기면 보안 성질이 조용히 바뀐다.
 *    방어가 미들웨어 **안**에 있으면 옮겨도 따라간다.
 *
 * ## 판정 규칙
 *
 * - **Host는 루프백이어야 한다.** DNS rebinding 차단이다. 공격자 도메인이 127.0.0.1로
 *   풀리면 브라우저는 그걸 *같은 출처*로 보므로 CORS가 아예 걸리지 않는다. 그때 남는
 *   단서가 Host 헤더뿐이다.
 * - **Origin이 있으면 Host와 같아야 한다.** 브라우저는 교차 출처 요청과 GET/HEAD가 아닌
 *   모든 요청에 Origin을 붙인다. 그러니 "Origin이 있는데 Host와 다르다" = 교차 출처다.
 * - **Origin이 없으면 통과시킨다.** 같은 출처 GET(브라우저가 Origin을 안 붙인다)과
 *   브라우저가 아닌 클라이언트(CLI·테스트·curl)가 여기 해당한다. 후자를 막을 이유는
 *   없다 — 루프백에서 도는 다른 프로세스는 애초에 파일 시스템에 직접 접근할 수 있다.
 *
 * Vite보다 **엄격한** 지점이 하나 있다: Vite는 `*.localhost`와 모든 IP 리터럴을
 * 통과시키지만 여기서는 루프백만 받는다. `evil.localhost`는 브라우저가 루프백으로
 * 풀어 주는 이름이라 남겨 둘 이유가 없고, LAN IP(`--host`로 노출한 경우)에 파일을
 * 쓰는 API를 열어 주는 것은 이 기능의 의도가 아니다(GUI는 `npx visual-spec`으로
 * 내 컴퓨터에서 띄우는 것이다).
 */

/** 거부 판정. 통과면 `null`이다. */
export type OriginReject = {
  status: number;
  message: string;
};

/** `Host` 헤더를 호스트명과 포트로 가른다. 형식이 깨졌으면 `null`. */
export function splitHostHeader(hostHeader: string): { hostname: string; port: string } | null {
  const value = hostHeader.trim();
  if (value === "") return null;

  // IPv6 리터럴은 대괄호로 싸여 온다: `[::1]:5173`
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end < 0) return null;
    const rest = value.slice(end + 1);
    if (rest !== "" && !/^:\d+$/.test(rest)) return null;
    return { hostname: value.slice(1, end).toLowerCase(), port: rest.slice(1) };
  }

  const colon = value.indexOf(":");
  if (colon < 0) return { hostname: value.toLowerCase(), port: "" };
  // 콜론이 둘 이상이면 대괄호 없는 IPv6다 — Host 헤더로는 유효하지 않다.
  if (value.indexOf(":", colon + 1) >= 0) return null;
  const port = value.slice(colon + 1);
  if (!/^\d+$/.test(port)) return null;
  return { hostname: value.slice(0, colon).toLowerCase(), port };
}

const LOOPBACK_V4 = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** 루프백 주소인가. `localhost`, `127.0.0.0/8`, `::1`만 받는다. */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === "localhost") return true;
  if (hostname === "::1" || hostname === "0:0:0:0:0:0:0:1") return true;
  const v4 = LOOPBACK_V4.exec(hostname);
  if (v4 === null) return false;
  return v4.slice(1).every((octet) => Number(octet) <= 255);
}

/** 비교할 수 있게 `호스트명:포트`로 맞춘다. 포트가 없으면 스킴 기본 포트를 채운다. */
function canonical(hostname: string, port: string, scheme: "http" | "https"): string {
  const resolved = port !== "" ? port : scheme === "https" ? "443" : "80";
  return `${hostname}:${resolved}`;
}

/**
 * 요청을 받아도 되는지 본다. 통과면 `null`, 아니면 거부 사유를 돌려준다.
 *
 * 메서드로 갈라 검사하지 않는다 — 읽기(GET)도 작업공간 파일 내용을 그대로 내보내므로
 * "상태를 안 바꾸니 느슨해도 된다"가 성립하지 않는다.
 */
export function checkRequestOrigin(
  hostHeader: string | undefined,
  originHeader: string | undefined,
): OriginReject | null {
  if (hostHeader === undefined) {
    // HTTP/1.1은 Host를 필수로 요구한다. 없으면 어떤 출처인지 판단할 근거가 없다.
    return { status: 400, message: "Host 헤더가 없습니다." };
  }

  const host = splitHostHeader(hostHeader);
  if (host === null) {
    return { status: 400, message: "Host 헤더 형식이 올바르지 않습니다." };
  }
  if (!isLoopbackHostname(host.hostname)) {
    return {
      status: 403,
      message: "작업공간 API는 루프백(localhost)에서 온 요청만 받습니다.",
    };
  }

  if (originHeader === undefined) return null;

  // 샌드박스 iframe·file:// 문서가 보내는 값이다. 어떤 출처인지 알 수 없으니 거부한다.
  if (originHeader === "null") {
    return { status: 403, message: "출처를 알 수 없는 요청입니다." };
  }

  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return { status: 403, message: "Origin 헤더 형식이 올바르지 않습니다." };
  }
  if (origin.protocol !== "http:" && origin.protocol !== "https:") {
    return { status: 403, message: "Origin 헤더 형식이 올바르지 않습니다." };
  }

  const scheme = origin.protocol === "https:" ? "https" : "http";
  // URL 파서는 IPv6를 `[::1]`로 돌려준다 — Host 헤더 쪽과 모양을 맞춘다.
  const originHostname = origin.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    canonical(originHostname, origin.port, scheme) !== canonical(host.hostname, host.port, "http")
  ) {
    return { status: 403, message: "다른 출처에서 온 요청입니다." };
  }

  return null;
}

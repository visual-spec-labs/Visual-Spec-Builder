import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isInsideWorkspace,
  matchWorkspaceRoute,
  resolveWorkspaceDir,
  resolveWorkspaceFile,
} from "@/features/workspace/workspacePath";

/**
 * 작업공간 경로 해석·검증 (이슈 #133).
 *
 * 이 함수들이 미들웨어의 **유일한 방어선**이라 "탈출이 전부 막힌다"를 케이스로
 * 증명하는 게 이 파일의 목적이다. 통과 케이스보다 거부 케이스가 훨씬 많다.
 */

const ROOT = resolve("/tmp/proj/.visual-spec");

describe("resolveWorkspaceFile — 통과", () => {
  it("specs 아래 JSON은 통과하고 절대 경로를 돌려준다", () => {
    const result = resolveWorkspaceFile(ROOT, "specs/home.json");

    expect(result).toEqual({
      ok: true,
      dir: "specs",
      relativePath: "specs/home.json",
      absolutePath: join(ROOT, "specs", "home.json"),
    });
  });

  it("generated 는 하위 폴더를 허용한다 — 코드 생성이 pages/·components/를 쓴다", () => {
    const result = resolveWorkspaceFile(ROOT, "generated/pages/Home.tsx");

    expect(result).toEqual({
      ok: true,
      dir: "generated",
      relativePath: "generated/pages/Home.tsx",
      absolutePath: join(ROOT, "generated", "pages", "Home.tsx"),
    });
  });

  it("확장자 대소문자는 가리지 않는다 — 카메라가 만든 .JPG 같은 이름", () => {
    const result = resolveWorkspaceFile(ROOT, "assets/Hero.JPG");

    expect(result.ok).toBe(true);
  });

  it("URL 인코딩된 평범한 이름(공백)은 디코딩해서 받는다", () => {
    const result = resolveWorkspaceFile(ROOT, "assets/my%20hero.png");

    expect(result).toMatchObject({ ok: true, relativePath: "assets/my hero.png" });
  });
});

describe("resolveWorkspaceFile — 탈출 시도는 전부 막는다", () => {
  const traversals: Array<[string, string]> = [
    ["상위 폴더", "specs/../../secret.json"],
    ["앞에서 바로 상위로", "../secret.json"],
    ["점 하나 세그먼트", "specs/./home.json"],
    ["URL 인코딩된 ..", "%2e%2e/%2e%2e/secret.json"],
    ["대문자로 인코딩된 ..", "%2E%2E/secret.json"],
    ["인코딩된 구분자로 숨긴 ..", "specs/%2e%2e%2fsecret.json"],
    ["인코딩된 역슬래시", "specs/%5c%5csecret.json"],
    ["역슬래시 구분자(Windows)", "specs\\..\\..\\secret.json"],
    ["Windows 드라이브 문자", "C:/Windows/win.ini"],
    ["드라이브 문자만", "C:"],
    ["UNC 경로", "//server/share/secret.json"],
    ["절대 경로", "/etc/passwd.json"],
    ["NUL 바이트로 자르기", "specs/home.json%00.png"],
    ["제어문자", "specs/ho%0ame.json"],
    ["깨진 퍼센트 인코딩", "specs/%zz.json"],
    ["빈 세그먼트", "specs//home.json"],
    ["폴더로 끝남", "specs/"],
    ["빈 경로", ""],
    ["폴더만", "specs"],
    ["이름 끝의 점(Windows가 떼어낸다)", "specs/home.json."],
    ["이름 끝의 공백(Windows가 떼어낸다)", "specs/home.json%20"],
  ];

  for (const [label, path] of traversals) {
    it(`${label}: ${path}`, () => {
      expect(resolveWorkspaceFile(ROOT, path).ok).toBe(false);
    });
  }

  it("거부 사유를 구분해서 돌려준다 — 미들웨어가 상태 코드로 옮긴다", () => {
    expect(resolveWorkspaceFile(ROOT, "specs/../x.json")).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(resolveWorkspaceFile(ROOT, "runtime/config.json")).toEqual({
      ok: false,
      reason: "forbidden-dir",
    });
    expect(resolveWorkspaceFile(ROOT, "specs/home.txt")).toEqual({
      ok: false,
      reason: "forbidden-extension",
    });
  });
});

describe("resolveWorkspaceFile — 폴더·확장자 화이트리스트", () => {
  it("화이트리스트 밖 폴더는 거부한다 — runtime·preview 는 GUI가 만지지 않는다", () => {
    for (const path of ["runtime/state.json", "preview/index.json", "node_modules/x.json"]) {
      expect(resolveWorkspaceFile(ROOT, path)).toEqual({ ok: false, reason: "forbidden-dir" });
    }
  });

  it("specs 는 .json 만 받는다", () => {
    expect(resolveWorkspaceFile(ROOT, "specs/home.json").ok).toBe(true);
    expect(resolveWorkspaceFile(ROOT, "specs/home.js").ok).toBe(false);
    expect(resolveWorkspaceFile(ROOT, "specs/home").ok).toBe(false);
  });

  it("assets 는 이미지 확장자만 받는다 — .html·.js 를 assets에 못 쓴다", () => {
    expect(resolveWorkspaceFile(ROOT, "assets/hero.png").ok).toBe(true);
    expect(resolveWorkspaceFile(ROOT, "assets/hero.svg").ok).toBe(true);
    expect(resolveWorkspaceFile(ROOT, "assets/evil.html").ok).toBe(false);
    expect(resolveWorkspaceFile(ROOT, "assets/evil.js").ok).toBe(false);
  });

  it("확장자 없는 이름과 점으로 시작하는 이름은 거부한다", () => {
    expect(resolveWorkspaceFile(ROOT, "specs/.json").ok).toBe(false);
    expect(resolveWorkspaceFile(ROOT, "assets/Makefile").ok).toBe(false);
  });
});

describe("isInsideWorkspace", () => {
  it("작업공간 안이면 통과한다", () => {
    expect(isInsideWorkspace(ROOT, join(ROOT, "specs", "home.json"))).toBe(true);
    expect(isInsideWorkspace(ROOT, ROOT)).toBe(true);
  });

  it("밖이면 거부한다", () => {
    expect(isInsideWorkspace(ROOT, resolve("/tmp/proj/secret.json"))).toBe(false);
    expect(isInsideWorkspace(ROOT, resolve("/etc/passwd"))).toBe(false);
  });

  it("접두사만 같은 이웃 폴더를 통과시키지 않는다 — 문자열 startsWith의 함정", () => {
    expect(isInsideWorkspace(ROOT, `${ROOT}-evil/x.json`)).toBe(false);
  });
});

describe("resolveWorkspaceDir — 목록 라우트", () => {
  it("화이트리스트 폴더 하나만 받는다", () => {
    expect(resolveWorkspaceDir(ROOT, "specs")).toEqual({
      ok: true,
      dir: "specs",
      absolutePath: join(ROOT, "specs"),
    });
  });

  it("하위 경로·화이트리스트 밖·탈출은 거부한다", () => {
    expect(resolveWorkspaceDir(ROOT, "specs/nested").ok).toBe(false);
    expect(resolveWorkspaceDir(ROOT, "runtime").ok).toBe(false);
    expect(resolveWorkspaceDir(ROOT, "..").ok).toBe(false);
  });
});

describe("matchWorkspaceRoute", () => {
  it("파일·목록 라우트를 가르고 나머지는 none 이다", () => {
    expect(matchWorkspaceRoute("/__vs/file/specs/home.json")).toEqual({
      kind: "file",
      path: "specs/home.json",
    });
    expect(matchWorkspaceRoute("/__vs/list/specs")).toEqual({ kind: "list", path: "specs" });
    expect(matchWorkspaceRoute("/__vs/status")).toEqual({ kind: "none" });
    expect(matchWorkspaceRoute("/src/main.tsx")).toEqual({ kind: "none" });
  });

  it("쿼리스트링과 해시는 떼어낸다", () => {
    expect(matchWorkspaceRoute("/__vs/file/specs/home.json?t=1#x")).toEqual({
      kind: "file",
      path: "specs/home.json",
    });
  });
});

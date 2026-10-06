import { describe, expect, it } from "vitest";

import {
  buildBundleEntries,
  buildPackageJson,
  buildReadme,
  bundleFileName,
  bundleFolderName,
} from "@/features/editor/export/bundle";
import { verifyGenerated, type VerifyReport } from "@/features/editor/export/verifyGenerated";
import { createZip, crc32, utf8Bytes } from "@/features/editor/export/zip";

/** ZIP 바이트에서 리틀엔디언 정수를 읽는 작은 도우미. */
function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}
function u32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
  );
}

const emptyReport: VerifyReport = verifyGenerated({ files: [], tickets: [], assetNames: [] });

describe("crc32", () => {
  it("규격 시험값 \"123456789\"는 0xCBF43926이다", () => {
    expect(crc32(utf8Bytes("123456789"))).toBe(0xcbf43926);
  });

  it("빈 입력은 0이다", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("createZip", () => {
  it("항목 하나의 헤더·이름·내용·끝 레코드가 규격대로 놓인다", () => {
    const content = utf8Bytes("export const a = 1;\n");
    const zip = createZip([{ path: "pages/Home.tsx", bytes: content }]);

    expect(u32(zip, 0)).toBe(0x04034b50); // local file header
    expect(u16(zip, 8)).toBe(0); // 압축 방식: store
    expect(u32(zip, 14)).toBe(crc32(content));
    expect(u32(zip, 18)).toBe(content.length); // 압축 크기
    expect(u32(zip, 22)).toBe(content.length); // 원본 크기

    const nameLength = u16(zip, 26);
    const name = new TextDecoder().decode(zip.subarray(30, 30 + nameLength));
    expect(name).toBe("pages/Home.tsx");

    const stored = zip.subarray(30 + nameLength, 30 + nameLength + content.length);
    expect(new TextDecoder().decode(stored)).toBe("export const a = 1;\n");

    // 끝 레코드는 항상 마지막 22바이트다(주석이 없으므로).
    const eocd = zip.length - 22;
    expect(u32(zip, eocd)).toBe(0x06054b50);
    expect(u16(zip, eocd + 10)).toBe(1); // 전체 항목 수
    expect(u32(zip, eocd + 16)).toBe(30 + nameLength + content.length); // 중앙 디렉터리 시작
  });

  it("항목이 여럿이면 중앙 디렉터리도 그만큼 쌓인다", () => {
    const zip = createZip([
      { path: "a.txt", bytes: utf8Bytes("a") },
      { path: "b.txt", bytes: utf8Bytes("bb") },
      { path: "c.txt", bytes: utf8Bytes("ccc") },
    ]);

    const eocd = zip.length - 22;
    expect(u16(zip, eocd + 8)).toBe(3);
    expect(u16(zip, eocd + 10)).toBe(3);
    // 중앙 디렉터리 첫 바이트가 실제로 중앙 헤더 서명이어야 한다.
    expect(u32(zip, u32(zip, eocd + 16))).toBe(0x02014b50);
  });

  it("항목이 없어도 유효한 빈 ZIP이다", () => {
    const zip = createZip([]);

    expect(zip.length).toBe(22);
    expect(u32(zip, 0)).toBe(0x06054b50);
    expect(u16(zip, 10)).toBe(0);
  });

  it("같은 입력은 같은 바이트를 낸다 — 시각이 고정값이라서다", () => {
    const entries = [{ path: "a.txt", bytes: utf8Bytes("a") }];
    expect(createZip(entries)).toEqual(createZip(entries));
  });

  it("한글 파일명은 UTF-8 플래그와 함께 담긴다", () => {
    const zip = createZip([{ path: "pages/화면.tsx", bytes: utf8Bytes("x") }]);

    expect(u16(zip, 6) & 0x0800).toBe(0x0800);
    const nameLength = u16(zip, 26);
    expect(new TextDecoder().decode(zip.subarray(30, 30 + nameLength))).toBe("pages/화면.tsx");
  });
});

describe("bundleFolderName", () => {
  it("공백·대문자를 하이픈 소문자로 바꾼다", () => {
    expect(bundleFolderName("Admin Dashboard")).toBe("admin-dashboard");
  });

  it("파일 이름에 못 쓰는 글자를 걸러내고 앞뒤 하이픈까지 정리한다", () => {
    expect(bundleFolderName("보고서/2026*판")).toBe("2026");
  });

  it("남는 글자가 없으면 기본 이름을 쓴다", () => {
    expect(bundleFolderName("   ")).toBe("visual-spec-export");
  });

  it("내려받는 파일 이름은 폴더 이름 + .zip이다", () => {
    expect(bundleFileName("Admin Dashboard")).toBe("admin-dashboard.zip");
  });
});

describe("buildPackageJson", () => {
  it("react는 코드에 import가 없어도 항상 들어간다", () => {
    const parsed: unknown = JSON.parse(buildPackageJson("Dashboard", []));
    expect((parsed as { dependencies: Record<string, string> }).dependencies).toEqual({
      react: "*",
    });
  });

  it("모은 패키지를 정렬해 담고 이름은 폴더 이름과 같다", () => {
    const parsed = JSON.parse(buildPackageJson("Admin Dashboard", ["zustand", "react-dom"])) as {
      name: string;
      dependencies: Record<string, string>;
    };

    expect(parsed.name).toBe("admin-dashboard");
    expect(Object.keys(parsed.dependencies)).toEqual(["react", "react-dom", "zustand"]);
  });
});

describe("buildReadme", () => {
  it("확인한 것과 확인하지 않은 것을 함께 적는다", () => {
    const readme = buildReadme("Dashboard", emptyReport);

    expect(readme).toContain("### 확인한 것");
    expect(readme).toContain("### 확인하지 않은 것");
    expect(readme).toContain("타입 검사");
  });

  it("검증에서 잡힌 문제를 표로 싣는다", () => {
    const report = verifyGenerated({
      files: [{ path: "components/Card.tsx", content: `import { B } from "@/b";` }],
      tickets: [
        {
          id: "Card",
          componentName: "Card",
          kind: "component",
          instances: ["n1"],
          dependsOn: [],
          status: "pending",
        },
      ],
      assetNames: [],
    });

    const readme = buildReadme("Dashboard", report);
    expect(readme).toContain("`components/Card.tsx:1`");
    expect(readme).toContain("오류 1건");
  });

  it("정적 자산 import와 Vite 하위 경로 배포 통합 방법을 안내한다", () => {
    const readme = buildReadme("Photo", emptyReport);
    expect(readme).toContain("src/visual-spec/");
    expect(readme).toContain("정적 import");
    expect(readme).toContain("base 설정(하위 경로 배포 포함)");
  });
});

describe("buildBundleEntries", () => {
  it("모든 항목이 최상위 폴더 하나 아래로 들어간다", () => {
    const entries = buildBundleEntries({
      projectName: "Admin Dashboard",
      files: [{ path: "pages/Home.tsx", content: "x" }],
      assets: [{ name: "hero.png", bytes: new Uint8Array([1, 2, 3]) }],
      report: emptyReport,
    });

    expect(entries.map((entry) => entry.path)).toEqual([
      "admin-dashboard/pages/Home.tsx",
      "admin-dashboard/assets/hero.png",
      "admin-dashboard/package.json",
      "admin-dashboard/README.md",
    ]);
  });

  it("생성된 코드가 없어도 package.json과 README는 담는다", () => {
    const entries = buildBundleEntries({
      projectName: "Dashboard",
      files: [],
      assets: [],
      report: emptyReport,
    });

    expect(entries).toHaveLength(2);
  });

  it("이미지는 바이트 그대로 담는다 — 텍스트로 변환하지 않는다", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    const entries = buildBundleEntries({
      projectName: "Dashboard",
      files: [],
      assets: [{ name: "hero.png", bytes }],
      report: emptyReport,
    });

    expect(entries[0].bytes).toEqual(bytes);
  });

  it("정적 import 경로와 특수문자 자산 파일명을 바꾸지 않고 ZIP에 나란히 담는다", () => {
    const name = "한글-사진 (1)+100-.svg";
    const content = `import imageUrl from "../assets/${name}"; export const image = imageUrl;`;
    const report = verifyGenerated({
      files: [{ path: "pages/ImagePage.tsx", content }],
      tickets: [],
      assetNames: [name],
    });
    const bytes = new Uint8Array([1, 2, 3]);
    const entries = buildBundleEntries({
      projectName: "Photo",
      files: [{ path: "pages/ImagePage.tsx", content }],
      assets: [{ name, bytes }],
      report,
    });
    expect(entries).toContainEqual({ path: `photo/pages/ImagePage.tsx`, bytes: utf8Bytes(content) });
    expect(entries).toContainEqual({ path: `photo/assets/${name}`, bytes });
  });
});

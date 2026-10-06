import { describe, expect, it } from "vitest";

import {
  resolveImportTarget,
  resolveRelativePath,
  ticketFilePath,
} from "@/features/editor/export/generatedPaths";
import {
  classifySpecifier,
  packageNameOf,
  scanAssetReferences,
  scanImports,
} from "@/features/editor/export/importScan";
import {
  verifyGenerated,
  type GeneratedFile,
} from "@/features/editor/export/verifyGenerated";
import type { Ticket } from "@/features/editor/ticket/types";

function ticket(componentName: string, kind: Ticket["kind"] = "component"): Ticket {
  return {
    id: componentName,
    componentName,
    kind,
    instances: ["n1"],
    dependsOn: [],
    status: "pending",
  };
}

describe("ticketFilePath", () => {
  it("page 티켓은 pages/ 아래다", () => {
    expect(ticketFilePath(ticket("DashboardPage", "page"))).toBe("pages/DashboardPage.tsx");
  });

  it("component 티켓은 components/ 아래다", () => {
    expect(ticketFilePath(ticket("Card"))).toBe("components/Card.tsx");
  });
});

describe("resolveRelativePath", () => {
  it("같은 폴더는 ./로 푼다", () => {
    expect(resolveRelativePath("components/Content.tsx", "./Card")).toBe("components/Card");
  });

  it("상위 폴더로 한 단계 나가는 건 generated/ 안이다", () => {
    expect(resolveRelativePath("pages/Home.tsx", "../components/Header")).toBe(
      "components/Header",
    );
  });

  it("generated/ 밖으로 나가면 null이다", () => {
    expect(resolveRelativePath("pages/Home.tsx", "../../src/Button")).toBeNull();
  });

  it("중간의 .은 무시한다", () => {
    expect(resolveRelativePath("pages/Home.tsx", "./../components/./Card")).toBe(
      "components/Card",
    );
  });
});

describe("resolveImportTarget", () => {
  const existing = new Set(["components/Card.tsx", "components/util/index.ts", "lib/helpers.js"]);

  it("확장자를 생략해도 .tsx를 붙여 찾는다", () => {
    expect(resolveImportTarget("pages/Home.tsx", "../components/Card", existing)).toEqual({
      kind: "found",
      path: "components/Card.tsx",
    });
  });

  it("index 파일도 찾는다", () => {
    expect(resolveImportTarget("pages/Home.tsx", "../components/util", existing)).toEqual({
      kind: "found",
      path: "components/util/index.ts",
    });
  });

  it("확장자를 적어 둔 경우도 그대로 찾는다", () => {
    expect(resolveImportTarget("pages/Home.tsx", "../lib/helpers.js", existing)).toEqual({
      kind: "found",
      path: "lib/helpers.js",
    });
  });

  it("없는 파일은 missing이다", () => {
    expect(resolveImportTarget("pages/Home.tsx", "../components/Ghost", existing)).toEqual({
      kind: "missing",
    });
  });

  it("폴더 밖으로 나가면 escaped다", () => {
    expect(resolveImportTarget("pages/Home.tsx", "../../shared/Card", existing)).toEqual({
      kind: "escaped",
    });
  });
});

describe("scanImports", () => {
  it("named·default·side-effect·재수출·동적 import를 모두 찾는다", () => {
    const source = [
      `import { Card } from "./Card";`,
      `import Header from "../components/Header";`,
      `import "./styles.css";`,
      `export { Card } from "./Card";`,
      `const lazy = import("../components/Late");`,
    ].join("\n");

    expect(scanImports(source).map((ref) => ref.specifier)).toEqual([
      "./Card",
      "../components/Header",
      "./styles.css",
      "./Card",
      "../components/Late",
    ]);
  });

  it("여러 줄에 걸친 import도 한 건으로 찾는다", () => {
    const source = `import {\n  Card,\n  Grid,\n} from "./Card";\n`;
    expect(scanImports(source)).toEqual([{ specifier: "./Card", line: 1 }]);
  });

  it("줄 번호는 1부터 센다", () => {
    const source = `const a = 1;\n\nimport { B } from "./B";\n`;
    expect(scanImports(source)[0].line).toBe(3);
  });

  it("import가 없으면 빈 배열이다", () => {
    expect(scanImports(`export default function Page() { return null; }`)).toEqual([]);
  });
});

describe("classifySpecifier", () => {
  it("./·../는 상대 경로다", () => {
    expect(classifySpecifier("./Card")).toBe("relative");
    expect(classifySpecifier("../components/Card")).toBe("relative");
  });

  it("@/·~/·절대 경로는 별칭으로 본다", () => {
    expect(classifySpecifier("@/components/Button")).toBe("alias");
    expect(classifySpecifier("~/lib/x")).toBe("alias");
    expect(classifySpecifier("/src/Button")).toBe("alias");
    expect(classifySpecifier("C:/project/Button")).toBe("alias");
  });

  it("스코프 패키지는 별칭이 아니다", () => {
    expect(classifySpecifier("@tanstack/react-query")).toBe("package");
    expect(classifySpecifier("react")).toBe("package");
  });
});

describe("packageNameOf", () => {
  it("하위 경로를 떼어낸다", () => {
    expect(packageNameOf("react-dom/client")).toBe("react-dom");
  });

  it("스코프 패키지는 두 조각까지 남긴다", () => {
    expect(packageNameOf("@tanstack/react-query/build")).toBe("@tanstack/react-query");
  });
});

describe("scanAssetReferences", () => {
  it("../assets/ 참조를 파일 이름으로 뽑는다", () => {
    expect(scanAssetReferences(`<img src="../assets/hero.png" alt="" />`)).toEqual(["hero.png"]);
  });

  it("../가 몇 겹이든 받는다", () => {
    expect(scanAssetReferences(`<img src="../../assets/logo.svg" />`)).toEqual(["logo.svg"]);
  });

  it("같은 이미지를 여러 번 써도 한 번만 센다", () => {
    const source = `"../assets/a.png" "../assets/a.png" "../assets/b.png"`;
    expect(scanAssetReferences(source)).toEqual(["a.png", "b.png"]);
  });

  it("정적 번들러 import를 이미지 참조로 찾고 파일명은 URL decode하지 않는다", () => {
    const source = [
      `import cover from "../assets/한글-사진 (1)+100%.svg";`,
      `import logo from "../assets/hash-1.svg";`,
    ].join("\n");
    expect(scanAssetReferences(source)).toEqual(["한글-사진 (1)+100%.svg", "hash-1.svg"]);
  });
});

describe("verifyGenerated", () => {
  const tickets = [ticket("Card"), ticket("Content"), ticket("DashboardPage", "page")];

  function file(path: string, content: string): GeneratedFile {
    return { path, content };
  }

  it("생성된 코드가 없으면 티켓 전부가 누락으로 잡힌다", () => {
    const report = verifyGenerated({ files: [], tickets, assetNames: [] });

    expect(report.fileCount).toBe(0);
    expect(report.coveredCount).toBe(0);
    expect(report.errorCount).toBe(3);
    expect(report.issues.every((issue) => issue.code === "missing-file")).toBe(true);
    expect(report.coverage.map((entry) => entry.expectedPath)).toEqual([
      "components/Card.tsx",
      "components/Content.tsx",
      "pages/DashboardPage.tsx",
    ]);
  });

  it("티켓도 코드도 없으면 문제도 없다", () => {
    const report = verifyGenerated({ files: [], tickets: [], assetNames: [] });

    expect(report.issues).toEqual([]);
    expect(report.errorCount).toBe(0);
  });

  it("규칙을 지킨 코드는 오류가 없다", () => {
    const report = verifyGenerated({
      files: [
        file("components/Card.tsx", `export function Card() { return null; }`),
        file("components/Content.tsx", `import { Card } from "./Card";\nexport function Content() { return <Card />; }`),
        file(
          "pages/DashboardPage.tsx",
          `import { Content } from "../components/Content";\nexport default function DashboardPage() { return <Content />; }`,
        ),
      ],
      tickets,
      assetNames: [],
    });

    expect(report.errorCount).toBe(0);
    expect(report.coveredCount).toBe(3);
    expect(report.fileCount).toBe(3);
  });

  it("경로 별칭 import는 오류다", () => {
    const report = verifyGenerated({
      files: [file("components/Card.tsx", `import { Button } from "@/components/ui/Button";`)],
      tickets: [ticket("Card")],
      assetNames: [],
    });

    const issue = report.issues.find((candidate) => candidate.code === "alias-import");
    expect(issue).toMatchObject({ severity: "error", file: "components/Card.tsx", line: 1 });
  });

  it("가리키는 파일이 없는 상대 경로는 오류다", () => {
    const report = verifyGenerated({
      files: [file("components/Card.tsx", `import { Ghost } from "./Ghost";`)],
      tickets: [ticket("Card")],
      assetNames: [],
    });

    expect(report.issues.map((issue) => issue.code)).toContain("unresolved-import");
  });

  it("결과 폴더 밖을 가리키는 상대 경로는 오류다", () => {
    const report = verifyGenerated({
      files: [file("components/Card.tsx", `import { X } from "../../src/X";`)],
      tickets: [ticket("Card")],
      assetNames: [],
    });

    expect(report.issues.map((issue) => issue.code)).toContain("escaping-import");
  });

  it("패키지 import는 오류가 아니라 목록으로 모인다", () => {
    const report = verifyGenerated({
      files: [
        file(
          "components/Card.tsx",
          `import { useState } from "react";\nimport { createRoot } from "react-dom/client";`,
        ),
      ],
      tickets: [ticket("Card")],
      assetNames: [],
    });

    expect(report.errorCount).toBe(0);
    expect(report.packages).toEqual(["react", "react-dom"]);
  });

  it("assets에 있는 이미지 참조는 내보낼 목록에 담기고, 없는 것은 오류다", () => {
    const report = verifyGenerated({
      files: [
        file(
          "pages/DashboardPage.tsx",
          `<img src="../assets/hero.png" /><img src="../assets/gone.png" />`,
        ),
      ],
      tickets: [ticket("DashboardPage", "page")],
      assetNames: ["hero.png", "unused.png"],
    });

    expect(report.usedAssets).toEqual(["hero.png"]);
    const missing = report.issues.find((issue) => issue.code === "missing-asset");
    expect(missing?.message).toContain("gone.png");
  });

  it("정적 이미지 import는 파일 존재를 검사하고 ZIP 자산 목록에 넣는다", () => {
    const files = [file(
      "pages/DashboardPage.tsx",
      `import hero from "../assets/한글-사진 (1)+100%.svg";\nexport default function DashboardPage() { return <img src={hero} />; }`,
    )];
    const report = verifyGenerated({ files, tickets: [], assetNames: ["한글-사진 (1)+100%.svg"] });
    expect(report.errorCount).toBe(0);
    expect(report.usedAssets).toEqual(["한글-사진 (1)+100%.svg"]);

    const missing = verifyGenerated({ files, tickets: [], assetNames: [] });
    expect(missing.issues).toContainEqual(expect.objectContaining({ code: "missing-asset" }));
  });

  it("티켓에 없는 파일은 오류가 아니라 참고로 남는다", () => {
    const report = verifyGenerated({
      files: [file("components/Card.tsx", ""), file("components/helpers.ts", "")],
      tickets: [ticket("Card")],
      assetNames: [],
    });

    const extra = report.issues.find((issue) => issue.code === "extra-file");
    expect(extra).toMatchObject({ severity: "info", file: "components/helpers.ts" });
    expect(report.errorCount).toBe(0);
  });

  it("코드가 아닌 파일은 import를 훑지 않는다", () => {
    const report = verifyGenerated({
      files: [file("notes.md", `import { X } from "@/x";`)],
      tickets: [],
      assetNames: [],
    });

    expect(report.errorCount).toBe(0);
  });
});

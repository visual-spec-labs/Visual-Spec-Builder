import { describe, expect, it } from "vitest";

import {
  migrateV01,
  toVisualSpec,
  validateProjectSpec,
  validateVisualSpec,
} from "@/features/editor/schema";
import type { ProjectSpec, VisualSpec } from "@/features/editor/schema";

import dashboardCards from "../examples/dashboard-cards.json";
import loginScreen from "../examples/login-screen.json";
import twoPageExample from "../examples/two-page-project.json";

const v01 = dashboardCards as VisualSpec;

/** 페이지 2개짜리 프로젝트. 두 예제를 그대로 페이지로 얹는다. */
function twoPageProject(): ProjectSpec {
  return {
    version: "0.2",
    name: "two-page",
    pages: {
      home: (dashboardCards as VisualSpec).screen,
      login: (loginScreen as VisualSpec).screen,
    },
    pageOrder: ["home", "login"],
  };
}

describe("migrateV01 / toVisualSpec", () => {
  it("v0.1 문서를 페이지 1개짜리 프로젝트로 넓힌다", () => {
    const project = migrateV01(v01);

    expect(project.version).toBe("0.2");
    expect(project.pageOrder).toHaveLength(1);
    expect(project.pages[project.pageOrder[0]]).toEqual(v01.screen);
  });

  it("왕복하면 원본 v0.1 문서로 돌아온다", () => {
    const project = migrateV01(v01);
    const back = toVisualSpec(project.pages[project.pageOrder[0]]);

    expect(back).toEqual(v01);
  });

  it("넓힌 결과는 프로젝트 검증을 통과한다", () => {
    expect(validateProjectSpec(migrateV01(v01)).valid).toBe(true);
  });
});

describe("validateProjectSpec", () => {
  it("페이지 2개짜리 프로젝트를 통과시킨다", () => {
    expect(validateProjectSpec(twoPageProject()).valid).toBe(true);
  });

  it("예제 파일 two-page-project.json이 유효하다", () => {
    expect(validateProjectSpec(twoPageExample).valid).toBe(true);
  });

  it("pageOrder는 pages의 키 순서와 달라도 된다", () => {
    // 예제는 pages를 dashboard·login 순으로 담고 pageOrder는 login을 먼저 둔다.
    expect(twoPageExample.pageOrder).toEqual(["login", "dashboard"]);
    expect(validateProjectSpec(twoPageExample).valid).toBe(true);
  });

  it("pageOrder에 pages에 없는 id가 있으면 page-order-mismatch", () => {
    const project = twoPageProject();
    project.pageOrder = ["home", "login", "ghost"];

    const result = validateProjectSpec(project);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "page-order-mismatch",
    );
  });

  it("pages에 있는데 pageOrder에 빠진 페이지가 있으면 page-order-mismatch", () => {
    const project = twoPageProject();
    project.pageOrder = ["home"];

    const result = validateProjectSpec(project);

    expect(result.valid).toBe(false);
    const issue = result.issues.find(
      (candidate) => candidate.code === "page-order-mismatch",
    );
    expect(issue?.path).toBe("/pages/login");
  });

  it("pageOrder가 비어 있으면 스키마 단계에서 걸린다", () => {
    const project = twoPageProject();
    project.pageOrder = [] as unknown as ProjectSpec["pageOrder"];

    const result = validateProjectSpec(project);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("schema");
  });

  it("페이지 안의 그래프 오류는 그 페이지 경로로 보고한다", () => {
    const project = twoPageProject();
    project.pages.login = { ...project.pages.login, root: "nope" };

    const result = validateProjectSpec(project);
    const issue = result.issues.find(
      (candidate) => candidate.code === "root-missing",
    );

    expect(issue?.path).toBe("/pages/login/root");
  });

  it("v0.1 문서를 그대로 넣으면 거부한다", () => {
    expect(validateProjectSpec(v01).valid).toBe(false);
  });
});

describe("validateVisualSpec은 그대로다", () => {
  it("v0.1 예제를 여전히 통과시킨다", () => {
    expect(validateVisualSpec(v01).valid).toBe(true);
  });

  it("프로젝트 문서는 v0.1로서는 거부한다", () => {
    expect(validateVisualSpec(twoPageProject()).valid).toBe(false);
  });
});

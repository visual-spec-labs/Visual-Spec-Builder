import { describe, expect, it } from "vitest";

import loginScreen from "../examples/login-screen.json";
import {
  assertVisualSpec,
  migrateToV03,
  validateVisualSpec,
  visualSpecJsonSchema,
  VisualSpecValidationError,
} from "@/features/editor/schema";
import type {
  Background,
  Border,
  Box,
  ChildReference,
  Color,
  Fill,
  FrameNode,
  GradientStop,
  ImageNode,
  Layout,
  LinearFill,
  Node,
  NodeId,
  Padding,
  ScreenSpec,
  Size,
  SolidFill,
  TextNode,
  Typography,
  VisualSpec,
} from "@/features/editor/schema";

// 팀 전체가 import하는 공개 표면이다. 아래가 컴파일되지 않으면 0.3 계약이 깨진 것이다.
// 타입 이름이 하나라도 사라지거나 바뀌면 tsc 단계에서 잡힌다.

const nodeId: NodeId = "root";
const color: Color = "#111111";
const size: Size = "fill";
const box: Box = { width: size, height: "auto" };
const padding: Padding = { top: 0, right: 0, bottom: 0, left: 0 };
const layout: Layout = {
  direction: "column",
  gap: 8,
  padding,
  mainAxis: "start",
  crossAxis: "stretch",
};
const solid: SolidFill = { type: "solid", color };
const stops: GradientStop[] = [
  { color: "#11111100", at: 0 },
  { color, at: 1 },
];
const linear: LinearFill = { type: "linear", angle: 180, stops: [stops[0], stops[1]] };
const fills: Fill[] = [linear, solid];
const background: Background = fills;
const border: Border = { width: 1, color, radius: 4 };
const typography: Typography = {
  fontFamily: "Pretendard",
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 20,
  letterSpacing: 0,
  textAlign: "left",
};
const childReference: ChildReference = { node: "label" };
const heroReference: ChildReference = { node: "hero" };
const textNode: TextNode = {
  type: "text",
  name: "Label",
  box,
  content: "안녕",
  color,
  typography,
};
const imageNode: ImageNode = {
  type: "image",
  name: "Hero",
  box,
  src: "assets/hero.png",
  fit: "cover",
};
const frameNode: FrameNode = {
  type: "frame",
  name: "Screen",
  box,
  layout,
  background,
  border,
  children: [childReference, heroReference],
};
const node: Node = frameNode;
const screen: ScreenSpec = {
  name: "TypeCheck",
  size: { width: 100, height: 100 },
  root: nodeId,
  nodes: { root: node, label: textNode, hero: imageNode },
};
const spec: VisualSpec = { version: "0.3", screen };

describe("공개 API 표면", () => {
  it("타입만으로 조립한 문서가 검증을 통과한다", () => {
    expect(validateVisualSpec(spec)).toEqual({ valid: true, issues: [] });
  });

  it("assertVisualSpec은 유효한 문서에서 통과한다", () => {
    expect(() => {
      assertVisualSpec(loginScreen);
    }).not.toThrow();
  });

  it("assertVisualSpec은 실패 시 issues를 담은 오류를 던진다", () => {
    try {
      assertVisualSpec({ version: "0.3" });
      expect.unreachable("던져야 한다");
    } catch (error) {
      expect(error).toBeInstanceOf(VisualSpecValidationError);
      expect((error as VisualSpecValidationError).issues.length).toBeGreaterThan(
        0,
      );
    }
  });

  it("옛 문서 변환 함수를 함께 내보낸다", () => {
    expect(migrateToV03({ version: "0.3" })).toEqual({ version: "0.3" });
  });

  it("스키마 JSON을 함께 내보낸다", () => {
    expect(visualSpecJsonSchema.title).toBe("VisualSpec");
    expect(Object.keys(visualSpecJsonSchema.$defs)).toContain("ScreenSpec");
  });
});

import tsParser from "@typescript-eslint/parser";

/**
 * Primitive 컬러 유틸 직접 사용을 금지하는 로컬 규칙.
 * 규칙: docs/DESIGN-TOKEN-RULES.md — "Component에서 Primitive Token 직접 사용 금지".
 *
 * className 문자열에서 `bg-gray-900`, `text-neutral-500`, `border-red-500`,
 * `bg-white` 처럼 팔레트 스케일/리터럴 컬러를 쓰는 유틸을 잡아낸다.
 * Semantic 토큰(bg-surface, text-content, border-line 등)은 통과한다.
 */

// 컬러를 받는 유틸 접두사
const COLOR_PREFIXES = [
  "bg",
  "text",
  "decoration",
  "placeholder",
  "caret",
  "accent",
  "border",
  "border-x",
  "border-y",
  "border-t",
  "border-r",
  "border-b",
  "border-l",
  "border-s",
  "border-e",
  "divide",
  "outline",
  "ring",
  "ring-offset",
  "from",
  "via",
  "to",
  "fill",
  "stroke",
  "shadow",
];

// Tailwind 기본 팔레트 + 프로젝트 커스텀 스케일명(Primitive)
const PRIMITIVE_COLORS = new Set([
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "cream",
]);

// 리터럴 컬러(스케일 없음). transparent/current/inherit 는 허용.
const LITERAL_COLORS = new Set(["white", "black"]);

/** className 문자열에서 금지된 Primitive 컬러 유틸 토큰을 찾는다. */
function findPrimitiveUtilities(classValue) {
  const found = [];
  for (const raw of classValue.split(/\s+/)) {
    if (!raw) continue;
    // 변형(hover:, md:, dark: …) 제거 → 마지막 세그먼트, 선행 "!" 제거, 불투명도(/50) 제거
    const cls = raw.split(":").pop().replace(/^!/, "").split("/")[0];
    for (const prefix of COLOR_PREFIXES) {
      if (!cls.startsWith(`${prefix}-`)) continue;
      const color = cls.slice(prefix.length + 1).split("-")[0];
      if (PRIMITIVE_COLORS.has(color) || LITERAL_COLORS.has(color)) {
        found.push(raw);
        break;
      }
    }
  }
  return found;
}

const localPlugin = {
  rules: {
    "no-primitive-color-utilities": {
      meta: {
        type: "problem",
        docs: {
          description:
            "컴포넌트에서 Primitive 컬러 유틸(bg-gray-900 등) 직접 사용 금지. Semantic 토큰을 사용하세요.",
        },
        schema: [],
        messages: {
          primitive:
            "Primitive 컬러 유틸 '{{cls}}' 직접 사용 금지 — Semantic 토큰(bg-surface, text-content, border-line 등)을 사용하세요. (docs/DESIGN-TOKEN-RULES.md)",
        },
      },
      create(context) {
        function check(node, value) {
          for (const cls of findPrimitiveUtilities(value)) {
            context.report({ node, messageId: "primitive", data: { cls } });
          }
        }
        return {
          JSXAttribute(node) {
            if (node.name.name !== "className") return;
            const value = node.value;
            if (!value) return;
            if (value.type === "Literal" && typeof value.value === "string") {
              check(value, value.value);
            } else if (value.type === "JSXExpressionContainer") {
              const expr = value.expression;
              if (expr.type === "Literal" && typeof expr.value === "string") {
                check(expr, expr.value);
              } else if (expr.type === "TemplateLiteral") {
                for (const quasi of expr.quasis) check(quasi, quasi.value.raw);
              }
            }
          },
        };
      },
    },
  },
};

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { local: localPlugin },
    rules: {
      "local/no-primitive-color-utilities": "error",
    },
  },
];

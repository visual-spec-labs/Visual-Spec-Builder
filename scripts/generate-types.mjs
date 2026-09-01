import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "json-schema-to-typescript";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaDir = resolve(projectRoot, "src/features/editor/schema");
const schemaPath = resolve(schemaDir, "visual-spec.schema.json");
const outputPath = resolve(schemaDir, "types.ts");

// 최상위 VisualSpec 정의는 스키마 루트에 직접 둔다. $defs에 넣고 루트에서 $ref로 가리키면
// json-schema-to-typescript 15.x가 역참조하지 못한다(#/$defs를 #/%24defs로 망가뜨린다).
const schema = JSON.parse(await readFile(schemaPath, "utf8"));

const options = {
  bannerComment: [
    "/* 이 파일은 visual-spec.schema.json 에서 자동 생성됩니다. */",
    "/* 손으로 수정하지 마세요. 재생성: pnpm generate:types */",
  ].join("\n"),
  additionalProperties: false,
};

// 1차 — 루트(VisualSpec v0.1)와 거기서 참조되는 모든 정의.
const rootTypes = await compile(schema, "VisualSpec", options);

/**
 * 2차 — ProjectSpec(v0.2)을 뽑는다.
 *
 * 이 생성기는 **루트에서 참조되지 않는 `$def`를 방출하지 않는다.** ProjectSpec은
 * VisualSpec의 하위가 아니라 나란한 최상위 타입이라 루트에서 닿지 않으므로,
 * 정의를 루트로 올려 한 번 더 컴파일한다. `$defs`를 그대로 달고 가기 때문에
 * `#/$defs/ScreenSpec` 같은 내부 참조는 살아 있고, 결과도 같은 `ScreenSpec`을
 * 재사용한다. 나머지 공유 타입은 1차와 중복이라 필요한 블록만 떼어 붙인다.
 */
const lifted = {
  ...schema.$defs.ProjectSpec,
  $defs: schema.$defs,
  title: "ProjectSpec",
};
const projectTypes = await compile(lifted, "ProjectSpec", {
  ...options,
  bannerComment: "",
});

/**
 * 최상위 선언 하나를 떼어낸다.
 *
 * interface는 앞선 JSDoc까지 포함한다. 중첩 `}`는 들여쓰기돼 있으므로 열 0의 `}`가 끝이다.
 * type 별칭은 한 줄이고 JSDoc이 붙지 않으므로 그 줄만 가져온다 — 앞에 옵션 JSDoc을 두면
 * 바로 위 선언의 주석부터 통째로 빨려 들어온다.
 */
function takeDeclaration(source, kind, name) {
  const pattern =
    kind === "interface"
      ? new RegExp(
          String.raw`(?:/\*\*(?:[^*]|\*(?!/))*\*/\n)?export interface ${name} \{[\s\S]*?\n\}`,
        )
      : new RegExp(`^export type ${name} = [^;]*;`, "m");
  const match = source.match(pattern);

  if (match === null) {
    throw new Error(
      `${name} 선언을 2차 컴파일 결과에서 찾지 못했습니다. 스키마나 생성기 버전을 확인하세요.`,
    );
  }

  return match[0];
}

const types = [
  rootTypes.trimEnd(),
  takeDeclaration(projectTypes, "type", "PageId"),
  takeDeclaration(projectTypes, "interface", "ProjectSpec"),
].join("\n\n");

await writeFile(outputPath, `${types}\n`, "utf8");

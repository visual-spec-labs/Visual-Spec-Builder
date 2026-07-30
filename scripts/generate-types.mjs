import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "json-schema-to-typescript";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(projectRoot, "schema/visual-spec.schema.json");
const outputPath = resolve(projectRoot, "src/types.ts");

const schema = JSON.parse(await readFile(schemaPath, "utf8"));

// json-schema-to-typescript 15.x는 루트의 $ref를 $defs로 역참조하지 못한다.
// 루트에 VisualSpec 정의를 펼쳐 넣어 같은 결과를 얻는다. $defs는 그대로 둔다.
if (schema.$ref === "#/$defs/VisualSpec" && schema.$defs?.VisualSpec) {
  delete schema.$ref;
  Object.assign(schema, schema.$defs.VisualSpec);
}

const types = await compile(schema, "VisualSpec", {
  bannerComment: [
    "/* 이 파일은 schema/visual-spec.schema.json 에서 자동 생성됩니다. */",
    "/* 손으로 수정하지 마세요. 재생성: npm run generate:types */",
  ].join("\n"),
  additionalProperties: false,
});

await writeFile(outputPath, types, "utf8");

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

const types = await compile(schema, "VisualSpec", {
  bannerComment: [
    "/* 이 파일은 visual-spec.schema.json 에서 자동 생성됩니다. */",
    "/* 손으로 수정하지 마세요. 재생성: npm run generate:types */",
  ].join("\n"),
  additionalProperties: false,
});

await writeFile(outputPath, types, "utf8");

import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { buildContractBundle, CONTRACT_BUNDLE_PATH } from "../scripts/build-contract.mjs";

/**
 * `bin/lib/schema.mjs`(로컬 검증기 번들, #278)가 앱 검증기 소스와 어긋나지 않는다.
 * `generate:types`의 드리프트 검사와 같은 역할이다. 실패하면 `pnpm generate:contract`로 재생성한다.
 */
it("커밋된 검증기 번들은 지금 소스로 다시 만든 결과와 같다", async () => {
  expect(readFileSync(CONTRACT_BUNDLE_PATH, "utf8")).toBe(await buildContractBundle());
}, 60_000);

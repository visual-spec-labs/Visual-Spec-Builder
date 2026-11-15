import { expect, it } from 'vitest';
import { validateProjectModuleImports } from '@/features/editor/export/projectModuleImports';
const current='home/pages/Home.tsx';const owned=[current,'home/components/Card.tsx','modal/pages/Modal.tsx'];
it('accepts planned relative imports and preserves bare dependency imports',async()=>{
  await expect(validateProjectModuleImports('import React from "react"; import {X} from "@scope/package/subpath"; import Card from "../components/Card"; export {default as Modal} from "../../modal/pages/Modal.tsx";',current,owned)).resolves.toBeUndefined();
});
it.each([
  'import X from "../../../other/Home";',
  'export {default} from "../../unplanned/Other";',
  'export * from "/tmp/private";',
  'const X=import("@/private");',
  'const X=require("file:///tmp/private");',
  'const X=import(target);',
  'type X=import("../../../private").X;',
  'import X = require("../../../private");',
  'import X from "../components/Card?raw";',
  'import X from "../../runtime/Routes";',
])('rejects an unowned module reference: %s',async source=>{
  await expect(validateProjectModuleImports(source,current,owned)).rejects.toThrow();
});
it('does not interpret comments, strings, or prose as imports',async()=>{
  await expect(validateProjectModuleImports('/* import X from "/private" */ const text="require(whatever)";',current,owned)).resolves.toBeUndefined();
});

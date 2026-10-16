import type { ProjectAssetMapping } from "@/features/editor/ticket/projectInputSnapshot";
import { isWorkspaceSegment } from "@/features/workspace/workspaceSegment";
import { isWindowsDeviceName } from "./generationIdentity";

type Ast = { type: string; start?: number | null; end?: number | null; [key: string]: unknown };
function node(value: unknown): value is Ast { return value !== null && typeof value === "object" && typeof (value as Ast).type === "string"; }
function visit(value: unknown, fn: (value: Ast) => void) {
  if (Array.isArray(value)) { for (const item of value) visit(item, fn); }
  else if (node(value)) {
    fn(value);
    for (const [key, child] of Object.entries(value)) if (!["loc", "comments", "leadingComments", "trailingComments", "innerComments", "tokens"].includes(key)) visit(child, fn);
  }
}
function staticString(value: unknown): string | null {
  if (!node(value)) return null;
  if (value.type === "StringLiteral" && typeof value.value === "string") return value.value;
  if (value.type === "TemplateLiteral" && Array.isArray(value.expressions) && value.expressions.length === 0) {
    const cooked = (value.quasis as { value: { cooked: string | null } }[])[0]?.value.cooked;
    return typeof cooked === "string" ? cooked : null;
  }
  return null;
}
function name(value: unknown): string | null {
  return node(value) && typeof value.name === "string" ? value.name : staticString(value);
}
function validModulePath(path: string): boolean {
  return path.endsWith(".tsx") && path.split("/").every(part => isWorkspaceSegment(part) && !isWindowsDeviceName(part));
}
function relativeAsset(modulePath: string, zipPath: string): string {
  const from = modulePath.split("/").slice(0, -1); const to = zipPath.split("/");
  while (from.length && to.length && from[0] === to[0]) { from.shift(); to.shift(); }
  const path = [...from.map(() => ".."), ...to].join("/");
  return path.startsWith(".") ? path : `./${path}`;
}

/** Rewrites only supported AST image positions. Does not grant output ownership or write files. */
export async function rewriteProjectAssetModule(args: {
  source: string; modulePath: string; ownedModulePaths: readonly string[];
  assets: readonly ProjectAssetMapping[]; externalUrls?: readonly string[];
}): Promise<{ code: string; usedAssets: string[] }> {
  if (!validModulePath(args.modulePath) || !args.ownedModulePaths.includes(args.modulePath)) throw Error("계획에 없는 TSX 모듈입니다.");
  const [{ parse }, { default: parseCss }] = await Promise.all([import("@babel/parser"), import("postcss-value-parser")]);
  const ast = parse(args.source, { sourceType: "module", plugins: ["jsx", "typescript"], errorRecovery: false });
  const identifiers = new Set<string>();
  visit(ast, item => { if (item.type === "Identifier" && typeof item.name === "string") identifiers.add(item.name); });
  const mappings = new Map<string, string>();
  for (const asset of args.assets) {
    if (!/^[a-f0-9]{64}$/.test(asset.sha256) || !new RegExp(`^assets/${asset.sha256}\\.(png|jpg|gif|webp|avif|bmp|ico|svg)$`).test(asset.zipPath)
      || (mappings.has(asset.sha256) && mappings.get(asset.sha256) !== asset.zipPath)) throw Error("자산 mapping이 정규 ZIP 경로와 다릅니다.");
    mappings.set(asset.sha256, asset.zipPath);
  }
  const external = new Set(args.externalUrls ?? []);
  const bindings = new Map<string, { identifier: string; path: string }>();
  const edits: { start: number; end: number; text: string }[] = [];
  const edit = (target: Ast, text: string) => {
    if (typeof target.start !== "number" || typeof target.end !== "number") throw Error("AST 위치를 확인할 수 없습니다.");
    edits.push({ start: target.start, end: target.end, text });
  };
  const image = (value: string): string | null => {
    const match = /^vsb-asset:([a-f0-9]{64})$/.exec(value);
    if (!match) {
      if (/^(https?:\/\/|data:)/i.test(value) && external.has(value)) return null;
      throw Error("이미지는 mapping token 또는 프로젝트에서 허용한 정적 외부 URL이어야 합니다.");
    }
    const hash = match[1]; const path = mappings.get(hash);
    if (!path) throw Error("mapping에 없는 자산 token입니다.");
    if (!bindings.has(hash)) {
      let suffix = bindings.size; while (identifiers.has(`vsbAsset${suffix}`)) suffix++;
      const identifier = `vsbAsset${suffix}`; identifiers.add(identifier); bindings.set(hash, { identifier, path });
    }
    return bindings.get(hash)!.identifier;
  };
  const background = (value: string): string => {
    if (value.includes("\\")) throw Error("escape를 포함한 background URL은 지원하지 않습니다.");
    const tree = parseCss(value);
    const covered: { start: number; end: number }[] = [];
    const replacements: { start: number; end: number; identifier: string }[] = [];
    tree.walk(part => {
      if (part.type === "comment") covered.push({ start: part.sourceIndex, end: part.sourceEndIndex });
      if ("unclosed" in part && part.unclosed) throw Error("닫히지 않은 CSS 값입니다.");
      if (part.type !== "function") {
        if (part.type !== "comment" && /vsb-asset:/i.test(part.value)) throw Error("자산 token은 CSS url() 안에만 허용합니다.");
        return;
      }
      const fn = part.value.toLowerCase();
      if (fn !== "url") {
        if (!["linear-gradient", "radial-gradient", "repeating-linear-gradient", "repeating-radial-gradient", "rgb", "rgba", "hsl", "hsla", "calc"].includes(fn)) throw Error("동적/지원하지 않는 background 함수입니다.");
        return;
      }
      const items = part.nodes.filter(item => item.type !== "space");
      if (items.length !== 1 || !["string", "word"].includes(items[0].type)) throw Error("정적 url() 값이 필요합니다.");
      const identifier = image(items[0].value);
      covered.push({ start: part.sourceIndex, end: part.sourceEndIndex });
      if (identifier) replacements.push({ start: part.sourceIndex, end: part.sourceEndIndex, identifier });
      return false;
    });
    let unsupported = value;
    for (const range of covered.sort((a, b) => b.start - a.start)) unsupported = unsupported.slice(0, range.start) + unsupported.slice(range.end);
    if (/vsb-asset:/i.test(unsupported)) throw Error("자산 token은 CSS url() 안에만 허용합니다.");
    let cursor = 0; const pieces: string[] = [];
    for (const replacement of replacements) {
      pieces.push(JSON.stringify(value.slice(cursor, replacement.start) + 'url("'), replacement.identifier);
      cursor = replacement.end;
      // Start the next literal with the closing url syntax without changing source offsets.
      pieces.push(JSON.stringify('")'));
    }
    if (!replacements.length) return JSON.stringify(value);
    pieces.push(JSON.stringify(value.slice(cursor)));
    return pieces.join(" + ");
  };
  visit(ast, item => {
    if (item.type === "ImportDeclaration" || item.type === "ExportNamedDeclaration" || item.type === "ExportAllDeclaration") {
      const source = staticString(item.source);
      if (source && /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg|css)(?:[?#]|$)/i.test(source)) throw Error("Agent의 직접 자산/CSS import는 계획 범위 밖입니다.");
    }
    if (item.type === "ImportExpression" || (item.type === "CallExpression" && node(item.callee)
      && (item.callee.type === "Import" || (item.callee.type === "Identifier" && item.callee.name === "require")))) {
      const target = item.type === "ImportExpression" ? item.source : (item.arguments as unknown[])[0];
      const source = staticString(target);
      if (source === null || /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg|css)(?:[?#]|$)/i.test(source)) throw Error("동적/직접 자산·CSS import는 지원하지 않습니다.");
    }
    if (item.type !== "JSXOpeningElement") return;
    const tag = name(item.name);
    const attributes = item.attributes as Ast[];
    if (attributes.some(attribute => attribute.type === "JSXSpreadAttribute")) throw Error("JSX spread로 자산 URL/style을 전달할 수 없습니다.");
    for (const attribute of attributes) {
      if (attribute.type !== "JSXAttribute") continue;
      const key = node(attribute.name) && attribute.name.type === "JSXNamespacedName"
        ? `${name(attribute.name.namespace)}:${name(attribute.name.name)}` : name(attribute.name);
      if (tag === "image" && ["href", "xlinkHref", "xlink:href"].includes(key ?? "")) throw Error("SVG image URL은 지원하지 않는 자산 위치입니다.");
      const value = attribute.value;
      if (tag === "img" && (key === "src" || key === "srcSet")) {
        if (key === "srcSet") throw Error("srcSet 자산은 현재 지원하지 않습니다.");
        const literal = node(value) && value.type === "JSXExpressionContainer" ? value.expression : value;
        const text = staticString(literal);
        if (text === null) throw Error("img src는 정적 문자열이어야 합니다.");
        const identifier = image(text);
        if (identifier && node(value)) edit(value, `{${identifier}}`);
      }
      if (key !== "style") continue;
      if (!node(value) || value.type !== "JSXExpressionContainer" || !node(value.expression) || value.expression.type !== "ObjectExpression") throw Error("style은 정적 object 표현이어야 합니다.");
      for (const property of value.expression.properties as Ast[]) {
        if (property.type !== "ObjectProperty" || property.computed) throw Error("style spread/계산 속성은 지원하지 않습니다.");
        const styleKey = name(property.key); const literal = staticString(property.value);
        if (styleKey === "background" || styleKey === "backgroundImage" || styleKey === "background-image") {
          if (literal === null || !node(property.value)) throw Error("background는 정적 문자열이어야 합니다.");
          edit(property.value, background(literal));
        } else {
          // Only background/backgroundImage are image-bearing positions in the v4 contract.
          // Inspect every other static value, including CSS custom properties, rather than
          // letting URL-bearing properties bypass the image mapping/allowlist checks.
          const urlProperty = /^(?:webkit|moz|ms|o)?(?:mask|maskimage|borderimage|borderimagesource|liststyle|liststyleimage|cursor|content|filter|clippath|fill|stroke)$/i.test((styleKey ?? "").replaceAll("-", ""));
          if (literal === null && urlProperty) throw Error("지원하지 않는 동적 style 자산 위치입니다.");
          if (literal !== null) {
            if (/vsb-asset:/i.test(literal) || literal.includes("\\")) throw Error("지원하지 않는 style 자산 위치입니다.");
            parseCss(literal).walk(part => {
              if (part.type === "function" && (/^(?:url|(?:-webkit-)?image-set|image|cross-fade)$/i.test(part.value) || (urlProperty && /^var$/i.test(part.value)))) throw Error("지원하지 않는 style 자산 위치입니다.");
            });
          }
        }
      }
    }
  });
  if (bindings.size && identifiers.has("URL")) throw Error("모듈의 URL 식별자가 자산 URL 생성자와 충돌합니다.");
  const insertion = ast.program.directives.at(-1)?.end ?? ast.program.interpreter?.end ?? 0;
  if (bindings.size) edits.push({ start: insertion!, end: insertion!, text: '\n' + [...bindings.values()].map(binding => `const ${binding.identifier} = new URL(${JSON.stringify(relativeAsset(args.modulePath, binding.path))}, import.meta.url).href;`).join('\n') + '\n' });
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let code = args.source; let last = args.source.length;
  for (const patch of edits) {
    if (patch.end > last) throw Error("자산 AST 변환 범위가 겹칩니다.");
    code = code.slice(0, patch.start) + patch.text + code.slice(patch.end); last = patch.start;
  }
  parse(code, { sourceType: "module", plugins: ["jsx", "typescript"], errorRecovery: false });
  return { code, usedAssets: [...bindings.keys()].sort() };
}

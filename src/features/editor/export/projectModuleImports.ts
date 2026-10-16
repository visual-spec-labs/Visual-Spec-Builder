type AstNode = { type: string; [key: string]: unknown };
function isNode(value: unknown): value is AstNode {
  return value !== null && typeof value === 'object' && typeof (value as AstNode).type === 'string';
}
function literal(value: unknown): string | null {
  if (!isNode(value)) return null;
  if (value.type === 'StringLiteral' && typeof value.value === 'string') return value.value;
  if (value.type === 'TemplateLiteral' && Array.isArray(value.expressions) && value.expressions.length === 0) {
    return (value.quasis as { value: { cooked: string | null } }[])[0]?.value.cooked ?? null;
  }
  return null;
}

/** Validate references without reading arbitrary imported paths or changing source.
 * Bare package imports remain dependencies for later build/Export checks. Local imports
 * must resolve to a TSX ticket in this project plan, never another project's same name.
 */
export async function validateProjectModuleImports(source: string, modulePath: string, ownedModulePaths: readonly string[], onPackage?: (name:string)=>void): Promise<void> {
  if (!ownedModulePaths.includes(modulePath)) throw Error('계획에 없는 프로젝트 모듈입니다.');
  const { parse } = await import('@babel/parser');
  const ast = parse(source, {sourceType:'module',plugins:['jsx','typescript']});
  const owned = new Set(ownedModulePaths);
  function check(target: unknown) {
    const specifier = literal(target);
    if (specifier === null || !specifier || /[\\\0?#]/.test(specifier)) throw Error('정적 정규 프로젝트 import가 필요합니다.');
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
      // Package names/subpaths only; aliases, filesystem paths and URL schemes fail.
      const parts = specifier.split('/');
      const packageName = specifier.startsWith('@') ? parts.slice(0,2).join('/') : parts[0];
      if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(packageName)
        || parts.some(part=>!part||part==='.'||part==='..') || /[:]/.test(specifier)) throw Error('별칭·절대·URL import는 허용하지 않습니다.');
      onPackage?.(packageName);return;
    }
    const parts = modulePath.split('/').slice(0,-1);
    for (const part of specifier.split('/')) {
      if (part === '.') continue;
      if (part === '..') {if (!parts.length) throw Error('프로젝트 밖 import입니다.');parts.pop();}
      else {if (!part) throw Error('정규 상대 import가 아닙니다.');parts.push(part);}
    }
    const resolved = parts.join('/');
    const candidates = resolved.endsWith('.tsx') ? [resolved] : [resolved+'.tsx',resolved+'/index.tsx'];
    if (!candidates.some(path=>owned.has(path))) throw Error('import 대상이 프로젝트 티켓 계획에 없습니다.');
  }
  function visit(value: unknown) {
    if (Array.isArray(value)) {value.forEach(visit);return;}
    if (!isNode(value)) return;
    if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(value.type) && value.source) check(value.source);
    if (value.type === 'ImportExpression') check(value.source);
    if (value.type === 'TSImportType') check(value.argument);
    if (value.type === 'TSExternalModuleReference') check(value.expression);
    if (value.type === 'CallExpression' && isNode(value.callee)
      && (value.callee.type === 'Import' || (value.callee.type === 'Identifier' && value.callee.name === 'require'))) check((value.arguments as unknown[])[0]);
    for (const [key,child] of Object.entries(value)) if (!['loc','comments','leadingComments','trailingComments','innerComments','tokens'].includes(key)) visit(child);
  }
  visit(ast);
}

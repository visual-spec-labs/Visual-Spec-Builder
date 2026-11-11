/** 메뉴바 중앙에 표시할 현재 문서 제목을 만든다. */
export function formatDocumentTitle(
  projectName: string,
  pageName: string,
  fileName: string | null,
): string {
  const documentName = fileName ?? "저장되지 않음";
  return `${projectName} — ${pageName} · ${documentName}`;
}

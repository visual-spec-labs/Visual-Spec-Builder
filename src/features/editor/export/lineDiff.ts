/**
 * 덮어쓰기 확인 화면의 줄 단위 diff — 순수 함수 (이슈 #282).
 *
 * 사람이 "무엇을 잃는가"를 읽는 용도라 최소 diff일 필요는 없다. 앞뒤 공통 줄을 떼고 남은 가운데만
 * LCS로 맞춘다. 가운데가 너무 크면(칸 수 상한) 맞추지 않고 "전부 지우고 전부 더함"으로 보인다 —
 * 틀린 것이 아니라 덜 정돈된 diff다. 브라우저를 멈추게 하는 쪽보다 낫다.
 */

export type DiffLine =
  | { kind: "same" | "add" | "remove"; text: string }
  /** 변경과 멀리 떨어진 같은 줄 묶음을 접은 자리. */
  | { kind: "skip"; count: number };

export interface LineDiff {
  lines: DiffLine[];
  added: number;
  removed: number;
  /** 가운데를 LCS로 맞추지 않고 통째로 바꿈으로 보였다. */
  approximate: boolean;
}

export interface DiffOptions {
  /** 변경 앞뒤로 남길 같은 줄 수. */
  context?: number;
  /** LCS 표의 칸 수 상한. */
  maxCells?: number;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  // 끝 줄바꿈이 만드는 빈 꼬리는 줄로 세지 않는다.
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function middleDiff(before: string[], after: string[], maxCells: number): { lines: DiffLine[]; approximate: boolean } {
  if (before.length * after.length > maxCells) {
    return {
      lines: [
        ...before.map((text): DiffLine => ({ kind: "remove", text })),
        ...after.map((text): DiffLine => ({ kind: "add", text })),
      ],
      approximate: true,
    };
  }
  // table[i][j] = before[i..]와 after[j..]의 LCS 길이
  const width = after.length + 1;
  const table = new Uint32Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i * width + j] = before[i] === after[j]
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      lines.push({ kind: "same", text: before[i] });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      lines.push({ kind: "remove", text: before[i++] });
    } else {
      lines.push({ kind: "add", text: after[j++] });
    }
  }
  while (i < before.length) lines.push({ kind: "remove", text: before[i++] });
  while (j < after.length) lines.push({ kind: "add", text: after[j++] });
  return { lines, approximate: false };
}

/** 변경에서 `context`줄보다 먼 같은 줄을 `skip`으로 접는다. */
function collapse(lines: DiffLine[], context: number): DiffLine[] {
  const keep = lines.map(() => false);
  lines.forEach((line, index) => {
    if (line.kind === "same") return;
    for (let k = Math.max(0, index - context); k <= Math.min(lines.length - 1, index + context); k++) keep[k] = true;
  });
  const result: DiffLine[] = [];
  let skipped = 0;
  lines.forEach((line, index) => {
    if (keep[index]) {
      if (skipped > 0) result.push({ kind: "skip", count: skipped });
      skipped = 0;
      result.push(line);
    } else {
      skipped++;
    }
  });
  if (skipped > 0) result.push({ kind: "skip", count: skipped });
  return result;
}

export function diffLines(before: string, after: string, { context = 3, maxCells = 1_000_000 }: DiffOptions = {}): LineDiff {
  const a = splitLines(before);
  const b = splitLines(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;

  const middle = middleDiff(a.slice(start, a.length - end), b.slice(start, b.length - end), maxCells);
  const all: DiffLine[] = [
    ...a.slice(0, start).map((text): DiffLine => ({ kind: "same", text })),
    ...middle.lines,
    ...a.slice(a.length - end).map((text): DiffLine => ({ kind: "same", text })),
  ];
  return {
    lines: collapse(all, context),
    added: all.filter((line) => line.kind === "add").length,
    removed: all.filter((line) => line.kind === "remove").length,
    approximate: middle.approximate,
  };
}

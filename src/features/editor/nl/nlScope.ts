/**
 * 자연어 요청의 **적용 범위**를 정하는 순수 함수 (이슈 #155).
 *
 * 03-user-flow.md "자연어 요청의 적용 범위"가 규칙을 이미 정해 뒀다 —
 * *"가장 자주 생기는 문제는 '어디를 바꾸라는 것인지' 모호하다는 점이다.
 * 입력창 위에 작업 범위를 항상 표시한다."* 기본값은 요소를 선택했으면 선택 요소,
 * 아무것도 선택 안 했으면 현재 화면이다.
 *
 * **"전체 프로젝트"는 1차에 없다**(docs/08 7.2). 같은 절이
 * *"전체 프로젝트 변경은 위험하므로 자연어로 자동 판단하게 두지 않는다"* 고 적었고,
 * Command가 대상 페이지를 들고 있지 않아 여러 페이지에 걸친 요청을 표현할 수도 없다
 * (docs/08 3.4-(3)).
 *
 * UI가 아니라 순수 함수로 떼어낸 이유는 이 저장소의 vitest environment가 `node`라
 * 브라우저 API를 쓰면 테스트가 안 되기 때문이다(`ui/homePreview.ts`가 선례다).
 */

import { findParentId } from "@/features/editor/command/applyCommand";
import type { NodeId, ScreenSpec } from "@/features/editor/schema";

import type { NlScope, NlScopeKind } from "./nlProtocol";

/**
 * 적용 범위를 정한다.
 *
 * `override`는 사용자가 라디오로 직접 고른 값이다. null이면 기본값 규칙을 따른다.
 * **선택 노드가 없는데 `"node"`를 고른 상태**는 성립하지 않으므로(선택이 풀리면
 * 고를 것이 사라진다) 그 경우에도 화면 범위로 떨어진다 — 호출부가 선택 변경마다
 * override를 지우기는 하지만, 그 초기화를 놓쳐도 없는 노드를 가리키지 않도록
 * 판정 자체가 막는다.
 */
export function resolveScope(
  page: ScreenSpec,
  selectedId: NodeId | null,
  override: NlScopeKind | null = null,
): NlScope {
  const node = selectedId === null ? undefined : page.nodes[selectedId];
  const canUseNode = selectedId !== null && node !== undefined;
  const kind: NlScopeKind = canUseNode && override !== "screen" ? "node" : "screen";

  if (kind === "node" && selectedId !== null && node !== undefined) {
    return { kind: "node", nodeId: selectedId, label: `현재 선택 요소: ${node.name}` };
  }
  return { kind: "screen", nodeId: null, label: `현재 화면: ${page.name}` };
}

/** 라디오 두 칸에 쓸 라벨. 선택 노드가 없으면 `node` 칸은 고를 수 없다. */
export interface ScopeOption {
  kind: NlScopeKind;
  label: string;
  disabled: boolean;
}

export function scopeOptions(page: ScreenSpec, selectedId: NodeId | null): ScopeOption[] {
  const node = selectedId === null ? undefined : page.nodes[selectedId];
  return [
    {
      kind: "node",
      label: node === undefined ? "현재 선택 요소: 없음" : `현재 선택 요소: ${node.name}`,
      disabled: node === undefined,
    },
    { kind: "screen", label: `현재 화면: ${page.name}`, disabled: false },
  ];
}

/**
 * 고른 범위로 **무엇을 바꿀 수 있는지** 한 줄로 알린다(#440).
 *
 * 선택 요소 범위의 요청은 그 노드와 자손만 겨냥한다(nl-response SKILL.md) — 버튼을 선택한 채
 * "버튼 아래에 추가해줘"라고 하면 에이전트가 왕복 한 번 뒤에 범위 오류로 거절한다. 보내기 전에
 * 알 수 있게 라디오 아래에 적고, 옆·바깥에 넣으려면 무엇을 고르면 되는지(부모 요소 이름)까지 쓴다.
 */
export function scopeHint(page: ScreenSpec, scope: NlScope): string {
  const node = scope.nodeId === null ? undefined : page.nodes[scope.nodeId];
  if (scope.kind === "screen" || scope.nodeId === null || node === undefined) {
    return "이 화면의 모든 요소를 바꾸거나 새 요소를 넣을 수 있습니다.";
  }
  const parentId = findParentId(page.nodes, scope.nodeId);
  const parent = parentId === undefined ? undefined : page.nodes[parentId];
  const outside = parent === undefined
    ? ""
    : ` 옆이나 위·아래에 새 요소를 넣으려면 부모 요소(${parent.name})를 선택하거나 "현재 화면"을 고르세요.`;
  if (node.type === "frame") return `${node.name} 요소와 그 안쪽만 바꿉니다 — 안에 새 요소를 넣을 수 있습니다.${outside}`;
  return `${node.name}의 속성(글자·색·크기 등)만 바꿉니다.${outside}`;
}

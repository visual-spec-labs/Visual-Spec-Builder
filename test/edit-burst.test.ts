import { beforeEach, describe, expect, it } from "vitest";

import { initHistory } from "@/features/editor/command/history";
import { migrateV01 } from "@/features/editor/schema";
import type { ScreenSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { createEditBurst } from "@/features/editor/ui/properties/fields/editBurst";

/** 지금 캔버스에 떠 있는 페이지. editor-store.test.ts의 같은 헬퍼와 같다. */
function activePage(): ScreenSpec {
  const { spec, activePageId } = useEditorStore.getState();
  return spec.pages[activePageId];
}

/** 테스트가 spec을 누적으로 바꾸므로 시드 프로젝트로 매번 되돌린다. */
function resetToSeed(): void {
  const spec = migrateV01(seedSpec);
  useEditorStore.setState({
    spec,
    activePageId: spec.pageOrder[0],
    selectedId: null,
    // setState는 부분 병합이라 안 지우면 이전 테스트의 undo 스택이 새어 들어온다.
    // #131에서 history가 페이지별 Record에서 프로젝트 하나의 스택으로 바뀌었다 —
    // editor-store.test.ts의 resetToSeed와 같은 모양으로 새로 시작한다.
    history: initHistory({ spec, activePageId: spec.pageOrder[0] }),
  });
}

/**
 * 쌓인 undo 단계 수. #131 전에는 스택이 페이지별이라 활성 페이지 것을 골라 세느라
 * 이름이 `pageHistoryLength`였지만, 이제 스택이 프로젝트 하나뿐이라 "페이지"가
 * 이름에 남아 있으면 사실이 아니다 — 그래서 이름도 함께 고쳤다. 이 파일의
 * 테스트는 전부 활성 페이지 한 장만 편집하므로 세는 값 자체는 전과 같다.
 */
function historyStepCount(): number {
  return useEditorStore.getState().history.past.length;
}

/**
 * 입력칸 하나를 흉내 낸다 — TextField.tsx의 `handleChange`/`onBlur` 배선 그대로다:
 * 보이는 값과 같으면 건너뛰고, 다르면 `onChange(값, burst.next())`로 커밋한다.
 *
 * 컴포넌트를 실제로 렌더해서 확인하지 않는 이유는 editor-store.test.ts가 #121에서
 * 적어둔 것과 같다 — 이 저장소에는 컴포넌트/훅 테스트 도구가 없고 vitest
 * environment가 node다. 그래서 burst 추적을 editBurst.ts로 떼어내(#132) 진짜
 * 스토어에 물려 여기서 검증한다. TextField.tsx에 남은 것은 이 두 줄을 JSX에
 * 이어 붙이는 일뿐이다.
 */
function fakeTextField(
  read: () => string,
  commit: (value: string, continueEdit?: boolean) => void,
) {
  const burst = createEditBurst();

  function change(next: string): void {
    if (next === read()) return;
    commit(next, burst.next());
  }

  return {
    read,
    change,
    /** 포커스가 빠진다 — 여기서 편집이 끊긴다. */
    blur: () => burst.end(),
    /** 글자를 하나씩 이어 친다. 매 키 입력마다 칸에 보이는 문자열 전체가 올라온다. */
    type(added: string): void {
      for (const char of added) {
        change(read() + char);
      }
    },
    /** 칸을 모두 선택하고 새로 친다 — 첫 글자가 기존 값을 통째로 대체한다. */
    retype(text: string): void {
      let typed = "";
      for (const char of text) {
        typed += char;
        change(typed);
      }
    },
  };
}

describe("createEditBurst", () => {
  it("첫 커밋만 false고 이어지는 커밋은 true다", () => {
    const burst = createEditBurst();

    expect(burst.next()).toBe(false); // 새 undo 단계
    expect(burst.next()).toBe(true); // 같은 단계에 덮어쓰기
    expect(burst.next()).toBe(true);
  });

  it("end가 burst를 끊어 다음 커밋이 다시 새 단계가 된다", () => {
    const burst = createEditBurst();

    burst.next();
    burst.next();
    burst.end();

    expect(burst.next()).toBe(false);
    expect(burst.next()).toBe(true);
  });

  it("추적기끼리 상태를 공유하지 않는다", () => {
    // 칸마다 독립이어야 한다 — ColorField는 한 컴포넌트 안에서 hex·불투명도
    // 두 개를 따로 쓴다. 한쪽 타이핑이 다른 쪽의 첫 글자를 병합해버리면 안 된다.
    const a = createEditBurst();
    const b = createEditBurst();

    a.next();

    expect(b.next()).toBe(false);
  });
});

describe("TextField의 연속 타이핑을 undo 한 단계로 합친다 (#132)", () => {
  beforeEach(resetToSeed);

  describe("페이지 이름 칸", () => {
    /** PageProperties.tsx의 이름 칸 배선 그대로. */
    function nameField() {
      return fakeTextField(
        () => activePage().name,
        (value, continueEdit) => {
          const { activePageId, setPageField } = useEditorStore.getState();
          setPageField(activePageId, "name", value, continueEdit);
        },
      );
    }

    it("여러 글자를 이어 치면 undo 한 번에 타이핑 이전 값으로 돌아간다", () => {
      const before = activePage().name; // 시드의 "DashboardPage"

      nameField().retype("홈화면");

      expect(activePage().name).toBe("홈화면");
      expect(historyStepCount()).toBe(1); // 세 글자를 쳤어도 한 단계

      useEditorStore.getState().undo();

      expect(activePage().name).toBe(before);
    });

    it("포커스가 빠졌다 다시 치면 별개의 undo 단계가 된다", () => {
      const before = activePage().name;
      const field = nameField();

      field.retype("홈화면");
      field.blur();
      field.type(" 설정");

      expect(activePage().name).toBe("홈화면 설정");
      expect(historyStepCount()).toBe(2);

      useEditorStore.getState().undo();
      expect(activePage().name).toBe("홈화면"); // 두 번째 편집만 되돌아간다

      useEditorStore.getState().undo();
      expect(activePage().name).toBe(before);
    });

    it("한글 IME 조합 중간 단계도 같은 burst라 한 단계로 합쳐진다", () => {
      // 조합 중에도 "ㅎ" → "호" → "홈"이 매 단계 onChange로 올라온다. TextField는
      // 그걸 그대로 커밋하되 burst가 이어지므로 undo 단계는 하나뿐이다.
      const before = activePage().name;
      const field = nameField();

      field.change("ㅎ");
      field.change("호");
      field.change("홈");

      expect(activePage().name).toBe("홈");
      expect(historyStepCount()).toBe(1);

      useEditorStore.getState().undo();
      expect(activePage().name).toBe(before);
    });

    it("값이 그대로인 입력은 burst를 시작하지 않아 남의 undo 단계를 덮어쓰지 않는다", () => {
      // 칸을 모두 선택하고 같은 글자를 다시 치면 값은 그대로인 입력이 올라온다.
      // 그때 커밋까지 해버리면 스토어는 no-op인데 burst만 시작돼, 뒤따르는
      // 글자들이 직전 편집(여기서는 gap)의 체크포인트에 덮어써진다.
      useEditorStore.getState().setNodeField("cardA", "layout.gap", 40);
      const afterGap = historyStepCount();

      const field = nameField();
      field.change(activePage().name); // 같은 값 — 아무 일도 없어야 한다

      expect(historyStepCount()).toBe(afterGap);

      field.type("!");

      expect(historyStepCount()).toBe(afterGap + 1); // gap 단계는 그대로 남는다

      useEditorStore.getState().undo();
      const cardA = activePage().nodes.cardA;
      expect(cardA.type === "frame" && cardA.layout.gap).toBe(40); // gap 편집은 살아 있다
    });
  });

  describe("텍스트 노드의 content 칸", () => {
    /** ContentSection.tsx의 TextContentField 배선 그대로(useNodeField 세터). */
    function contentField() {
      return fakeTextField(content, (value, continueEdit) => {
        useEditorStore
          .getState()
          .setNodeField("headerTitle", "content", value, continueEdit);
      });
    }

    function content(): string {
      const node = activePage().nodes.headerTitle;
      return node.type === "text" ? node.content : "";
    }

    it("여러 글자를 이어 치면 undo 한 번에 타이핑 이전 값으로 돌아간다", () => {
      const before = content(); // 시드의 "대시보드"

      contentField().retype("안녕하세요");

      expect(content()).toBe("안녕하세요");
      expect(historyStepCount()).toBe(1); // 다섯 글자를 쳤어도 한 단계

      useEditorStore.getState().undo();

      expect(content()).toBe(before);
    });

    it("포커스가 빠졌다 다시 치면 별개의 undo 단계가 된다", () => {
      const before = content();
      const field = contentField();

      field.retype("안녕");
      field.blur();
      field.type("하세요");

      expect(content()).toBe("안녕하세요");
      expect(historyStepCount()).toBe(2);

      useEditorStore.getState().undo();
      expect(content()).toBe("안녕");

      useEditorStore.getState().undo();
      expect(content()).toBe(before);
    });

    it("여러 줄(multiline)도 같은 배선이라 줄바꿈까지 한 단계다", () => {
      // text 노드의 content는 textarea다. TextField는 input·textarea에 같은
      // handleChange를 물리므로 줄바꿈이 섞여도 burst는 그대로 이어진다.
      const before = content();

      contentField().retype("첫 줄\n둘째 줄");

      expect(content()).toBe("첫 줄\n둘째 줄");
      expect(historyStepCount()).toBe(1);

      useEditorStore.getState().undo();
      expect(content()).toBe(before);
    });

    it("burst를 안 쓰면(예전 동작) 글자마다 단계가 쌓인다", () => {
      // 회귀 감시용 — 이 칸이 다시 continueEdit을 안 넘기게 되면 이렇게 단계가
      // 쌓이고 Ctrl+Z 한 번이 마지막 한 글자만 되돌린다(#132가 신고한 증상).
      for (const value of ["안", "안녕", "안녕하"]) {
        useEditorStore.getState().setNodeField("headerTitle", "content", value);
      }

      expect(historyStepCount()).toBe(3);

      useEditorStore.getState().undo();
      expect(content()).toBe("안녕");
    });
  });
});

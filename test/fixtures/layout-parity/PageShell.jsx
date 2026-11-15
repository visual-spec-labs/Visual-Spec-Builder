// visual-spec-to-react 스킬의 "페이지 viewport와 브라우저 기본 스타일" 셸을 그대로 옮겼다.
// <style> 문자열은 test/layout-parity-fixture.test.ts가 SKILL.md와 같은지 확인한다.
export function PageStyle() {
  return (
    <style>{`
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css");
html, body, #root { width: 100%; min-height: 100%; margin: 0; }
@layer base {
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid; }
  button, input { font: inherit; letter-spacing: inherit; color: inherit; }
  ::placeholder { color: currentColor; opacity: .6; }
}
.vsb-page { display: flex; flex-direction: column; width: var(--vsb-page-width);
  min-height: var(--vsb-page-height); margin-inline: auto; }
`}</style>
  );
}

export function PageShell({ width, height, children }) {
  return (
    <>
      <PageStyle />
      <main className="vsb-page" style={{
        "--vsb-page-width": width, "--vsb-page-height": height,
      }}>
        {children}
      </main>
    </>
  );
}

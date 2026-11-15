"""격리된 Vite 서버에서 지정 fixture로 실제 GUI 회귀를 확인한다.
Python Playwright와 Chromium 필요. 실행법: docs/qa/editing-context.md.
"""
import json
import os
import re
import shutil
import tempfile
from pathlib import Path
import sys

from playwright.sync_api import sync_playwright, expect

repo = Path(__file__).resolve().parents[2]
fixture = json.loads((repo / "examples/responsive-cards.json").read_text(encoding="utf-8"))
artifacts = Path(os.environ.get("VSB_QA_ARTIFACTS", str(Path(tempfile.gettempdir()) / "vsb-289-qa")))
artifacts.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_BIN") or shutil.which("chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.set_default_timeout(10000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173")
    page.get_by_role("button", name=re.compile(r"빈 캔버스에서 시작|\+ 새 프로젝트")).wait_for()
    page.evaluate("""async fixture => {
      const { useEditorStore } = await import('/src/features/editor/store/editorStore.ts');
      const { useNavigationStore } = await import('/src/features/editor/store/navigationStore.ts');
      const { useViewStore } = await import('/src/features/editor/store/viewStore.ts');
      window.qaStore = useEditorStore;
      useEditorStore.getState().loadSpec(fixture);
      useViewStore.setState({propsWidth: 280, propsCollapsed: false});
      useNavigationStore.getState().openEditor();
    }""", fixture)
    panel = page.get_by_role("complementary", name="속성", exact=True)
    status = panel.get_by_role("status", name="현재 편집 범위")
    responsive = panel.get_by_role("region", name="반응형 편집")
    width = responsive.get_by_role("spinbutton", name="미리보기 폭", exact=True)
    criteria = responsive.get_by_role("combobox", name="반응형 편집 기준")
    snapshot = lambda: page.evaluate("""() => {
      const {spec,history} = window.qaStore.getState(); return JSON.stringify({spec,history});
    }""")
    before = snapshot()
    expect(status).to_contain_text("선택: 없음")
    expect(status).to_contain_text("desktop 재정의(override)")
    expect(panel.get_by_role("button", name="페이지 (Page)", exact=True)).to_have_count(0)
    for px, mode in [(767, ""), (768, "tablet"), (1023, "tablet"), (1024, "desktop")]:
        width.fill(str(px))
        expect(criteria).to_have_value(mode)
        expect(panel.get_by_text(f"미리보기 {px}px", exact=True)).to_be_visible()
        expect(status).not_to_contain_text("미리보기")
        assert page.get_by_test_id("responsive-artboard").evaluate("e => e.getBoundingClientRect().width > 0")
    assert snapshot() == before, "Preview mutated document/history"
    # 같은 분기점 안에서 폭을 바꿔도 live region의 DOM을 갱신하지 않는다.
    page.evaluate("""() => {
      window.qaLiveChanges = [];
      new MutationObserver(records => window.qaLiveChanges.push(...records.map(r => r.type)))
        .observe(document.querySelector('[role=status][aria-label="현재 편집 범위"]'), {subtree:true, childList:true, characterData:true});
    }""")
    width.fill("1100")
    expect(panel.get_by_text("미리보기 1100px", exact=True)).to_be_visible()
    assert page.evaluate("() => window.qaLiveChanges.length") == 0
    # A native select is operable with keyboard and changes the preview, too.
    criteria.focus()
    criteria.press("Home")
    criteria.press("Enter")
    expect(criteria).to_have_value("")
    criteria.press("ArrowDown")
    criteria.press("Enter")
    expect(criteria).to_have_value("tablet")
    criteria.press("Home")
    criteria.press("Enter")
    expect(criteria).to_have_value("")
    expect(panel.get_by_role("button", name="페이지 (Page)", exact=True)).to_be_visible()
    expect(panel).to_contain_text("페이지 이름·크기를 편집")
    # Real tree selection; the property panel edits one selected node.
    page.get_by_role("button", name="ElevatedCard", exact=True).click()
    expect(status).to_contain_text("ElevatedCard · 노드 1개")
    expect(panel.get_by_role("button", name="페이지 (Page)", exact=True)).to_have_count(0)
    width.fill("768")
    expect(panel.get_by_role("textbox", name="노드 이름")).to_be_disabled()
    gap = panel.locator('div.flex.flex-col.gap-1').filter(has=page.get_by_text("간격 (Gap)", exact=True)).locator('input')
    gap.fill("19")
    gap.press("Tab")
    stored = page.evaluate("""() => {
      const s=window.qaStore.getState(); const p=s.spec.pages[s.activePageId];
      return {base:p.nodes.elevatedCard.layout.gap, override:p.responsive.overrides.tablet.elevatedCard.layout.gap};
    }""")
    assert stored == {"base": 8, "override": 19}, stored
    release = responsive.get_by_role("button", name="layout.gap 재정의 해제", exact=True)
    release.focus()
    release.press("Enter")
    expect(gap).to_have_value("8")
    page.get_by_role("button", name="되돌리기", exact=True).click()
    expect(status).to_contain_text("선택: 없음")
    page.get_by_role("button", name="ElevatedCard", exact=True).click()
    expect(gap).to_have_value("19")
    # Empty/invalid breakpoint submission announces an error without changing the spec.
    before = snapshot()
    responsive.get_by_role("textbox", name="새 분기점 ID").fill("bad id")
    responsive.get_by_role("button", name="추가", exact=True).focus()
    page.keyboard.press("Enter")
    expect(responsive.get_by_role("alert")).to_contain_text("오류: 새 ID")
    assert snapshot() == before
    # Keyboard traversal and visible focus; both controlling inputs share visible help.
    criteria.focus()
    criteria.press("Tab")
    expect(width).to_be_focused()
    width.press("Shift+Tab")
    expect(criteria).to_be_focused()
    criteria.press("Tab")
    expect(width).to_be_focused()
    width.press("Tab")
    summary = responsive.locator("summary")
    expect(summary).to_be_focused()
    summary.press("Enter")
    expect(responsive.locator("details")).to_have_attribute("open", "")
    expect(responsive.get_by_text("미리보기 폭은 페이지 크기를 바꾸지", exact=False)).to_be_visible()
    assert criteria.get_attribute("aria-describedby") == width.get_attribute("aria-describedby")
    results = []
    for theme in ["light", "dark"]:
        page.evaluate("theme => document.documentElement.dataset.theme = theme", theme)
        width.focus()
        metrics = width.evaluate("""e => {
          const c=getComputedStyle(e), s=getComputedStyle(e.closest('aside'));
          const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
          const rgb=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)};
          const lum=color=>rgb(color).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
          const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
          const help=document.getElementById(e.getAttribute('aria-describedby'));
          const alert=e.closest('section').querySelector('[role=alert]');
          return {focusVisible:e.matches(':focus-visible'),outline:c.outlineWidth,focusContrast:ratio(c.outlineColor,s.backgroundColor),
            helpContrast:ratio(getComputedStyle(help).color,s.backgroundColor),errorContrast:ratio(getComputedStyle(alert).color,s.backgroundColor)};
        }""")
        assert metrics["focusVisible"] and metrics["outline"] == "2px", metrics
        assert metrics["focusContrast"] >= 3 and metrics["helpContrast"] >= 4.5 and metrics["errorContrast"] >= 4.5, metrics
        # Fixed header survives property scrolling; no horizontal overflow at minimum panel width.
        box = status.bounding_box()
        panel.locator('div.overflow-auto').evaluate("e => e.scrollTop = e.scrollHeight")
        assert status.bounding_box() == box
        assert panel.evaluate("e => e.scrollWidth <= e.clientWidth")
        panel.locator('div.overflow-auto').evaluate("e => e.scrollTop = 0")
        page.screenshot(path=str(artifacts / f"{theme}.png"))
        results.append({"theme": theme, **metrics})
    # Root selection and page change clear the previous scope.
    page.get_by_role("button", name="Screen", exact=True).click()
    expect(status).to_contain_text("루트 프레임 1개")
    criteria.select_option("")
    expect(panel).to_contain_text("페이지 이름·크기와 루트 프레임")
    expect(panel.get_by_role("button", name="페이지 (Page)", exact=True)).to_be_visible()
    page.evaluate("() => window.qaStore.getState().addPage()")
    expect(status).to_contain_text("선택: 없음")
    expect(status).not_to_contain_text("CardEffectsPage")
    assert not errors, errors
    report = {"browser": browser.version, "checks": ["767/768/1023/1024 boundaries", "preview preserves spec/history", "none/node/root/page scope", "override edit/inherit/undo", "invalid input alert", "Tab/Enter/select keyboard", "persistent header/minimum width", "light/dark contrast"], "contrast": results, "pageErrors": errors}
    (artifacts / "result.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=True))
    browser.close()

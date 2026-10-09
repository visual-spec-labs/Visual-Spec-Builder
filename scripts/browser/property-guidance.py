"""#289 실제 속성 패널 회귀. 격리된 Vite URL을 인자로 전달한다."""
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or shutil.which('chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1280,'height':900})
    page.set_default_timeout(10000)
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(sys.argv[1])
    page.get_by_role('button',name=re.compile('빈 캔버스에서 시작|\\+ 새 프로젝트')).click()
    page.get_by_role('button',name='File',exact=True).wait_for()
    page.evaluate('''async () => {
      const {useEditorStore:s}=await import('/src/features/editor/store/editorStore.ts');
      const {createNode}=await import('/src/features/editor/store/createNode.ts');
      const {useNavigationStore:n}=await import('/src/features/editor/store/navigationStore.ts');
      const {useDocumentStore:d}=await import('/src/features/editor/store/documentStore.ts');
      const {useViewStore:v}=await import('/src/features/editor/store/viewStore.ts');
      const {useResponsiveViewStore:r}=await import('/src/features/editor/responsive/responsiveViewStore.ts');
      const nodes={root:createNode('frame',{name:'QA root',children:['frame','text','image','button','input'].map(id=>({node:id})),background:[]})};
      for(const kind of ['frame','text','image','button','input']) nodes[kind]=createNode(kind,{name:`QA ${kind}`});
      nodes.frame.background=[]; nodes.text.content=''; nodes.input.placeholder='';
      s.getState().loadSpec({version:'0.3',screen:{name:'QA properties',root:'root',size:{width:1440,height:900},nodes,responsive:{breakpoints:{tablet:{minWidthPx:768},desktop:{minWidthPx:1024}},overrides:{}}}});
      const {validateProjectSpec}=await import('/src/features/editor/schema/validate.ts');
      const validation=validateProjectSpec(s.getState().spec); if(!validation.valid) throw new Error(JSON.stringify(validation.issues));
      d.getState().clearFileName(); r.getState().setWidth(s.getState().activePageId,767);
      v.setState({propsWidth:280,propsCollapsed:false}); n.getState().openEditor(); window.qa=s;
    }''')
    panel=page.get_by_role('complementary',name='속성',exact=True)
    expect(panel).to_be_visible()
    assert round(panel.bounding_box()['width'])==280
    criteria=panel.get_by_role('combobox',name='반응형 편집 기준')
    def select(node):
        page.evaluate('id=>window.qa.getState().select(id)',node)
    def spec(): return page.evaluate('JSON.stringify(window.qa.getState().spec)')
    def history(): return page.evaluate('window.qa.getState().history.past.length')
    def section(name): return panel.locator('section').filter(has=page.get_by_role('button',name=name,exact=True))
    # 루트 + 스키마 노드 5종, base/override에서 이름 없는 실제 폼 컨트롤이 없어야 한다.
    orders={}
    for theme in ['light', 'dark']:
        page.evaluate('t=>document.documentElement.dataset.theme=t',theme)
        for mode in ['', 'tablet']:
            criteria.select_option(mode)
            for node in ['root','frame','text','image','button','input']:
                select(node)
                orders[f'{theme}/{mode or "base"}/{node}']=panel.locator('section > button').all_text_contents()
                unnamed=panel.locator('input:not([type=hidden]):not([type=file]),textarea,select').evaluate_all('''els=>els.filter(e=>!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&![...e.labels??[]].some(l=>l.textContent.trim())).map(e=>e.outerHTML)''')
                assert not unnamed, unnamed
                expect(panel.locator('[aria-invalid=true]')).to_have_count(0)
                assert panel.evaluate('e=>e.scrollWidth<=e.clientWidth'),node
    page.evaluate("document.documentElement.dataset.theme='light'")
    criteria.select_option('')
    select('frame')
    gap=panel.get_by_role('spinbutton',name='간격 (Gap)',exact=True)
    before=spec(); past=history()
    gap.fill('-1'); expect(gap).to_have_attribute('aria-invalid','true')
    expect(panel.get_by_role('alert')).to_contain_text('0 이상')
    assert spec()==before and history()==past
    gap.press('Tab'); expect(gap).to_have_value('-1') # blur does not discard invalid draft
    gap.fill('12'); gap.fill('16'); expect(gap).to_have_attribute('aria-invalid','false')
    assert history()==past+1
    page.get_by_role('button',name='되돌리기',exact=True).click()
    assert spec()==before
    select("frame")
    width=panel.get_by_role('spinbutton',name='너비 (W) px',exact=True)
    before=spec(); width.fill('-2'); expect(width).to_have_attribute('aria-invalid','true'); assert spec()==before
    assert '0 이상의 숫자' in page.locator('[id="'+width.get_attribute('aria-describedby').split()[-1]+'"]').text_content()
    width.fill('220'); expect(width).to_have_attribute('aria-invalid','false')
    mode=panel.get_by_role('combobox',name='너비 (W) 크기 모드')
    for value,label in [('auto','내용 맞춤'),('fill','공간 채움'),('fixed','고정')]:
        mode.select_option(value); expect(mode).to_have_value(value)
        assert label in page.locator('[id="'+mode.get_attribute('aria-describedby')+'"]').text_content()
    panel.get_by_role('button',name='그리드 (grid) — 열 N개 균등 배치',exact=True).click()
    columns=panel.get_by_role('spinbutton',name='열 개수',exact=True)
    before=spec();columns.fill('1.5');expect(columns).to_have_attribute('aria-invalid','true');assert spec()==before
    expect(panel.get_by_role('alert')).to_contain_text('정수');columns.fill('2')
    panel.get_by_role('button',name='세로 (column)',exact=True).click()
    # 배경 empty -> 추가 -> 삭제 -> Undo, 색상과 불투명도 오류 수정.
    bg=section('배경 (Background)')
    expect(bg).to_contain_text('배경 채우기가 없습니다')
    bg.get_by_role('button',name='채우기 추가',exact=True).click()
    color=bg.get_by_role('textbox',name='색 hex',exact=True)
    before=spec();color.fill('12');expect(color).to_have_attribute('aria-invalid','true');assert spec()==before
    color.press('Tab');expect(color).to_have_value('#12')
    color.fill('123456');expect(color).to_have_attribute('aria-invalid','false')
    opacity=bg.get_by_role('spinbutton',name='색 불투명도')
    before=spec();opacity.fill('101');expect(opacity).to_have_attribute('aria-invalid','true');assert spec()==before
    expect(bg.get_by_role('alert')).to_contain_text('0~100')
    opacity.fill('50');expect(opacity).to_have_attribute('aria-invalid','false')
    filled=spec();bg.get_by_role('button',name='겹 1 삭제',exact=True).click();expect(bg).to_contain_text('배경 채우기가 없습니다')
    page.get_by_role('button',name='되돌리기',exact=True).click();assert spec()==filled
    select('frame')
    bg.get_by_role('button',name='선형 그라디언트 (linear)',exact=True).click()
    angle=bg.get_by_role('spinbutton',name='각도',exact=True)
    before=spec();angle.fill('360');expect(angle).to_have_attribute('aria-invalid','true');assert spec()==before
    expect(bg.get_by_role('alert')).to_contain_text('360 미만');angle.fill('359')
    bg.get_by_role('button',name='이미지 배경 (image)',exact=True).click()
    expect(bg).to_contain_text('이미지가 비어 있습니다')
    expect(bg.get_by_role('button',name='채우기 (cover) — 비율 유지, 넘치면 잘린다',exact=True)).to_be_visible()
    # 일반 opacity도 공통 NumberField의 설명을 제공한다.
    effect=section('효과 (Effects)').get_by_role('spinbutton',name='불투명도',exact=True)
    before=spec();effect.fill('101');expect(effect).to_have_attribute('aria-invalid','true');assert spec()==before
    effect.fill('75');expect(effect).to_have_attribute('aria-invalid','false')
    # 기본 image와 breakpoint image가 같은 fit 설명을 사용한다.
    select('image')
    # 기존 빈 src 표시만 별도 fixture로 검사한다. src는 스키마상 필수이므로 유효 편집 fixture와 섞지 않는다.
    saved=page.evaluate('structuredClone(window.qa.getState().spec)')
    page.evaluate("() => {const s=window.qa.getState();const spec=structuredClone(s.spec);spec.pages[s.activePageId].nodes.image.src='';s.loadSpec(spec);window.qa.getState().select('image')}")
    criteria.select_option('');expect(panel).to_contain_text('이미지가 비어 있습니다')
    page.evaluate("spec=>{window.qa.getState().loadSpec(spec);window.qa.getState().select('image')}",saved)
    criteria.select_option('')
    fit='채우기 (cover) — 비율 유지, 넘치면 잘린다'
    expect(panel.get_by_role('button',name=fit,exact=True)).to_be_visible()
    criteria.select_option('tablet');expect(panel.get_by_role('button',name=fit,exact=True)).to_be_visible()
    panel.get_by_role('button',name='맞추기 (contain) — 비율 유지, 남으면 빈다',exact=True).click()
    assert page.evaluate('window.qa.getState().spec.pages[window.qa.getState().activePageId].nodes.image.fit')=='cover'
    criteria.select_option('');select('text')
    content=panel.get_by_role('textbox',name='텍스트',exact=True)
    expect(content).to_have_value('');expect(content).not_to_have_attribute('aria-invalid','true')
    before=spec();past=history();content.focus()
    cdp=page.context.new_cdp_session(page)
    for text in ['ㅎ','하','한']:
        cdp.send('Input.imeSetComposition',{'text':text,'selectionStart':len(text),'selectionEnd':len(text)})
    cdp.send('Input.insertText',{'text':'한글'})
    expect(content).to_have_value('한글');assert history()==past+1
    page.get_by_role('button',name='되돌리기',exact=True).click();assert spec()==before
    # 실제 Tab/Shift+Tab, section collapse removes controls from traversal.
    select('frame');width=panel.get_by_role('spinbutton',name='너비 (W) px',exact=True);mode=panel.get_by_role('combobox',name='너비 (W) 크기 모드')
    width.focus();width.press('Tab');expect(mode).to_be_focused();mode.press('Shift+Tab');expect(width).to_be_focused()
    size_button=panel.get_by_role('button',name='크기 (Size)',exact=True)
    size_button.focus();size_button.press('Enter');expect(size_button).to_have_attribute('aria-expanded','false');expect(width).to_have_count(0)
    size_button.press('Tab');assert page.evaluate('document.activeElement.tagName')=='BUTTON'
    size_button.focus();size_button.press('Enter');expect(width).to_have_count(1)
    # 280px, two themes: error/help and keyboard outline contrast measured from rendered CSS.
    reports=[];artifacts=Path(tempfile.gettempdir())/'vsb-property-guidance';artifacts.mkdir(exist_ok=True)
    width.fill('-1')
    for theme in ['light','dark']:
        page.evaluate('t=>document.documentElement.dataset.theme=t',theme)
        width.focus();width.press('Tab');mode.press('Shift+Tab')
        metrics=width.evaluate('''e=>{
          const c=getComputedStyle(e),surface=getComputedStyle(e.closest('aside')).backgroundColor;
          const ctx=document.createElement('canvas').getContext('2d');
          const lum=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)};
          const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
          const descriptions=e.getAttribute('aria-describedby').split(' ').map(id=>document.getElementById(id));
          return {focus:e.matches(':focus-visible'),outline:c.outlineWidth,focusContrast:ratio(c.outlineColor,surface),textContrast:descriptions.map(d=>ratio(getComputedStyle(d).color,surface))};
        }''')
        assert metrics['focus'] and metrics['outline']=='2px' and metrics['focusContrast']>=3,metrics
        assert min(metrics['textContrast'])>=4.5,metrics
        assert panel.evaluate('e=>e.scrollWidth<=e.clientWidth')
        assert panel.locator('div.overflow-auto').evaluate('e=>e.scrollWidth<=e.clientWidth')
        page.screenshot(path=str(artifacts/f'{theme}.png'));reports.append({'theme':theme,**metrics})
    panel.get_by_role('button',name='속성 패널 접기').click();expect(panel).to_have_count(0)
    expand=page.get_by_role('button',name='속성 패널 펼치기');expand.focus();expand.press('Enter');expect(panel).to_be_visible()
    assert not errors,errors
    result={'browser':browser.version,'sections':orders,'contrast':reports,'pageErrors':errors,'ime':'Chromium CDP composition; OS IME not automated'}
    (artifacts/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False));browser.close()

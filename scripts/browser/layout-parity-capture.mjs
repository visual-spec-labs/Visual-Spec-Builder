// 브라우저 안에서 실행한다. GUI와 생성 앱 모두 같은 함수로 잰다.
export async function captureInPage({ scopeSelector, shellSelector, rootId, inputIds, expectedFontIds, viewport, documentScroll }) {
  const scope = scopeSelector ? document.querySelector(scopeSelector) : document;
  if (!scope) throw new Error(`측정 범위가 없습니다: ${scopeSelector}`);
  const all = [...scope.querySelectorAll("[data-node-id]")];
  const ids = all.map((element) => element.dataset.nodeId);
  const duplicateIds = [...new Set(ids.filter((id, index) => id && ids.indexOf(id) !== index))];
  const emptyIds = ids.filter((id) => !id).length;
  const isVisible = (element) => {
    for (let current = element; current instanceof Element; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    }
    return element.getClientRects().length > 0;
  };
  const visible = all.filter(isVisible);
  const hiddenNodeIds = all.filter((element) => !isVisible(element)).map((element) => element.dataset.nodeId);
  const placeholderElement = (element) => element instanceof HTMLInputElement ? null : element.querySelector(":scope > span");

  // unicode-range subset까지 받도록 실제 글자로 폰트를 요청한 뒤 전체 준비를 기다린다.
  const fontLoads = await Promise.allSettled(visible.flatMap((element) => {
    const style = getComputedStyle(element);
    const texts = [element.textContent, element.getAttribute("placeholder")].filter((text) => text?.trim());
    return texts.map((text) => document.fonts.load(`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, text));
  }));
  const fontLoadErrors = fontLoads.filter((result) => result.status === "rejected").map((result) => String(result.reason));
  await document.fonts.ready;

  const images = {};
  for (const element of visible) {
    const id = element.dataset.nodeId;
    if (element instanceof HTMLImageElement) {
      try { await element.decode(); } catch { /* 아래 loaded=false로 보고한다 */ }
      images[id] = { loaded: element.complete && element.naturalWidth > 0, naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight };
      continue;
    }
    const urls = [...getComputedStyle(element).backgroundImage.matchAll(/url\("(.+?)"\)/g)];
    for (const [index, match] of urls.entries()) {
      const image = new Image();
      image.src = match[1];
      let loaded = true;
      try { await image.decode(); } catch { loaded = false; }
      images[index === 0 ? id : `${id}::background:${index}`] = {
        loaded: loaded && image.naturalWidth > 0, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
      };
    }
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const lineCount = (element) => {
    const texts = [];
    const owner = element.closest("[data-node-id]");
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent.trim() && node.parentElement.closest("[data-node-id]") === owner && isVisible(node.parentElement)) texts.push(node);
    }
    if (texts.length === 0) return undefined;
    const range = document.createRange();
    const tops = new Set();
    for (const text of texts) {
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) if (rect.width > 0) tops.add(Math.round(rect.top));
    }
    return tops.size;
  };
  const root = visible.find((element) => element.dataset.nodeId === rootId);
  if (!root) throw new Error("표시 중인 root가 없습니다.");
  // GUI 아트보드의 transform: scale을 되돌린다. 좌표는 root 바깥 모서리 기준이라 pan과 무관하다.
  const shellElement = shellSelector ? document.querySelector(shellSelector) : null;
  const scale = scopeSelector && shellElement ? shellElement.getBoundingClientRect().width / shellElement.offsetWidth : 1;
  const rootRect = root.getBoundingClientRect();
  const nodes = {};
  for (const element of visible) {
    const rect = element.getBoundingClientRect();
    const lines = inputIds.includes(element.dataset.nodeId) ? undefined : lineCount(element);
    nodes[element.dataset.nodeId] = {
      x: (rect.left - rootRect.left) / scale, y: (rect.top - rootRect.top) / scale,
      width: rect.width / scale, height: rect.height / scale, ...(lines === undefined ? {} : { lines }),
    };
  }
  const placeholders = {};
  for (const id of inputIds) {
    const element = visible.find((candidate) => candidate.dataset.nodeId === id);
    if (!element) continue;
    const span = placeholderElement(element);
    const style = span ? getComputedStyle(span) : getComputedStyle(element, "::placeholder");
    placeholders[id] = {
      text: span ? span.textContent : element.placeholder, color: style.color, opacity: style.opacity,
      fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
      ...(span ? { lines: lineCount(span) } : {}),
    };
  }
  const shellRect = shellElement?.getBoundingClientRect();
  return {
    rootId, expectedFontIds, fontLoadErrors,
    viewport: {
      width: viewport.width, height: viewport.height, devicePixelRatio,
      visualViewportScale: visualViewport?.scale ?? 1,
      canvasZoomPercent: Math.round(scale * 10000) / 100,
      fontStatus: document.fonts.status,
      fontFaces: [...new Set([...document.fonts].map((font) => `${font.family}/${font.style}/${font.weight}/${font.status}`))].sort(),
      window: { width: innerWidth, height: innerHeight },
    },
    nodes,
    placeholders,
    images,
    ...(shellRect ? { shell: {
      width: shellRect.width / scale, height: shellRect.height / scale, scrollHeight: shellElement.scrollHeight,
      ...(documentScroll ? { documentScrollHeight: document.scrollingElement.scrollHeight } : {}),
    } } : {}),
    ...(documentScroll ? { documentScrollHeight: document.scrollingElement.scrollHeight } : {}),
    duplicateIds, emptyIds, hiddenNodeIds,
  };
}

/** CDP로 각 텍스트를 실제로 그린 플랫폼 폰트를 읽는다. 선언된 FontFace만으로는 폴백 여부를 알 수 없다. */
async function readRenderedFonts(page, capture, inputIds) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
    const byId = new Map();
    const attribute = (node, name) => {
      const attributes = node.attributes ?? [];
      for (let index = 0; index < attributes.length; index += 2) if (attributes[index] === name) return attributes[index + 1];
      return undefined;
    };
    const walk = (node) => {
      const id = attribute(node, "data-node-id");
      if (id !== undefined && !byId.has(id)) byId.set(id, node);
      for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? []), ...(node.contentDocument ? [node.contentDocument] : [])]) walk(child);
    };
    walk(root);
    const fontsOf = async (node) => {
      const fonts = [];
      const visit = async (current) => {
        if (current !== node && attribute(current, "data-node-id") !== undefined) return;
        if (current.nodeType === 1) {
          const result = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: current.nodeId });
          fonts.push(...result.fonts.filter((font) => font.glyphCount > 0)
            .map(({ familyName, isCustomFont }) => ({ familyName, isCustomFont })));
        }
        for (const child of current.children ?? []) await visit(child);
      };
      await visit(node);
      return [...new Map(fonts.map((font) => [JSON.stringify(font), font])).values()];
    };
    const findPlaceholder = (node) => {
      if (attribute(node, "id") === "placeholder" || attribute(node, "pseudo") === "-webkit-input-placeholder") return node;
      for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) {
        const found = findPlaceholder(child);
        if (found) return found;
      }
      return undefined;
    };
    const renderedFonts = {};
    const unavailable = [];
    for (const [id, bounds] of Object.entries(capture.nodes)) {
      const node = byId.get(id);
      if (bounds.lines > 0 || capture.expectedFontIds.includes(id)) {
        if (node) renderedFonts[id] = await fontsOf(node);
        else unavailable.push(id);
      }
    }
    for (const id of inputIds) {
      const node = byId.get(id);
      if (!node || !capture.nodes[id] || !capture.expectedFontIds.includes(`${id}::placeholder`)) continue;
      const target = node.nodeName === "INPUT" ? findPlaceholder(node) : node.children?.find((child) => child.nodeName === "SPAN");
      if (target) renderedFonts[`${id}::placeholder`] = await fontsOf(target);
      else unavailable.push(`${id}::placeholder`);
    }
    return { renderedFonts, unavailable };
  } finally {
    await cdp.detach();
  }
}

export async function capture(page, options, inputIds) {
  const result = await page.evaluate(captureInPage, { ...options, inputIds });
  try {
    const { renderedFonts, unavailable } = await readRenderedFonts(page, result, inputIds);
    return { ...result, renderedFonts, renderedFontsUnavailable: unavailable };
  } catch (error) {
    return { ...result, renderedFonts: {}, renderedFontsUnavailable: result.expectedFontIds,
      fontLoadErrors: [...result.fontLoadErrors, `CDP: ${error.message}`] };
  }
}


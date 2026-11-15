#!/usr/bin/env node
// 프로젝트·노드·이미지 규모별 성능 실측(#293).
//
//   node scripts/perf/measure.mjs [--reps 5] [--scenario S1,S2] [--chrome <path>] [--json out.json]
//                                 [--node-env development] [--profile]
//   --node-env <값>        개발 서버의 NODE_ENV. 기본은 CLI(`visual-spec`)와 같은 production이다(#314 —
//                          사용자 GUI는 React production 빌드로 돈다). development는 #314 이전·`pnpm dev` 비교용.
//   --profile              측정 반복 뒤 별도 반복 하나에서 홈 진입·편집 구간 CPU 자기 시간 상위를 뽑는다
//                          (결과 중앙값에는 섞지 않는다. --json이면 함께 저장한다).
//
// 사용자가 실제로 쓰는 방식 그대로 Vite 개발 서버(GUI)를 픽스처 작업공간으로 띄우고, 헤드리스
// Chrome을 DevTools 프로토콜(Node 내장 WebSocket — Node 22 이상, Node 20은 자동으로 --experimental-websocket)로
// 몬다. 외부 패키지를 쓰지 않는다.
// 반복마다 새 브라우저 컨텍스트(저장소·캐시 분리)에서 잰다.
//
// 재는 것(모두 페이지의 performance.now 기준, ms):
//   home   — 내비게이션 시작 → 첫 화면이 찰 때까지: 카드가 모두 들어왔거나 마지막 카드가 화면 아래 끝에 닿았고,
//            화면에 보이는 카드의 미리보기가 모두 그려졌다. homeAll은 카드가 모두 들어오고 읽기가 끝날 때까지
//   open   — 카드 클릭 → 에디터 화면에 그 프로젝트가 그려질 때까지(두 프레임 뒤)
//   edit   — text 노드 내용 변경(setNodeField) → 다음 태스크(setTimeout 0)까지 경과와 두 번째 rAF까지 경과, 10회 중앙값.
//            앞은 JS CPU 시간만이 아니고, 뒤는 화면 표시 완료를 보장하지 않는다. 편집이 실제로 적용됐는지 확인한다
//   undo   — undo() → 같은 두 값, 10회 중앙값(원래 값으로 돌아왔는지 확인한다)
//   export — 생성 코드 훑기·검증(scanGeneratedCode) + 자산 읽기 + ZIP 만들기(다운로드 클릭 제외)
// 자원: 단계마다 GC를 강제한 뒤의 JS 힙 사용량·DOM 노드 수(Performance.getMetrics).

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { writeWorkspace } from "./fixtures.mjs";
import { collectChromeRss, formatRss, summarizeRss } from "./rss.mjs";

// DevTools 연결에 Node 내장 WebSocket을 쓴다. Node 22부터는 기본으로 있고, 이 저장소가 지원하는 Node 20은
// `--experimental-websocket`이 있어야 한다 — 없으면 그 플래그를 붙여 이 스크립트를 한 번 다시 실행한다(PR #313 리뷰).
if (typeof WebSocket === "undefined") {
  if (process.execArgv.includes("--experimental-websocket")) {
    console.error("이 Node에는 WebSocket이 없습니다. Node 22 이상, 또는 Node 20.10 이상에서 실행하세요.");
    process.exit(1);
  }
  const rerun = spawnSync(process.execPath, [...process.execArgv, "--experimental-websocket", ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(rerun.status ?? 1);
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SCENARIOS = {
  S1: { projects: 10, nodes: 100, label: "프로젝트 10 · 노드 100" },
  S2: { projects: 100, nodes: 100, label: "프로젝트 100 · 노드 100" },
  S3: { projects: 10, nodes: 1000, label: "프로젝트 10 · 노드 1000" },
  S4: { projects: 100, nodes: 1000, label: "프로젝트 100 · 노드 1000" },
  S5: { projects: 10, nodes: 100, image: { width: 2400, height: 1600 }, label: "프로젝트 10 · 노드 100 · 큰 이미지(11.5MB PNG)" },
  // 프로젝트마다 다른 이미지 — 디코딩·비트맵이 공유되지 않는다(#318).
  S6: { projects: 10, nodes: 100, image: { width: 2400, height: 1600, distinct: true }, label: "프로젝트 10 · 노드 100 · 프로젝트마다 다른 큰 이미지(11.5MB PNG × 10)" },
  // 홈이 그리는 카드(화면에 보이는 것과 그 아래 근처)보다 많은 프로젝트가 각자 다른 이미지를 쓴다(#318).
  S7: { projects: 50, nodes: 100, image: { width: 2400, height: 1600, distinct: true }, label: "프로젝트 50 · 노드 100 · 프로젝트마다 다른 큰 이미지(11.5MB PNG × 50)" },
  // 한 페이지에 서로 다른 큰 이미지 5장 — 열었을 때 캔버스(#318).
  S8: { projects: 1, nodes: 100, image: { width: 2400, height: 1600, distinct: true, perPage: 5 }, label: "프로젝트 1 · 노드 100 · 한 페이지에 다른 큰 이미지 5장" },
};

function parseArgs(argv) {
  const args = { reps: 5, scenarios: Object.keys(SCENARIOS), chrome: undefined, json: undefined, profile: false, input: false, nodeEnv: "production" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--reps") args.reps = Number(argv[++i]);
    else if (argv[i] === "--scenario") args.scenarios = argv[++i].split(",");
    else if (argv[i] === "--chrome") args.chrome = argv[++i];
    else if (argv[i] === "--json") args.json = argv[++i];
    else if (argv[i] === "--profile") args.profile = true;
    // 실제 입력 경로(속성 패널 타이핑·캔버스 드래그)의 프레임 누락·입력 지연도 잰다(#317).
    else if (argv[i] === "--input") args.input = true;
    // 개발 서버의 NODE_ENV. 생략하면 CLI와 같은 production이다(부모 셸의 NODE_ENV를 물려받지 않는다 — 실행과 기록이 어긋나지 않게).
    else if (argv[i] === "--node-env") args.nodeEnv = argv[++i];
  }
  if (!["development", "production"].includes(args.nodeEnv)) throw new Error(`--node-env는 development 또는 production이어야 합니다(받음: ${args.nodeEnv}).`);
  return args;
}

function findChrome(explicit) {
  const candidates = [explicit, process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"];
  const found = candidates.find((path) => path !== undefined && existsSync(path));
  if (found === undefined) throw new Error("Chrome을 찾지 못했습니다. --chrome 또는 CHROME_BIN으로 경로를 주세요.");
  return found;
}

/** DevTools 요청 하나의 최대 대기. 페이지 안 측정(열기 60초 제한 등)보다 넉넉하게. */
const CDP_TIMEOUT_MS = 180_000;
const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

/** 서로 다른 빈 포트 `count`개. 모두 잡아 둔 채 번호를 받은 뒤 함께 놓는다 — 둘이 겹치지 않게. */
async function freePorts(count) {
  const servers = await Promise.all(Array.from({ length: count }, () => new Promise((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => done(server));
  })));
  const ports = servers.map((server) => server.address().port);
  await Promise.all(servers.map((server) => new Promise((done) => server.close(done))));
  return ports;
}

async function waitHttp(url, timeoutMs = 60_000, failed = () => null) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const reason = failed();
    if (reason !== null) throw new Error(reason);
    try { const response = await fetch(url); if (response.ok) return response; } catch { /* 아직 */ }
    if (Date.now() > until) throw new Error(`응답 없음: ${url}`);
    await sleep(200);
  }
}

/** 최소 CDP 클라이언트 — 브라우저 웹소켓 하나에 flatten 세션. */
async function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  let nextId = 1;
  const pending = new Map();
  // 브라우저가 죽으면(메모리 부족 등) 기다리는 요청을 모두 실패시킨다 — 무한 대기 대신 정리로 간다.
  const failAll = (reason) => {
    for (const { fail } of pending.values()) fail(new Error(reason));
    pending.clear();
  };
  socket.onclose = () => failAll("DevTools 연결이 끊겼습니다(Chrome 종료)");
  socket.onerror = () => failAll("DevTools 연결 오류");
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined && pending.has(message.id)) {
      const { done, fail } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) fail(new Error(`${message.error.message} ${message.error.data ?? ""}`)); else done(message.result);
    }
  };
  const send = (method, params = {}, sessionId, timeoutMs = CDP_TIMEOUT_MS) => new Promise((done, fail) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); fail(new Error(`DevTools 응답 시간 초과: ${method}`)); }, timeoutMs);
    pending.set(id, { done: (value) => { clearTimeout(timer); done(value); }, fail: (error) => { clearTimeout(timer); fail(error); } });
    if (socket.readyState !== WebSocket.OPEN) { pending.get(id).fail(new Error("DevTools 연결이 닫혀 있습니다")); pending.delete(id); return; }
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  return { send, close: () => socket.close() };
}

async function evaluate(cdp, sessionId, expression, timeoutMs) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId, timeoutMs);
  if (result.exceptionDetails) throw new Error(`페이지 오류: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
  return result.result.value;
}

// 힙은 GC를 강제한 뒤 잰다 — 수거되지 않은 쓰레기까지 세면 누수처럼 보인다.
async function metrics(cdp, sessionId) {
  await cdp.send("HeapProfiler.collectGarbage", {}, sessionId);
  const { metrics: list } = await cdp.send("Performance.getMetrics", {}, sessionId);
  const pick = (name) => list.find((entry) => entry.name === name)?.value ?? null;
  return { heapMB: +(pick("JSHeapUsedSize") / 1024 / 1024).toFixed(1), domNodes: pick("Nodes") };
}

// 페이지 안에서 도는 측정 코드. 앱과 같은 모듈 URL을 동적 import하므로 같은 스토어 인스턴스를 쓴다.
// 이미지가 실제로 그려진 시각(#318). 이미지는 CSS 배경이라 로드·디코딩이 비동기다 — Element Timing은 배경
// 이미지에도 renderTime(화면에 그려진 시각)을 준다. 앱을 고치지 않고, 페이지가 뜨기 전에 배경 이미지가 있는
// 요소에 elementtiming 속성을 붙이는 감시를 심는다.
const ELEMENT_TIMING_SETUP = String.raw`
window.__vsbImages = [];
// 요소별 그려진 시각. 개수가 아니라 요소로 맞춘다 — 다시 마운트된 요소의 옛 항목을 세지 않게.
window.__vsbPainted = new WeakMap();
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    const renderTime = e.renderTime || e.loadTime;
    window.__vsbImages.push({ url: e.url, renderTime, width: e.naturalWidth });
    // 배경 이미지가 여럿이면 서로 다른 이미지마다 항목이 온다 — 늦은 시각과 받은 수를 둔다(#322).
    if (e.element) { const prev = window.__vsbPainted.get(e.element); window.__vsbPainted.set(e.element, { time: Math.max(prev?.time ?? 0, renderTime), count: (prev?.count ?? 0) + 1 }); }
  }
}).observe({ type: "element", buffered: true });
const mark = (el) => { if (el.nodeType === 1 && !el.hasAttribute("elementtiming") && /url\(/.test(el.style?.backgroundImage ?? "")) el.setAttribute("elementtiming", "vsb-image"); };
new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === "attributes") mark(r.target);
    for (const n of r.addedNodes ?? []) { mark(n); n.querySelectorAll?.("[style]").forEach(mark); }
  }
}).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
`;

// 화면에 보이는 카드의 미리보기가 모두 그려졌는가(#315부터 미리보기는 화면 근처에 들어온 카드만
// 그린다 — data-preview="pending"). 그 전 버전은 카드와 미리보기를 한 번에 그려 pending이 없다.
// 첫 화면이 찼는가: 카드가 모두 들어왔거나, 마지막 카드가 화면 아래 끝에 닿았다(#316 — 앞에서부터
// 묶음으로 그린다). 이전 버전은 카드를 한 번에 모두 그리므로 "모두 들어옴"과 같은 순간이다.
const firstScreenFilled = (projects) => `(() => { const cards = document.querySelectorAll('[aria-label$=" 이름 변경"]');
  if (cards.length >= ${projects}) return true; const last = cards[cards.length - 1];
  return last !== undefined && last.getBoundingClientRect().bottom >= innerHeight; })()`;

/** 타이핑 측정의 키 간격(ms). 16ms는 키를 누르고 있을 때의 자동 반복에 가깝다(사람의 빠른 타이핑은 80~150ms). */
const INPUT_KEY_INTERVAL_MS = Number(process.env.VSB_KEY_INTERVAL_MS ?? 16);

const VISIBLE_PREVIEWS_READY = `[...document.querySelectorAll('[data-preview="pending"]')].every((e) => {
  const r = e.getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight; })`;

const PAGE_HELPERS = String.raw`
window.__perf = {
  frame: () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  async open(target) {
    const nav = (await import("/src/features/editor/store/navigationStore.ts")).useNavigationStore;
    const editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    window.confirm = () => true;
    const card = [...document.querySelectorAll("button")].find((b) => !b.getAttribute("aria-label") && b.textContent.includes(target));
    if (!card) throw new Error("카드 없음: " + target);
    const t0 = performance.now();
    this.openStartedAt = t0;
    card.click();
    for (;;) {
      if (nav.getState().screen === "editor" && editor.getState().spec.name === target) break;
      await new Promise((done) => setTimeout(done, 5));
      if (performance.now() - t0 > 60000) throw new Error("열기 시간 초과");
    }
    await this.frame();
    return performance.now() - t0;
  },
  // 한 번 바꾸고 두 경과 구간을 잰다(PR #313 리뷰 — 이름은 잰 구간 그대로다):
  // (1) task: 호출부터 setTimeout(0) 콜백까지 — 동기 렌더·마이크로태스크와 그 사이 끼어든 다른 태스크를 포함한
  //     경과 시간이다. JS CPU 시간만이 아니다.
  // (2) frame: 호출부터 requestAnimationFrame 두 번째 콜백까지 — 화면 표시 완료를 보장하지 않으며 하한도 없다.
  async step(action) {
    const t0 = performance.now();
    action();
    await new Promise((done) => setTimeout(done, 0));
    const task = performance.now() - t0;
    await this.frame();
    return { task, frame: performance.now() - t0 };
  },
  // 실제 입력 경로 측정(#317). start로 프레임 간격·입력 이벤트 처리 시간 기록을 켜고, CDP가 키·마우스를
  // 보낸 뒤 stop으로 모은다.
  inputStart() {
    const record = { frames: [], events: [], running: true };
    const loop = (t) => { record.frames.push(t); if (record.running) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    record.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) record.events.push({ name: entry.name, duration: entry.duration });
    });
    record.observer.observe({ type: "event", durationThreshold: 16, buffered: false });
    this.record = record;
    return true;
  },
  inputStop() {
    const record = this.record;
    record.running = false;
    // 아직 전달되지 않은 항목(마지막 그리기 뒤의 입력 — 드래그에서는 떼기)도 챙긴다.
    for (const entry of record.observer.takeRecords()) record.events.push({ name: entry.name, duration: entry.duration });
    record.observer.disconnect();
    const gaps = record.frames.slice(1).map((t, i) => t - record.frames[i]);
    const sorted = [...gaps].sort((a, b) => a - b);
    const durations = record.events.map((e) => e.duration).sort((a, b) => a - b);
    return {
      frames: record.frames.length,
      // 놓친 vsync 수(60Hz): 간격이 16.7ms의 몇 배인지에서 1을 뺀다(33ms 간격 = 1, 50ms = 2).
      missed: gaps.reduce((sum, g) => sum + Math.max(0, Math.round(g / (1000 / 60)) - 1), 0),
      gapP95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      gapMax: sorted[sorted.length - 1] ?? 0,
      // Event Timing: 처리+화면 반영까지 16ms를 넘은 입력 이벤트(키·마우스)
      slowEvents: durations.length,
      eventP95: durations[Math.floor(durations.length * 0.95)] ?? 0,
      eventMax: durations[durations.length - 1] ?? 0,
    };
  },
  async selectAndFocus(id) {
    const editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    editor.getState().select(id);
    await this.frame();
    const field = [...document.querySelectorAll("textarea, input")].find((el) => el.value === editor.getState().spec.pages[editor.getState().activePageId].nodes[id].content);
    if (!field) throw new Error("텍스트 칸 없음");
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
    return true;
  },
  dragPoints(fromId, toId) {
    const find = (id) => document.querySelector('[data-node-id="' + id + '"]');
    const a = find(fromId), b = find(toId);
    if (!a || !b) throw new Error("드래그 대상 없음");
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return { from: { x: ra.left + ra.width / 2, y: ra.top + ra.height / 2 }, to: { x: rb.left + rb.width / 2, y: rb.top + rb.height / 2 + 4 } };
  },
  async editAndUndo(times) {
    const editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    const content = () => { const s = editor.getState(); return s.spec.pages[s.activePageId].nodes.t0?.content; };
    const original = content();
    if (original === undefined) throw new Error("편집 대상 t0이 없습니다");
    const edits = [], undos = [];
    for (let i = 0; i < times; i += 1) {
      edits.push(await this.step(() => editor.getState().setNodeField("t0", "content", "측정 " + i)));
      // 편집·Undo가 실제로 적용됐는지 확인한다 — 아니면 아무 일도 안 한 시간을 잰 셈이다(PR #313 리뷰).
      if (content() !== "측정 " + i) throw new Error("편집이 적용되지 않았습니다");
      undos.push(await this.step(() => editor.getState().undo()));
      if (content() !== original) throw new Error("Undo가 적용되지 않았습니다");
    }
    return { edits, undos };
  },
  async prepareExport(withImage) {
    const { scanGeneratedCode } = await import("/src/features/editor/ui/exportGeneratedCode.ts");
    const { writeWorkspaceFile } = await import("/src/features/editor/ui/workspaceClient.ts");
    const editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    const { spec, activePageId } = editor.getState();
    const scan = await scanGeneratedCode(spec.pages[activePageId]);
    // 페이지 파일은 이 페이지의 이미지 노드가 가리키는 실제 파일을 import한다(S6는 프로젝트마다 다르다).
    // 페이지의 이미지 노드를 모두 import한다(S8은 한 페이지에 5장).
    const assets = withImage ? Object.values(spec.pages[activePageId].nodes).filter((n) => n.type === "image").map((n) => n.src.split("/").pop()) : [];
    for (const entry of scan.report.coverage) {
      const isPage = entry.expectedPath.startsWith("pages/");
      const body = (isPage ? assets.map((name, k) => 'import image' + k + ' from "../assets/' + name + '";\n').join("") : "")
        + "export " + (isPage ? "default " : "") + "function " + entry.componentName + "() {\n  return null;\n}\n";
      await writeWorkspaceFile("generated/" + entry.expectedPath, body, "text/plain");
    }
    return scan.report.coverage.length;
  },
  async exportZip() {
    const { scanGeneratedCode } = await import("/src/features/editor/ui/exportGeneratedCode.ts");
    const { buildBundleEntries } = await import("/src/features/editor/export/bundle.ts");
    const { createZip } = await import("/src/features/editor/export/zip.ts");
    const { readWorkspaceBinaryFile } = await import("/src/features/editor/ui/workspaceClient.ts");
    const editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    const { spec, activePageId } = editor.getState();
    const t0 = performance.now();
    const scan = await scanGeneratedCode(spec.pages[activePageId]);
    const assets = [];
    for (const name of scan.report.usedAssets) {
      const bytes = await readWorkspaceBinaryFile("assets/" + name);
      if (bytes !== null) assets.push({ name, bytes });
    }
    const zip = createZip(buildBundleEntries({ projectName: spec.name, files: scan.files, assets, report: scan.report }));
    return { ms: performance.now() - t0, files: scan.files.length, assets: assets.length, zipBytes: zip.length };
  },
};
true;
`;

const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
const round = (value) => Math.round(value * 10) / 10;

/** CPU 프로파일에서 자기 시간(self time)이 큰 함수를 모은다. 파일은 저장소 기준 경로로 줄인다. */
function topSelfTime(profile, limit = 15) {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const self = new Map();
  const deltas = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i += 1) {
    const node = byId.get(profile.samples[i]);
    const { functionName, url, lineNumber } = node.callFrame;
    const file = url.replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "");
    const name = `${functionName || "(anonymous)"} ${file}:${lineNumber + 1}`;
    self.set(name, (self.get(name) ?? 0) + (deltas[i] ?? 0) / 1000);
  }
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([name, ms]) => ({ name, ms: round(ms), share: round((ms / total) * 100) }));
}

async function runScenario(key, scenario, { reps, chrome, profile, nodeEnv, input }) {
  const dir = mkdtempSync(join(tmpdir(), `vsb-perf-${key}-`));
  const { workspace, target, imageBytes } = writeWorkspace(dir, scenario);
  const [port, debugPort] = await freePorts(2);
  const vite = spawn(process.execPath, [join(REPO, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    cwd: REPO, env: { ...process.env, VISUAL_SPEC_WORKSPACE: workspace, NODE_ENV: nodeEnv }, stdio: "ignore",
  });
  let viteExit = null;
  vite.once("exit", (code, signal) => { viteExit = `개발 서버가 종료됐습니다(code ${code}, signal ${signal})`; });
  const chromeProfile = mkdtempSync(join(tmpdir(), "vsb-perf-chrome-"));
  const browser = spawn(chrome, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${chromeProfile}`,
    "--no-first-run", "--no-default-browser-check", "--window-size=1600,1000", "about:blank"], { stdio: "ignore" });
  const results = [];
  const profiles = {};
  let retries = 0;
  try {
    const base = `http://127.0.0.1:${port}`;
    await waitHttp(`${base}/__vs/status`, 60_000, () => viteExit);
    await waitHttp(`${base}/`, 60_000, () => viteExit); // 첫 요청의 의존성 최적화(pre-bundle)를 측정 밖으로 뺀다
    const { webSocketDebuggerUrl, Browser: browserVersion } = await (await waitHttp(`http://127.0.0.1:${debugPort}/json/version`)).json();
    versions.browser = browserVersion;
    const cdp = await connectCdp(webSocketDebuggerUrl);
    // 워밍업 1회(개발 서버의 모듈 변환 캐시를 채운다) + 측정 reps회
    // 프로파일은 측정 반복 뒤 따로 한 번 더 돌린다 — 샘플링이 켜진 시간을 결과에 섞지 않는다.
    const profileRep = profile ? reps : null;
    // 반복 하나. 개발 서버가 의존성을 다시 최적화하며 페이지를 새로 고치면(실행 중 "target navigated")
    // 그 반복만 버리고 다시 잰다 — 측정 대상이 아니라 첫 기동의 부수 효과다. 다시 잰 횟수는 결과에 남긴다.
    const opened = { contextId: null };
    const measureRep = async (rep) => {
      const { browserContextId } = await cdp.send("Target.createBrowserContext");
      opened.contextId = browserContextId;
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      // 개발 서버가 측정 도중 페이지를 새로 고쳤는가. 어느 단계에서든 새로 고쳐졌으면 이 반복은 버린다.
      const reloaded = async () => (await evaluate(cdp, sessionId,
        `performance.getEntriesByType("navigation")[0]?.type ?? null`).catch(() => null)) === "reload";
      const step = async (expression) => {
        try { return await evaluate(cdp, sessionId, expression); }
        catch (error) {
          if (await reloaded()) throw new Error(`page navigated or closed (개발 서버 재로드): ${error.message}`);
          throw error;
        }
      };
      await cdp.send("Performance.enable", {}, sessionId);
      await cdp.send("HeapProfiler.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      await cdp.send("Page.enable", {}, sessionId);
      if (scenario.image !== undefined) await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: ELEMENT_TIMING_SETUP }, sessionId);
      if (rep === profileRep) {
        await cdp.send("Profiler.enable", {}, sessionId);
        await cdp.send("Profiler.setSamplingInterval", { interval: 100 }, sessionId);
        await cdp.send("Profiler.start", {}, sessionId);
      }
      await cdp.send("Page.navigate", { url: `${base}/` }, sessionId);
      let homeMs = null;
      const until = Date.now() + 120_000;
      while (homeMs === null) {
        const seen = await evaluate(cdp, sessionId,
          `${firstScreenFilled(scenario.projects)}
            && ${VISIBLE_PREVIEWS_READY}
            ? { t: performance.now(), nav: performance.getEntriesByType("navigation")[0]?.type ?? null } : null`,
          Math.max(1000, until - Date.now()))
          // 페이지를 바꾸는 중의 평가 실패(실행 컨텍스트 교체 등)만 넘긴다. 연결 끊김·시간 초과는 그대로 실패시킨다.
          .catch((error) => { if (error.message.startsWith("DevTools")) throw error; return null; });
        // 기다리는 사이 개발 서버가 페이지를 새로 고쳤으면(의존성 재최적화) performance.now()가 0부터 다시
        // 시작해 홈 시간이 짧게 잡힌다 — 이 반복은 버리고 다시 잰다.
        if (seen !== null && seen.nav === "reload") throw new Error("page navigated or closed (개발 서버 재로드)");
        homeMs = seen?.t ?? null;
        if (homeMs === null) { if (Date.now() > until) throw new Error("홈 시간 초과"); await sleep(10); }
      }
      // 전체: 카드가 모두 들어오고 뒤를 마저 읽는 표시가 사라질 때까지(#316). 이전 버전은 첫 화면과 같은 순간이다.
      let homeAllMs = null;
      while (homeAllMs === null) {
        homeAllMs = await step(`document.querySelectorAll('[aria-label$=" 이름 변경"]').length >= ${scenario.projects}
          && document.querySelector("[data-loading]") === null ? performance.now() : null`);
        if (homeAllMs === null) { if (Date.now() > until) throw new Error("홈 전체 시간 초과"); await sleep(10); }
      }
      if (rep === profileRep) {
        const { profile: cpu } = await cdp.send("Profiler.stop", {}, sessionId);
        profiles.home = topSelfTime(cpu);
        process.stderr.write(`  홈 첫 진입 CPU 자기 시간 상위:\n${profiles.home.map((row) => `    ${row.ms}ms ${row.share}% ${row.name}`).join("\n")}\n`);
      }
      const homeRes = await metrics(cdp, sessionId);
      // 홈: 화면에 보이는 미리보기 이미지가 모두 그려질 때까지(그려진 이미지 수가 보이는 이미지 요소 수에 닿으면).
      let homeImages = null;
      if (scenario.image !== undefined) {
        const imageWait = Date.now() + 30_000;
        while (homeImages === null) {
          homeImages = await step(`(() => {
            // 화면 안이고, 카드 미리보기 영역(overflow hidden)에 잘려 나가지 않은 이미지만 — 잘린 것은 그려지지 않는다.
            // 이미지 자리는 data-preview-image로 센다(#322) — 축소본이 준비되기 전에는 배경 이미지가 없어 아직
            // elementtiming이 붙지 않은 요소도 기다려야 한다. 그 표시가 없는 이전 빌드는 처음부터 원본 URL이 붙으므로
            // 배경 이미지가 있는 요소(elementtiming)로 센다.
            const marked = document.querySelector('[data-preview] [data-preview-image]') !== null;
            const visible = [...document.querySelectorAll(marked ? '[data-preview] [data-preview-image]' : '[data-preview] [elementtiming="vsb-image"]')].filter((el) => {
              const r = el.getBoundingClientRect(); const c = el.closest("[data-preview]").getBoundingClientRect();
              const top = Math.max(r.top, c.top), bottom = Math.min(r.bottom, c.bottom);
              return r.width > 0 && bottom > top && bottom > 0 && top < innerHeight; });
            // 표시의 값은 그 요소의 서로 다른 이미지 수다 — 다 그려져야 그려진 것으로 친다.
            const times = visible.map((el) => { const p = window.__vsbPainted.get(el); return p !== undefined && p.count >= (Number(el.dataset.previewImage) || 1) ? p.time : undefined; });
            return visible.length > 0 && times.every((t) => t !== undefined) ? { ms: Math.max(...times), count: visible.length } : null; })()`);
          if (homeImages === null) { if (Date.now() > imageWait) throw new Error("홈 이미지 표시 시간 초과"); await sleep(20); }
        }
      }
      // 브라우저 전체 메모리(RSS) — 이미지가 있으면 보이는 이미지가 그려진 뒤.
      const homeRssCollection = collectChromeRss(browser.pid);
      const homeRssMB = homeRssCollection.valueMB;
      await step(PAGE_HELPERS);
      const openMs = await step(`window.__perf.open(${JSON.stringify(target)})`);
      const openRes = await metrics(cdp, sessionId);
      // 열기: 에디터 캔버스의 이미지가 그려질 때까지(카드 클릭 시각 기준).
      let openImages = null;
      if (scenario.image !== undefined) {
        const imageWait = Date.now() + 30_000;
        while (openImages === null) {
          // 캔버스(노드 요소)의 이미지가 모두 그려질 때까지 — 홈 미리보기의 늦은 이미지는 세지 않는다.
          openImages = await step(`(() => { const start = window.__perf.openStartedAt;
            const canvas = [...document.querySelectorAll('[data-node-id][elementtiming="vsb-image"]')];
            const times = canvas.map((el) => window.__vsbPainted.get(el)?.time);
            return canvas.length > 0 && times.every((t) => t !== undefined && t > start)
              ? { ms: Math.max(...times) - start, count: canvas.length } : null; })()`);
          if (openImages === null) { if (Date.now() > imageWait) throw new Error("열기 이미지 표시 시간 초과"); await sleep(20); }
        }
      }
      const openRssCollection = collectChromeRss(browser.pid);
      const openRssMB = openRssCollection.valueMB;
      if (rep === profileRep) {
        await cdp.send("Profiler.enable", {}, sessionId);
        await cdp.send("Profiler.setSamplingInterval", { interval: 100 }, sessionId);
        await cdp.send("Profiler.start", {}, sessionId);
      }
      const { edits, undos } = await step("window.__perf.editAndUndo(10)");
      if (rep === profileRep) {
        const { profile: cpu } = await cdp.send("Profiler.stop", {}, sessionId);
        profiles.editUndo = topSelfTime(cpu);
        process.stderr.write(`  편집·Undo 10회 CPU 자기 시간 상위:\n${profiles.editUndo.map((row) => `    ${row.ms}ms ${row.share}% ${row.name}`).join("\n")}\n`);
      }
      let typing = null;
      let drag = null;
      if (input && rep !== profileRep) {
        // 타이핑: 속성 패널 "텍스트" 칸에 30자를 Input.insertText로 넣는다 — 텍스트 삽입(beforeinput/input)이며
        // keydown·IME 조합은 거치지 않는다. 한 글자 처리가 끝나야 다음을 보내므로 실제 간격은 처리 시간 + INPUT_KEY_INTERVAL_MS.
        await step(`window.__perf.selectAndFocus("t0")`);
        await step("window.__perf.inputStart()");
        for (const char of "가나다라마바사아자차카타파하abcdefghijklmnop") {
          await cdp.send("Input.insertText", { text: char }, sessionId);
          await sleep(INPUT_KEY_INTERVAL_MS);
        }
        await sleep(200);
        typing = await step("window.__perf.inputStop()");
        // 텍스트가 실제로 들어갔는가 — 칸을 잘못 잡았으면 빈 시간을 잰 셈이다.
        typing.applied = await step(`(async () => { const e = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore.getState();
          return e.spec.pages[e.activePageId].nodes.t0.content.length >= 30; })()`);
        await step(`(async () => { const e = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore.getState();
          while (e.history?.past?.length ?? 0) { (await import("/src/features/editor/store/editorStore.ts")).useEditorStore.getState().undo(); if (!(await import("/src/features/editor/store/editorStore.ts")).useEditorStore.getState().history.past.length) break; } return true; })()`);
        // 드래그: 캔버스의 카드 c1을 c3 위치로 20단계에 걸쳐 끈다(같은 섹션 안 순서 바꾸기).
        const { from, to } = await step(`window.__perf.dragPoints("c1", "c3")`);
        // 끌 대상은 클릭과 같은 규칙으로 정해진다 — 카드를 먼저 선택해 두어야 바깥 섹션이 아니라 카드가 잡힌다.
        await step(`(async () => { const e = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
          e.getState().select("c1"); await window.__perf.frame(); window.__perf.specBeforeDrag = e.getState().spec; return true; })()`);
        await step("window.__perf.inputStart()");
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", buttons: 1, clickCount: 1 }, sessionId);
        for (let i = 1; i <= 20; i += 1) {
          const x = from.x + ((to.x - from.x) * i) / 20, y = from.y + ((to.y - from.y) * i) / 20;
          await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left", buttons: 1 }, sessionId);
          await sleep(16);
        }
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", buttons: 0, clickCount: 1 }, sessionId);
        await sleep(200);
        drag = await step("window.__perf.inputStop()");
        // 드래그가 실제로 노드를 옮겼는가(순서 바꿈은 Undo 한 단계) — 옮기지 않았으면 측정이 무효다.
        drag.moved = await step(`(async () => (await import("/src/features/editor/store/editorStore.ts")).useEditorStore.getState().spec
          !== window.__perf.specBeforeDrag)()`);
      }
      if (rep === -1) await step(`window.__perf.prepareExport(${scenario.image !== undefined})`);
      const exported = await step("window.__perf.exportZip()");
      const endRes = await metrics(cdp, sessionId);
      // 단계 사이(평가와 평가 사이)에 새로 고쳐져 오류 없이 지나간 경우도 결과에 넣지 않는다.
      if (await reloaded()) throw new Error("page navigated or closed (개발 서버 재로드)");
      await cdp.send("Target.closeTarget", { targetId });
      await cdp.send("Target.disposeBrowserContext", { browserContextId });
      opened.contextId = null;
      if (rep >= 0 && rep !== profileRep) {
        results.push({ homeImages, openImages, homeRssMB, openRssMB, homeRssCollection, openRssCollection, typing, drag, homeMs, homeAllMs, openMs, editMs: median(edits.map((e) => e.task)), editFrameMs: median(edits.map((e) => e.frame)),
          undoMs: median(undos.map((e) => e.task)), undoFrameMs: median(undos.map((e) => e.frame)), exportMs: exported.ms,
          zipBytes: exported.zipBytes, files: exported.files, homeRes, openRes, endRes });
      }
        };
    for (let rep = -1; rep < reps + (profile ? 1 : 0); rep += 1) {
      try {
        await measureRep(rep);
      } catch (error) {
        const transient = /navigated or closed|Execution context was destroyed|Cannot find context/.test(error.message);
        if (opened.contextId !== null) {
          await cdp.send("Target.disposeBrowserContext", { browserContextId: opened.contextId }).catch(() => undefined);
          opened.contextId = null;
        }
        if (!transient || retries >= 3) throw error;
        retries += 1;
        process.stderr.write(`  반복 ${rep}에서 페이지가 새로 고쳐져 다시 잽니다(${retries}회): ${error.message.trim()}\n`);
        rep -= 1;
      }
    }
    cdp.close();
  } finally {
    browser.kill("SIGKILL");
    vite.kill("SIGKILL");
    await sleep(300);
    rmSync(chromeProfile, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
  const summary = (pick) => ({ median: round(median(results.map(pick))), max: round(Math.max(...results.map(pick))) });
  return {
    key, label: scenario.label, reps, imageBytes, nodeEnv, retries,
    ...(profile ? { profiles } : {}),
    home: summary((r) => r.homeMs), homeAll: summary((r) => r.homeAllMs), open: summary((r) => r.openMs), edit: summary((r) => r.editMs),
    undo: summary((r) => r.undoMs), editFrame: summary((r) => r.editFrameMs), undoFrame: summary((r) => r.undoFrameMs),
    ...(input ? {
      typing: Object.fromEntries(["missed", "gapP95", "gapMax", "slowEvents", "eventP95", "eventMax"].map((k) => [k, summary((r) => r.typing[k])])),
      drag: Object.fromEntries(["missed", "gapP95", "gapMax", "slowEvents", "eventP95", "eventMax"].map((k) => [k, summary((r) => r.drag[k])])),
      dragMoved: results.every((r) => r.drag.moved),
      typingApplied: results.every((r) => r.typing.applied),
    } : {}),
    export: summary((r) => r.exportMs),
    zipKB: Math.round(results[0].zipBytes / 1024), generatedFiles: results[0].files,
    rssMB: { home: summarizeRss(results.map((r) => r.homeRssCollection)), open: summarizeRss(results.map((r) => r.openRssCollection)) },
    ...(scenario.image !== undefined ? {
      homeImagesMs: summary((r) => r.homeImages.ms), homeImagesCount: summary((r) => r.homeImages.count),
      openImagesMs: summary((r) => r.openImages.ms),
    } : {}),
    heapMB: { home: summary((r) => r.homeRes.heapMB), open: summary((r) => r.openRes.heapMB), end: summary((r) => r.endRes.heapMB) },
    domNodes: { home: summary((r) => r.homeRes.domNodes), open: summary((r) => r.openRes.domNodes) },
    raw: results,
  };
}

const versions = { browser: null };
const args = parseArgs(process.argv.slice(2));
if (!Number.isInteger(args.reps) || args.reps < 1) throw new Error("--reps는 1 이상의 정수여야 합니다.");
const chrome = findChrome(args.chrome);
const out = [];
for (const key of args.scenarios) {
  const scenario = SCENARIOS[key];
  if (scenario === undefined) throw new Error(`알 수 없는 시나리오: ${key}`);
  process.stderr.write(`${key} ${scenario.label} — ${args.reps}회…\n`);
  const result = await runScenario(key, scenario, { reps: args.reps, chrome, profile: args.profile, nodeEnv: args.nodeEnv, input: args.input });
  out.push(result);
  const f = (s) => `${s.median} (최대 ${s.max})`;
  console.log(`| ${key} ${result.label} | ${f(result.home)} / 전체 ${result.homeAll.median} | ${f(result.open)} | ${f(result.edit)} / ${result.editFrame.median} | ${f(result.undo)} / ${result.undoFrame.median} | ${f(result.export)} | ${result.heapMB.home.median} / ${result.heapMB.open.median} / ${result.heapMB.end.median} | ${result.domNodes.home.median} / ${result.domNodes.open.median} |`);
}
for (const result of out) {
  console.log(`  ${result.key} 브라우저 RSS: 홈 ${formatRss(result.rssMB.home)} · 열기 뒤 ${formatRss(result.rssMB.open)}${result.homeImagesMs
    ? ` · 이미지 그려짐: 홈 ${result.homeImagesMs.median}ms(보이는 ${result.homeImagesCount.median}장) · 열기 ${result.openImagesMs.median}ms` : ""}`);
  if (result.typing) {
    const g = (o) => `놓친 프레임 ${o.missed.median}·간격 p95 ${o.gapP95.median}·최대 ${o.gapMax.median}ms·느린 입력 ${o.slowEvents.median}건(p95 ${o.eventP95.median}·최대 ${o.eventMax.median}ms)`;
    console.log(`  ${result.key} 텍스트 삽입 30자: ${g(result.typing)} · 들어갔는가 ${result.typingApplied}`);
    console.log(`  ${result.key} 드래그 20단계: ${g(result.drag)} · 노드가 옮겨졌는가 ${result.dragMoved}`);
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify({ when: new Date().toISOString(), node: process.version, chrome, browser: versions.browser, results: out }, null, 2));

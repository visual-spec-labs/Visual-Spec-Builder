#!/usr/bin/env node
// 프로젝트·노드·이미지 규모별 성능 실측(#293).
//
//   node scripts/perf/measure.mjs [--reps 5] [--scenario S1,S2] [--chrome <path>] [--json out.json]
//                                 [--node-env production] [--profile]
//   --node-env production  비교 실험: 개발 서버를 NODE_ENV=production으로 띄워 React production 빌드를 쓴다.
//   --profile              측정 반복 뒤 별도 반복 하나에서 홈 진입·편집 구간 CPU 자기 시간 상위를 뽑는다
//                          (결과 중앙값에는 섞지 않는다. --json이면 함께 저장한다).
//
// 사용자가 실제로 쓰는 방식 그대로 Vite 개발 서버(GUI)를 픽스처 작업공간으로 띄우고, 헤드리스
// Chrome을 DevTools 프로토콜(Node 내장 WebSocket)로 몬다. 외부 패키지를 쓰지 않는다.
// 반복마다 새 브라우저 컨텍스트(저장소·캐시 분리)에서 잰다.
//
// 재는 것(모두 페이지의 performance.now 기준, ms):
//   home   — 내비게이션 시작 → 홈 카드가 모두 그려질 때까지
//   open   — 카드 클릭 → 에디터 화면에 그 프로젝트가 그려질 때까지(두 프레임 뒤)
//   edit   — text 노드 내용 변경(setNodeField) → 다음 태스크까지(JS 작업)와 두 프레임 뒤까지(화면 반영), 10회 중앙값
//   undo   — undo() → 같은 두 값, 10회 중앙값
//   export — 생성 코드 훑기·검증(scanGeneratedCode) + 자산 읽기 + ZIP 만들기(다운로드 클릭 제외)
// 자원: 단계마다 GC를 강제한 뒤의 JS 힙 사용량·DOM 노드 수(Performance.getMetrics).

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { writeWorkspace } from "./fixtures.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SCENARIOS = {
  S1: { projects: 10, nodes: 100, label: "프로젝트 10 · 노드 100" },
  S2: { projects: 100, nodes: 100, label: "프로젝트 100 · 노드 100" },
  S3: { projects: 10, nodes: 1000, label: "프로젝트 10 · 노드 1000" },
  S4: { projects: 100, nodes: 1000, label: "프로젝트 100 · 노드 1000" },
  S5: { projects: 10, nodes: 100, image: { width: 2400, height: 1600 }, label: "프로젝트 10 · 노드 100 · 큰 이미지(11.5MB PNG)" },
};

function parseArgs(argv) {
  const args = { reps: 5, scenarios: Object.keys(SCENARIOS), chrome: undefined, json: undefined, profile: false, nodeEnv: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--reps") args.reps = Number(argv[++i]);
    else if (argv[i] === "--scenario") args.scenarios = argv[++i].split(",");
    else if (argv[i] === "--chrome") args.chrome = argv[++i];
    else if (argv[i] === "--json") args.json = argv[++i];
    else if (argv[i] === "--profile") args.profile = true;
    // 비교 실험: 개발 서버를 NODE_ENV=production으로 띄워 React production 빌드를 쓰게 한다.
    else if (argv[i] === "--node-env") args.nodeEnv = argv[++i];
  }
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
    card.click();
    for (;;) {
      if (nav.getState().screen === "editor" && editor.getState().spec.name === target) break;
      await new Promise((done) => setTimeout(done, 5));
      if (performance.now() - t0 > 60000) throw new Error("열기 시간 초과");
    }
    await this.frame();
    return performance.now() - t0;
  },
  // 한 번 바꾸고 (1) 다음 태스크까지 = 동기 렌더·마이크로태스크를 포함한 JS 작업 시간,
  // (2) 두 프레임 뒤까지 = 화면 반영 시간(60Hz에서 하한 약 33ms)을 함께 잰다.
  async step(action) {
    const t0 = performance.now();
    action();
    await new Promise((done) => setTimeout(done, 0));
    const task = performance.now() - t0;
    await this.frame();
    return { task, frame: performance.now() - t0 };
  },
  async editAndUndo(times) {
    const editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    const edits = [], undos = [];
    for (let i = 0; i < times; i += 1) {
      edits.push(await this.step(() => editor.getState().setNodeField("t0", "content", "측정 " + i)));
      undos.push(await this.step(() => editor.getState().undo()));
    }
    return { edits, undos };
  },
  async prepareExport(withImage) {
    const { scanGeneratedCode } = await import("/src/features/editor/ui/exportGeneratedCode.ts");
    const { writeWorkspaceFile } = await import("/src/features/editor/ui/workspaceClient.ts");
    const editor = (await import("/src/features/editor/store/editorStore.ts")).useEditorStore;
    const { spec, activePageId } = editor.getState();
    const scan = await scanGeneratedCode(spec.pages[activePageId]);
    for (const entry of scan.report.coverage) {
      const isPage = entry.expectedPath.startsWith("pages/");
      const body = (withImage && isPage ? 'import heroImageUrl from "../assets/big.png";\n' : "")
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

async function runScenario(key, scenario, { reps, chrome, profile, nodeEnv }) {
  const dir = mkdtempSync(join(tmpdir(), `vsb-perf-${key}-`));
  const { workspace, target, imageBytes } = writeWorkspace(dir, scenario);
  const [port, debugPort] = await freePorts(2);
  const vite = spawn(process.execPath, [join(REPO, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    cwd: REPO, env: { ...process.env, VISUAL_SPEC_WORKSPACE: workspace, ...(nodeEnv ? { NODE_ENV: nodeEnv } : {}) }, stdio: "ignore",
  });
  let viteExit = null;
  vite.once("exit", (code, signal) => { viteExit = `개발 서버가 종료됐습니다(code ${code}, signal ${signal})`; });
  const chromeProfile = mkdtempSync(join(tmpdir(), "vsb-perf-chrome-"));
  const browser = spawn(chrome, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${chromeProfile}`,
    "--no-first-run", "--no-default-browser-check", "--window-size=1600,1000", "about:blank"], { stdio: "ignore" });
  const results = [];
  const profiles = {};
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
    for (let rep = -1; rep < reps + (profile ? 1 : 0); rep += 1) {
      const { browserContextId } = await cdp.send("Target.createBrowserContext");
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Performance.enable", {}, sessionId);
      await cdp.send("HeapProfiler.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      await cdp.send("Page.enable", {}, sessionId);
      if (rep === profileRep) {
        await cdp.send("Profiler.enable", {}, sessionId);
        await cdp.send("Profiler.setSamplingInterval", { interval: 100 }, sessionId);
        await cdp.send("Profiler.start", {}, sessionId);
      }
      await cdp.send("Page.navigate", { url: `${base}/` }, sessionId);
      let homeMs = null;
      const until = Date.now() + 120_000;
      while (homeMs === null) {
        homeMs = await evaluate(cdp, sessionId,
          `document.querySelectorAll('[aria-label$=" 이름 변경"]').length >= ${scenario.projects} ? performance.now() : null`,
          Math.max(1000, until - Date.now()))
          // 페이지를 바꾸는 중의 평가 실패(실행 컨텍스트 교체 등)만 넘긴다. 연결 끊김·시간 초과는 그대로 실패시킨다.
          .catch((error) => { if (error.message.startsWith("DevTools")) throw error; return null; });
        if (homeMs === null) { if (Date.now() > until) throw new Error("홈 시간 초과"); await sleep(10); }
      }
      if (rep === profileRep) {
        const { profile: cpu } = await cdp.send("Profiler.stop", {}, sessionId);
        profiles.home = topSelfTime(cpu);
        process.stderr.write(`  홈 첫 진입 CPU 자기 시간 상위:\n${profiles.home.map((row) => `    ${row.ms}ms ${row.share}% ${row.name}`).join("\n")}\n`);
      }
      const homeRes = await metrics(cdp, sessionId);
      await evaluate(cdp, sessionId, PAGE_HELPERS);
      const openMs = await evaluate(cdp, sessionId, `window.__perf.open(${JSON.stringify(target)})`);
      const openRes = await metrics(cdp, sessionId);
      if (rep === profileRep) {
        await cdp.send("Profiler.enable", {}, sessionId);
        await cdp.send("Profiler.setSamplingInterval", { interval: 100 }, sessionId);
        await cdp.send("Profiler.start", {}, sessionId);
      }
      const { edits, undos } = await evaluate(cdp, sessionId, "window.__perf.editAndUndo(10)");
      if (rep === profileRep) {
        const { profile: cpu } = await cdp.send("Profiler.stop", {}, sessionId);
        profiles.editUndo = topSelfTime(cpu);
        process.stderr.write(`  편집·Undo 10회 CPU 자기 시간 상위:\n${profiles.editUndo.map((row) => `    ${row.ms}ms ${row.share}% ${row.name}`).join("\n")}\n`);
      }
      if (rep === -1) await evaluate(cdp, sessionId, `window.__perf.prepareExport(${scenario.image !== undefined})`);
      const exported = await evaluate(cdp, sessionId, "window.__perf.exportZip()");
      const endRes = await metrics(cdp, sessionId);
      await cdp.send("Target.closeTarget", { targetId });
      await cdp.send("Target.disposeBrowserContext", { browserContextId });
      if (rep >= 0 && rep !== profileRep) {
        results.push({ homeMs, openMs, editMs: median(edits.map((e) => e.task)), editFrameMs: median(edits.map((e) => e.frame)),
          undoMs: median(undos.map((e) => e.task)), undoFrameMs: median(undos.map((e) => e.frame)), exportMs: exported.ms,
          zipBytes: exported.zipBytes, files: exported.files, homeRes, openRes, endRes });
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
    key, label: scenario.label, reps, imageBytes, nodeEnv: nodeEnv ?? "development",
    ...(profile ? { profiles } : {}),
    home: summary((r) => r.homeMs), open: summary((r) => r.openMs), edit: summary((r) => r.editMs),
    undo: summary((r) => r.undoMs), editFrame: summary((r) => r.editFrameMs), undoFrame: summary((r) => r.undoFrameMs),
    export: summary((r) => r.exportMs),
    zipKB: Math.round(results[0].zipBytes / 1024), generatedFiles: results[0].files,
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
  const result = await runScenario(key, scenario, { reps: args.reps, chrome, profile: args.profile, nodeEnv: args.nodeEnv });
  out.push(result);
  const f = (s) => `${s.median} (최대 ${s.max})`;
  console.log(`| ${key} ${result.label} | ${f(result.home)} | ${f(result.open)} | ${f(result.edit)} / ${result.editFrame.median} | ${f(result.undo)} / ${result.undoFrame.median} | ${f(result.export)} | ${result.heapMB.home.median} / ${result.heapMB.open.median} / ${result.heapMB.end.median} | ${result.domNodes.home.median} / ${result.domNodes.open.median} |`);
}
if (args.json) writeFileSync(args.json, JSON.stringify({ when: new Date().toISOString(), node: process.version, chrome, browser: versions.browser, results: out }, null, 2));

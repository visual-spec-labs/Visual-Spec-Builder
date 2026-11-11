import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FrameNode, ImageNode, Node as SpecNode } from "@/features/editor/schema";
import { previewBackground, previewFrameStyle, previewImageStyle } from "@/features/editor/ui/homePreview";
import { collectImageSrcs, isAnimatedImage, thumbnailSize } from "@/features/editor/ui/previewThumbnail";

type ThumbnailModule = typeof import("@/features/editor/ui/previewThumbnail");

function image(src: string, visible?: boolean): ImageNode {
  return { type: "image", name: "Photo", box: { width: 100, height: 100 }, src, fit: "cover", ...(visible === undefined ? {} : { visible }) };
}

function frame(background: FrameNode["background"]): FrameNode {
  return {
    type: "frame", name: "Card", box: { width: 100, height: 100 }, children: [], background,
    layout: { direction: "column", gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, mainAxis: "start", crossAxis: "start" },
  };
}

describe("thumbnailSize — 짧은 변 기준 축소(#322)", () => {
  it("짧은 변을 맞추고 비율을 유지한다", () => {
    expect(thumbnailSize(2400, 1600, 416)).toEqual({ width: 624, height: 416 });
    expect(thumbnailSize(1600, 2400, 416)).toEqual({ width: 416, height: 624 });
  });

  it("가늘고 긴 이미지는 짧은 변이 모자라지 않게 긴 변을 남긴다", () => {
    // 긴 변 기준이면 100×1000이 41×416이 되어, 넓은 상자를 cover로 채울 때 흐려진다.
    expect(thumbnailSize(1000, 10000, 416)).toEqual({ width: 416, height: 4160 });
  });

  it("이미 작으면 그대로 둔다", () => {
    expect(thumbnailSize(300, 200, 416)).toEqual({ width: 300, height: 200 });
  });
});

describe("collectImageSrcs", () => {
  it("root부터 그리는 노드의 이미지 노드와 배경 이미지 겹을 중복 없이 모으고, 빈 src는 뺀다", () => {
    const nodes: Record<string, SpecNode> = {
      root: { ...frame([{ type: "image", src: "assets/bg.png", fit: "cover" }, { type: "solid", color: "#FFFFFF" }]),
        children: [{ node: "a" }, { node: "b" }, { node: "d" }] },
      a: image("assets/a.png"),
      b: image("assets/a.png"),
      d: image(""),
    };

    expect(collectImageSrcs(nodes, "root")).toEqual(["assets/bg.png", "assets/a.png"]);
  });

  it("미리보기가 그리지 않는 이미지는 모으지 않는다 — 숨긴 노드와 그 아래, root에 이어지지 않은 노드", () => {
    const nodes: Record<string, SpecNode> = {
      root: { ...frame(undefined), children: [{ node: "hidden" }, { node: "shown" }] },
      hidden: { ...frame(undefined), visible: false, children: [{ node: "under" }] },
      under: image("assets/under-hidden.png"),
      shown: image("assets/shown.png"),
      orphan: image("assets/orphan.png"),
      self: image("assets/self-hidden.png", false),
    };

    expect(collectImageSrcs(nodes, "root")).toEqual(["assets/shown.png"]);
  });
});

describe("미리보기 스타일 — 축소본 src(#322)", () => {
  const thumbnails = (src: string) => (src === "assets/a.png" ? "blob:thumb-a" : null);

  it("준비된 이미지는 축소본 blob URL로 그린다", () => {
    expect(previewImageStyle(image("assets/a.png"), "column", thumbnails).backgroundImage).toBe('url("blob:thumb-a")');
  });

  it("준비되지 않은 이미지는 원본을 그리지 않고 비워 둔다", () => {
    expect(previewImageStyle(image("assets/b.png"), "column", thumbnails).backgroundImage).toBeUndefined();
  });

  it("배경은 준비되지 않은 이미지 겹만 빼고 나머지 겹과 맨 아래 단색을 유지한다", () => {
    const background: FrameNode["background"] = [
      { type: "image", src: "assets/b.png", fit: "contain" },
      { type: "image", src: "assets/a.png", fit: "cover" },
      { type: "solid", color: "#112233" },
    ];

    expect(previewBackground(background, thumbnails)).toEqual([
      { type: "image", src: "blob:thumb-a", fit: "cover" },
      { type: "solid", color: "#112233" },
    ]);
    const style = previewFrameStyle(frame(background), "column", thumbnails);
    expect(style.backgroundImage).toBe('url("blob:thumb-a")');
    expect(style.backgroundSize).toBe("cover");
    expect(style.backgroundColor).toBe("#112233");
  });
});

describe("isAnimatedImage", () => {
  const bytes = (...parts: Array<string | number[]>) => new Uint8Array(parts.flatMap((part) =>
    typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part));
  const chunk = (type: string, length = 0) => [
    ...bytes([0, 0, 0, length], type), ...Array(length + 4).fill(0),
  ];
  const png = (...chunks: number[][]) => bytes([0x89], "PNG", [13, 10, 26, 10], ...chunks);

  it("APNG는 IDAT 앞의 acTL로 가린다", () => {
    expect(isAnimatedImage(png(chunk("IHDR", 13), chunk("acTL", 8), chunk("IDAT", 2)))).toBe(true);
    expect(isAnimatedImage(png(chunk("IHDR", 13), chunk("IDAT", 2), chunk("IEND")))).toBe(false);
  });

  it("WebP는 VP8X의 애니메이션 비트로 가린다", () => {
    const webp = (flags: number) => bytes("RIFF", [0, 0, 0, 0], "WEBPVP8X", [10, 0, 0, 0, flags]);
    expect(isAnimatedImage(webp(0x02))).toBe(true);
    expect(isAnimatedImage(webp(0x10))).toBe(false);
    expect(isAnimatedImage(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe(false);
  });

  it("AVIF는 ftyp의 avis 브랜드로 가린다", () => {
    expect(isAnimatedImage(bytes([0, 0, 0, 24], "ftypavis", [0, 0, 0, 0], "avifmif1"))).toBe(true);
    expect(isAnimatedImage(bytes([0, 0, 0, 24], "ftypavif", [0, 0, 0, 0], "mif1miaf"))).toBe(false);
  });

  it("GIF는 모두 움직인다고 본다", () => {
    expect(isAnimatedImage(bytes("GIF89a"))).toBe(true);
  });
});

describe("previewThumbnail", () => {
  // 캐시·방문 번호가 모듈 상태라 테스트마다 모듈을 새로 불러온다.
  let previewThumbnail: ThumbnailModule["previewThumbnail"];
  let beginPreviewVisit: ThumbnailModule["beginPreviewVisit"];
  let endPreviewVisit: ThumbnailModule["endPreviewVisit"];
  let previewCacheSizes: ThumbnailModule["previewCacheSizes"];
  beforeEach(async () => {
    vi.resetModules();
    ({ previewThumbnail, beginPreviewVisit, endPreviewVisit, previewCacheSizes } = await import("@/features/editor/ui/previewThumbnail"));
    beginPreviewVisit({});
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("줄일 수 없는 환경이면 원본 src를 돌려준다", async () => {
    vi.stubGlobal("createImageBitmap", undefined);

    await expect(previewThumbnail("assets/no-bitmap.png", 416)).resolves.toBe("assets/no-bitmap.png");
  });

  it("원본을 짧은 변에 맞춰 줄이고, 원본 비트맵은 바로 놓으며, 동시에 둘까지만 디코드한다", async () => {
    let decoding = 0;
    let peak = 0;
    let closed = 0;
    const drawn: Array<[number, number]> = [];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["x"], { type: "image/png" }))));
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      decoding += 1;
      peak = Math.max(peak, decoding);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { width: 2400, height: 1600, close: () => { decoding -= 1; closed += 1; } };
    }));
    vi.stubGlobal("OffscreenCanvas", class {
      constructor(readonly width: number, readonly height: number) {}
      getContext() { return { drawImage: (_: unknown, x: number, y: number, w: number, h: number) => drawn.push([w, h]) }; }
      async convertToBlob() { return new Blob(["thumb"], { type: "image/webp" }); }
    });
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL: () => "blob:thumb" }));

    const first = ["one", "two", "three"].map((name) => previewThumbnail(`assets/${name}.png`, 416));
    // 앞 작업들이 도는 중에 뒤늦게 들어온 요청도 같은 한도 안에서 돈다.
    await new Promise((resolve) => setTimeout(resolve, 6));
    const late = ["four", "five"].map((name) => previewThumbnail(`assets/${name}.png`, 416));
    const results = await Promise.all([...first, ...late]);

    expect(results).toEqual(Array(5).fill("blob:thumb"));
    expect(drawn).toEqual(Array(5).fill([624, 416]));
    expect(closed).toBe(5);
    expect(peak).toBe(2);
    // 같은 src는 다시 불러오지 않는다.
    await previewThumbnail("assets/one.png", 416);
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("SVG·움직이는 이미지는 줄이지 않고 원본 src를 쓴다", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(url.endsWith(".gif")
      ? new Blob([new TextEncoder().encode("GIF89a")], { type: "image/gif" })
      : new Blob(["<svg/>"], { type: "image/svg+xml" }))));
    vi.stubGlobal("createImageBitmap", vi.fn());
    vi.stubGlobal("OffscreenCanvas", class {});

    await expect(previewThumbnail("assets/anim.gif", 416)).resolves.toBe("assets/anim.gif");
    await expect(previewThumbnail("assets/logo.svg", 416)).resolves.toBe("assets/logo.svg");
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("홈에 다시 들어오면 원본이 바뀌었는지 보고, 같으면 다시 줄이지 않고 바뀌었으면 새로 줄인다", async () => {
    let content = "first";
    let made = 0;
    const revoked: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob([content], { type: "image/png" }))));
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 2400, height: 1600, close() {} })));
    vi.stubGlobal("OffscreenCanvas", class {
      getContext() { return { drawImage() {} }; }
      async convertToBlob() { return new Blob(["thumb"], { type: "image/webp" }); }
    });
    vi.stubGlobal("URL", Object.assign(Object.create(URL), {
      createObjectURL: () => `blob:thumb-${++made}`,
      revokeObjectURL: (url: string) => revoked.push(url),
    }));

    beginPreviewVisit({});
    await expect(previewThumbnail("assets/hero.png", 416)).resolves.toBe("blob:thumb-1");
    // 같은 방문 안에서는 다시 받지 않는다.
    await previewThumbnail("assets/hero.png", 416);
    expect(fetch).toHaveBeenCalledTimes(1);

    beginPreviewVisit({});
    await expect(previewThumbnail("assets/hero.png", 416)).resolves.toBe("blob:thumb-1");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(createImageBitmap).toHaveBeenCalledTimes(1);

    content = "replaced on disk";
    beginPreviewVisit({});
    await expect(previewThumbnail("assets/hero.png", 416)).resolves.toBe("blob:thumb-2");
    expect(createImageBitmap).toHaveBeenCalledTimes(2);
    expect(revoked).toEqual(["blob:thumb-1"]);
  });

  describe("방문이 겹칠 때", () => {
    const responses: Array<(response: Response) => void> = [];
    const revoked: string[] = [];
    let made = 0;
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const png = (content: string) => new Response(new Blob([content], { type: "image/png" }));

    function stub() {
      responses.length = 0;
      revoked.length = 0;
      vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { responses.push(resolve); })));
      vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 2400, height: 1600, close() {} })));
      vi.stubGlobal("OffscreenCanvas", class {
        getContext() { return { drawImage() {} }; }
        async convertToBlob() { return new Blob(["thumb"], { type: "image/webp" }); }
      });
      vi.stubGlobal("URL", Object.assign(Object.create(URL), {
        createObjectURL: () => `blob:race-${++made}`,
        revokeObjectURL: (url: string) => revoked.push(url),
      }));
    }

    it("앞 방문에 시작한 확인은 새 방문의 확인으로 치지 않고, 끝난 뒤 다시 확인한다", async () => {
      stub();
      beginPreviewVisit({});
      const old = previewThumbnail("assets/race.png", 416);
      await flush();
      // 홈을 떠났다가 파일이 바뀐 뒤 돌아왔다 — 앞 방문의 요청은 아직 끝나지 않았다.
      beginPreviewVisit({});
      const fresh = previewThumbnail("assets/race.png", 416);
      await flush();
      expect(fetch).toHaveBeenCalledTimes(1);

      responses[0](png("old bytes"));
      const first = await old;
      await flush();
      expect(fetch).toHaveBeenCalledTimes(2);
      responses[1](png("new bytes"));
      const second = await fresh;

      expect(second).not.toBe(first);
      expect(revoked).toEqual([first]);
      await expect(previewThumbnail("assets/race.png", 416)).resolves.toBe(second);
    });

    it("다시 확인하다 실패하면 줄여 둔 것을 버리지 않는다", async () => {
      stub();
      beginPreviewVisit({});
      const made1 = previewThumbnail("assets/flaky.png", 416);
      await flush();
      responses[0](png("same"));
      const thumbnail = await made1;

      beginPreviewVisit({});
      const failing = previewThumbnail("assets/flaky.png", 416);
      await flush();
      responses[1](new Response("", { status: 404 }));
      await expect(failing).resolves.toBe(thumbnail);

      beginPreviewVisit({});
      const thrown = previewThumbnail("assets/flaky.png", 416);
      await flush();
      responses[2](Promise.reject(new Error("offline")) as unknown as Response);
      await expect(thrown).resolves.toBe(thumbnail);
      expect(revoked).toEqual([]);
    });

    it("같은 홈 화면이 다시 불러도 새 방문으로 세지 않는다", async () => {
      stub();
      const screen = {};
      beginPreviewVisit(screen);
      const first = previewThumbnail("assets/once.png", 416);
      await flush();
      responses[0](png("once"));
      await first;

      beginPreviewVisit(screen);
      await previewThumbnail("assets/once.png", 416);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  it("다른 출처의 이미지는 받지 않고 원본 src를 쓴다", async () => {
    vi.stubGlobal("location", { href: "http://127.0.0.1:5173/" });
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("createImageBitmap", vi.fn());
    vi.stubGlobal("OffscreenCanvas", class {});

    await expect(previewThumbnail("https://cdn.example.test/hero.png", 416)).resolves.toBe("https://cdn.example.test/hero.png");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("두 방문 넘게 그리지 않은 이미지는 잊고 축소본을 해제한다", async () => {
    const revoked: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["forget"], { type: "image/png" }))));
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 2400, height: 1600, close() {} })));
    vi.stubGlobal("OffscreenCanvas", class {
      getContext() { return { drawImage() {} }; }
      async convertToBlob() { return new Blob(["thumb"], { type: "image/webp" }); }
    });
    vi.stubGlobal("URL", Object.assign(Object.create(URL), {
      createObjectURL: () => "blob:forget",
      revokeObjectURL: (url: string) => revoked.push(url),
    }));

    beginPreviewVisit({});
    await previewThumbnail("assets/forget.png", 416);
    beginPreviewVisit({});
    beginPreviewVisit({});
    expect(revoked).toEqual([]);
    beginPreviewVisit({});
    expect(revoked).toEqual(["blob:forget"]);
  });

  it("원본 받기가 멈추면 제한 시간 뒤 자리를 놓고 원본 src를 쓴다", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("fetch", vi.fn((_: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })));
      vi.stubGlobal("createImageBitmap", vi.fn());
      vi.stubGlobal("OffscreenCanvas", class {});

      const stalled = ["a", "b", "c"].map((name) => previewThumbnail(`assets/stalled-${name}.png`, 416));
      await vi.advanceTimersByTimeAsync(10_000);
      // 앞 둘이 자리를 놓아야 셋째가 시작한다.
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(Promise.all(stalled)).resolves.toEqual(["assets/stalled-a.png", "assets/stalled-b.png", "assets/stalled-c.png"]);
    } finally {
      vi.useRealTimers();
    }
  });

  describe("대기열", () => {
    const calls: string[] = [];
    const responses = new Map<string, (response: Response) => void>();
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    beforeEach(() => {
      calls.length = 0;
      responses.clear();
      vi.stubGlobal("fetch", vi.fn((url: string) => new Promise<Response>((resolve) => {
        const name = url.split("/").pop() ?? url;
        calls.push(name);
        responses.set(name, resolve);
      })));
      vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close() {} })));
      vi.stubGlobal("OffscreenCanvas", class {});
    });
    const png = () => new Response(new Blob(["x"], { type: "image/png" }));

    it("함께 줄 선 카드는 위에서부터, 나중에 줄 선 카드는 앞 묶음보다 먼저 꺼낸다", async () => {
      // 처음 화면에 함께 보인 카드들
      const first = ["a", "b", "c", "d"].map((name) => previewThumbnail(`assets/${name}.png`, 416));
      // 스크롤 콜백은 다른 태스크에서 온다 — 앞 묶음이 닫힐 만큼 태스크를 넘긴다.
      await flush();
      await flush();
      // 스크롤해서 새로 보인 카드들
      const scrolled = ["e", "f"].map((name) => previewThumbnail(`assets/${name}.png`, 416));
      await flush();
      expect(calls).toEqual(["a.png", "b.png"]);

      responses.get("a.png")?.(png());
      responses.get("b.png")?.(png());
      await vi.waitFor(() => expect(calls).toHaveLength(4));
      expect(calls.slice(2)).toEqual(["e.png", "f.png"]);
      responses.get("e.png")?.(png());
      responses.get("f.png")?.(png());
      await vi.waitFor(() => expect(calls).toHaveLength(6));
      expect(calls.slice(4)).toEqual(["c.png", "d.png"]);
      responses.get("c.png")?.(png());
      responses.get("d.png")?.(png());
      await Promise.all([...first, ...scrolled]);
    });

    it("홈을 떠나면 아직 자리를 잡지 못한 확인은 받지도 디코드하지도 않는다", async () => {
      const screen = {};
      beginPreviewVisit(screen);
      const jobs = ["a", "b", "c", "d"].map((name) => previewThumbnail(`assets/${name}.png`, 416));
      await flush();
      endPreviewVisit(screen);
      responses.get("a.png")?.(png());
      responses.get("b.png")?.(png());

      await expect(Promise.all(jobs)).resolves.toEqual(["assets/a.png", "assets/b.png", "assets/c.png", "assets/d.png"]);
      expect(calls).toEqual(["a.png", "b.png"]);
    });
  });

  it("crypto.subtle이 없어도(http LAN 주소) 내용이 같으면 다시 디코드하지 않는다", async () => {
    vi.stubGlobal("crypto", {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["same bytes"], { type: "image/png" }))));
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 2400, height: 1600, close() {} })));
    vi.stubGlobal("OffscreenCanvas", class {
      getContext() { return { drawImage() {} }; }
      async convertToBlob() { return new Blob(["thumb"], { type: "image/webp" }); }
    });
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL: () => "blob:lan", revokeObjectURL() {} }));

    await previewThumbnail("assets/lan.png", 416);
    beginPreviewVisit({});
    await previewThumbnail("assets/lan.png", 416);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(createImageBitmap).toHaveBeenCalledTimes(1);
  });

  it("확인이 차례를 기다리다 홈을 떠나도, 그 방문에 요청한 이미지는 잊지 않는다", async () => {
    const revoked: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["kept"], { type: "image/png" }))));
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 2400, height: 1600, close() {} })));
    vi.stubGlobal("OffscreenCanvas", class {
      getContext() { return { drawImage() {} }; }
      async convertToBlob() { return new Blob(["thumb"], { type: "image/webp" }); }
    });
    vi.stubGlobal("URL", Object.assign(Object.create(URL), {
      createObjectURL: () => "blob:kept",
      revokeObjectURL: (url: string) => revoked.push(url),
    }));
    await previewThumbnail("assets/kept.png", 416);

    // 세 번 잠깐 들렀다 떠난다 — 매번 카드는 요청했지만 확인은 차례가 오기 전에 홈을 떠났다.
    for (let pass = 0; pass < 3; pass += 1) {
      const screen = {};
      beginPreviewVisit(screen);
      endPreviewVisit(screen);
      await previewThumbnail("assets/kept.png", 416);
    }
    beginPreviewVisit({});

    expect(revoked).toEqual([]);
  });

  describe("PR #334 리뷰", () => {
    const png = () => new Response(new Blob(["x"], { type: "image/png" }));

    it("홈을 떠나 결과 없이 끝난 요청의 src도 두 방문 뒤 놓는다", async () => {
      const held: Array<(response: Response) => void> = [];
      vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { held.push(resolve); })));
      vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close() {} })));
      vi.stubGlobal("OffscreenCanvas", class {});
      const screen = {};
      beginPreviewVisit(screen);
      const jobs = Array.from({ length: 10 }, (_, k) => previewThumbnail(`data:image/png;base64,${"A".repeat(1024)}${k}`, 416));
      await new Promise((resolve) => setTimeout(resolve, 0));
      endPreviewVisit(screen);
      for (const resolve of held) resolve(png());
      await Promise.all(jobs);

      for (let pass = 0; pass < 3; pass += 1) beginPreviewVisit({});

      // 끝까지 돈 두 개는 결과(entries)로 남았다가 같은 기준으로 놓이고, 취소된 여덟 개도 남지 않는다.
      expect(previewCacheSizes()).toEqual({ entries: 0, requested: 0, pending: 0 });
    });

    it("줄이지 않는 외부 이미지는 멈춘 로컬 요청 뒤에서 기다리지 않는다", async () => {
      vi.stubGlobal("location", { href: "http://127.0.0.1:5173/" });
      vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
      vi.stubGlobal("createImageBitmap", vi.fn());
      vi.stubGlobal("OffscreenCanvas", class {});
      void previewThumbnail("assets/stuck-a.png", 416);
      void previewThumbnail("assets/stuck-b.png", 416);
      await new Promise((resolve) => setTimeout(resolve, 0));

      await expect(previewThumbnail("https://cdn.example.test/x.png", 416)).resolves.toBe("https://cdn.example.test/x.png");
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("한 태스크 안에서 묶음이 다 꺼내진 뒤 다시 줄 서도 요청을 잃지 않는다", async () => {
      // 모든 단계가 마이크로태스크로 끝나게 한다(한 태스크 안) — 해시도 동기 경로로.
      vi.stubGlobal("crypto", {});
      // 실제 Response·Blob 읽기는 다른 태스크로 넘어갈 수 있어 마이크로태스크로만 끝나는 가짜를 쓴다.
      const blob = { type: "image/png", arrayBuffer: async () => new ArrayBuffer(1) };
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => blob })));
      vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close() {} })));
      vi.stubGlobal("OffscreenCanvas", class {});

      await Promise.all(["a", "b", "c"].map((name) => previewThumbnail(`assets/same-task-${name}.png`, 416)));
      await Promise.all(["d", "e", "f"].map((name) => previewThumbnail(`assets/same-task-${name}.png`, 416)));

      expect(fetch).toHaveBeenCalledTimes(6);
    });
  });

  it("스펙의 src가 blob URL이어도 해제하지 않는다", async () => {
    const revoked: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    vi.stubGlobal("createImageBitmap", vi.fn());
    vi.stubGlobal("OffscreenCanvas", class {});
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { revokeObjectURL: (url: string) => revoked.push(url) }));

    beginPreviewVisit({});
    await previewThumbnail("blob:user-image", 416);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("gone"); }));
    await previewThumbnail("http://example.test/a.png", 416);
    beginPreviewVisit({});
    await previewThumbnail("blob:user-image", 416);

    expect(revoked).toEqual([]);
  });

  it("불러오기에 실패하면 원본 src로 되돌아간다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    vi.stubGlobal("createImageBitmap", vi.fn());
    vi.stubGlobal("OffscreenCanvas", class {});

    await expect(previewThumbnail("assets/missing.png", 416)).resolves.toBe("assets/missing.png");
  });
});

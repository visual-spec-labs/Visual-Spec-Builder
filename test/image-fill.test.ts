import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { backgroundStyle } from "@/features/editor/ui/canvasLayout";
import { imageUrlCss } from "@/features/editor/ui/properties/imageSrc";
import { changeFillType, setImageFill } from "@/features/editor/ui/properties/backgroundPatch";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { buildExportPayload } from "@/features/editor/store/exportSpec";
import { verifyGenerated } from "@/features/editor/export/verifyGenerated";
import { buildBundleEntries } from "@/features/editor/export/bundle";
import { scanAssetReferences } from "@/features/editor/export/importScan";
import { needsBackgroundConfirmation } from "@/features/editor/nl/backgroundChange";
import type { Background, ImageFill, LinearFill, VisualSpec } from "@/features/editor/schema";
import example from "../examples/image-background.json";

const photo: ImageFill = { type: "image", src: "assets/hero.png", fit: "cover" };
const overlay = { type: "linear", angle: 180, stops: [{ color: "#0F172A00", at: 0 }, { color: "#0F172ACC", at: 1 }] } as const;
const gradient: LinearFill = { ...overlay, stops: [...overlay.stops] };

describe("image background rendering and editing", () => {
  beforeEach(() => useEditorStore.getState().loadSpec(structuredClone(example) as unknown as VisualSpec));
  it.each(["cover", "contain", "fill"] as const)("keeps photo + linear layer sizes aligned for %s", (fit) => {
    const style = backgroundStyle([gradient, { ...photo, fit }, { type: "solid", color: "#FF0000" }]);
    expect(style.backgroundImage).toBe(`linear-gradient(180deg, #0F172A00 0%, #0F172ACC 100%), ${imageUrlCss(photo.src)}`);
    expect(style.backgroundColor).toBe("#FF0000");
    expect(style.backgroundSize).toBe(`auto, ${fit === "fill" ? "100% 100%" : fit}`);
    expect(style.backgroundPosition).toBe("center, center");
    expect(style.backgroundRepeat).toBe("no-repeat, no-repeat");
    expect(style.backgroundOrigin).toBe("border-box");
  });
  it("preserves multiple image indices, escaped URL and old solid/linear CSS", () => {
    expect(backgroundStyle([photo, gradient, { ...photo, fit: "contain" }]).backgroundSize).toBe("cover, auto, contain");
    expect(imageUrlCss('https://example.test/a"b\nc.png')).toBe('url("https://example.test/a\\"b\\a c.png")');
    expect(backgroundStyle([{ type: "solid", color: "#FFFFFF" }])).toEqual({ backgroundColor: "#FFFFFF", backgroundImage: undefined, backgroundOrigin: undefined });
    expect(backgroundStyle([gradient])).not.toHaveProperty("backgroundSize");
  });
  it("converts types and edits the complete array through Command with undo/redo", () => {
    const before = useEditorStore.getState().spec;
    const node = before.pages[useEditorStore.getState().activePageId].nodes.hero;
    if (!("background" in node)) throw new Error("fixture");
    const updated = setImageFill(node.background, 1, { fit: "contain" })!;
    useEditorStore.getState().setNodeField("hero", "background", updated);
    expect(buildExportPayload(useEditorStore.getState().spec)).toMatchObject({ ok: true });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().spec).toEqual(before);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().spec.pages[useEditorStore.getState().activePageId].nodes.hero).toMatchObject({ background: updated });
    expect(setImageFill(updated, 1, { fit: "contain" })).toBe(updated);
    expect(setImageFill(updated, 1, { src: "" })).toBe(updated);
    for (const type of ["solid", "linear", "image"] as const) {
      const fills = changeFillType(updated, 1, type)!;
      expect(fills[1].type).toBe(type);
      expect(fills[0]).toEqual(gradient);
    }
    const snapshot = useEditorStore.getState().spec;
    useEditorStore.getState().setNodeField("hero", "background.1.src", "assets/no.png");
    expect(useEditorStore.getState().spec).toBe(snapshot);
  });
  it("warns before NL replaces or removes an existing image", () => {
    const before: Background = [photo];
    expect(needsBackgroundConfirmation(before, [gradient, photo])).toBe(false);
    expect(needsBackgroundConfirmation(before, [{ ...photo, src: "assets/other.png" }])).toBe(true);
    expect(needsBackgroundConfirmation(before, [])).toBe(true);
  });
});

describe("image background generated fixture → asset verification → bundle", () => {
  it("matches documented CSS and includes photo assets; missing assets fail", () => {
    const content = [
      `import heroImageUrl from "../assets/hero.png";`,
      `export default function ImagePage() { return <div style={{ backgroundImage: \`linear-gradient(180deg, #0F172A00 0%, #0F172ACC 100%), url(\${JSON.stringify(heroImageUrl)})\`, backgroundSize: "auto, cover", backgroundPosition: "center, center", backgroundRepeat: "no-repeat, no-repeat", backgroundOrigin: "border-box" }} />; }`,
    ].join("\n");
    const files = [{ path: "pages/ImagePage.tsx", content }];
    const report = verifyGenerated({ files, tickets: [], assetNames: ["hero.png"] });
    expect(report.errorCount).toBe(0);
    expect(report.usedAssets).toEqual(["hero.png"]);
    expect(verifyGenerated({ files, tickets: [], assetNames: [] }).issues).toContainEqual(expect.objectContaining({ code: "missing-asset" }));
    const bytes = new Uint8Array([1, 2, 3]);
    const entries = buildBundleEntries({ projectName: "photo", files, report, assets: [{ name: "hero.png", bytes }] });
    expect(entries).toContainEqual({ path: "photo/assets/hero.png", bytes });
    const skill = readFileSync(new URL("../skills/visual-spec-to-react/SKILL.md", import.meta.url), "utf8");
    expect(skill).toContain('import heroImageUrl from "../assets/hero.png";');
    expect(skill).toContain("JSON.stringify(heroImageUrl)");
    expect(skill).toContain("backgroundSize: 'auto, cover'");
  });
  it("recognizes JS-escaped quotes, apostrophes and encoded URL filenames", () => {
    expect(scanAssetReferences(String.raw`backgroundImage: "url(\"../assets/hero.png\")"`)).toEqual(["hero.png"]);
    expect(scanAssetReferences(`backgroundImage: \`url("../assets/team's.png")\``)).toEqual(["team's.png"]);
    expect(scanAssetReferences(`url("../assets/hero%231%25.png")`)).toEqual(["hero#1%.png"]);
  });
  it("recognizes quoted background asset names with spaces and parentheses once", () => {
    expect(scanAssetReferences(`backgroundImage: 'url("../assets/hero (1).png")'`)).toEqual(["hero (1).png"]);
  });
});

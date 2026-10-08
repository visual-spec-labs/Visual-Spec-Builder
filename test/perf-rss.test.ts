import { describe, expect, it } from "vitest";
import { collectChromeRss, formatRss, summarizeRss, type RssSample } from "../scripts/perf/rss.mjs";

const ok = (valueMB: number): RssSample => ({ valueMB, status: "ok", reason: null });
const missing: RssSample = { valueMB: null, status: "unavailable", reason: "ps_failed" };

describe("performance RSS missingness", () => {
  it("preserves full collector failure in JSON and console instead of reporting zero", () => {
    const sample = collectChromeRss(10, () => { throw new Error("ps unavailable"); });
    expect(sample).toEqual(missing);
    const summary = summarizeRss([sample, sample]);
    expect(JSON.parse(JSON.stringify(summary))).toEqual({ median: null, max: null, valid: 0, total: 2, status: "unavailable" });
    expect(formatRss(summary)).toBe("N/A (unavailable, 0/2 valid)");
  });

  it("excludes missing samples from mixed medians and reports coverage", () => {
    const summary = summarizeRss([ok(100), missing, ok(200)]);
    expect(summary).toEqual({ median: 200, max: 200, valid: 2, total: 3, status: "partial" });
    expect(formatRss(JSON.parse(JSON.stringify(summary)))).toBe("200MB (partial, 2/3 valid)");
    expect(summarizeRss([missing, missing, ok(100)]).median).toBe(100);
  });

  it("keeps valid controls and true zero distinct from unavailable", () => {
    expect(summarizeRss([ok(300), ok(100), ok(200)])).toEqual({ median: 200, max: 300, valid: 3, total: 3, status: "ok" });
    const zero = collectChromeRss(10, () => "10 1 0\n11 10 0");
    expect(zero).toEqual(ok(0));
    expect(formatRss(summarizeRss([zero]))).toBe("0MB (ok, 1/1 valid)");
  });

  it("excludes nonfinite, negative, malformed, and unsuccessful samples", () => {
    const summary = summarizeRss([ok(NaN), ok(Infinity), ok(-Infinity), ok(-1), null, undefined, missing, ok(20)]);
    expect(summary).toEqual({ median: 20, max: 20, valid: 1, total: 8, status: "partial" });
    expect(summarizeRss([ok(NaN), ok(Infinity)])).toEqual({ median: null, max: null, valid: 0, total: 2, status: "unavailable" });
    expect(formatRss(summarizeRss([]))).toBe("N/A (unavailable, 0/0 valid)");
  });

  it("sums only the Chrome process tree", () => {
    expect(collectChromeRss(10, () => "0 0 0\n10 1 1024\n11 10 2048\n12 11 1024\n20 1 999999")).toEqual(ok(4));
  });

  it.each(["", "10 1 NaN", "10 1 Infinity", "10 1 -1", "10 1", "10 1 1\n10 1 2", "10 1 9007199254740992"])("does not invent zero for malformed ps output: %s", (output) => {
    expect(collectChromeRss(10, () => output)).toEqual({ valueMB: null, status: "unavailable", reason: "invalid_process_table" });
  });

  it("reports a missing root and a cyclic tree as collection failures", () => {
    expect(collectChromeRss(10, () => "20 1 1024").reason).toBe("root_missing");
    expect(collectChromeRss(10, () => "10 11 1\n11 10 1").reason).toBe("invalid_process_tree");
  });
});

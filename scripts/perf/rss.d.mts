export interface RssSample {
  valueMB: number | null;
  status: "ok" | "unavailable";
  reason: string | null;
}
export interface RssSummary {
  median: number | null;
  max: number | null;
  valid: number;
  total: number;
  status: "ok" | "partial" | "unavailable";
}
export function collectChromeRss(rootPid: number, readProcessTable?: () => string): RssSample;
export function summarizeRss(samples: readonly (RssSample | null | undefined)[]): RssSummary;
export function formatRss(summary: RssSummary): string;

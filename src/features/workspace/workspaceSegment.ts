/** Decoded path component rules shared by the server and browser-side snapshot validation. */
export function isWorkspaceSegment(value: string): boolean {
  return value !== "" && value !== "." && value !== ".."
    && !/[/\\:*?"<>|\u0000-\u001f\u007f]/.test(value)
    && value === value.trimEnd() && !value.endsWith(".");
}

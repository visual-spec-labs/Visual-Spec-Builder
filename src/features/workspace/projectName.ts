/** A project name is also a portable, flat JSON filename. Never silently sanitize it. */
export function projectFileName(name: string): string | null {
  if (name !== name.trim() || name.length === 0 || name.length > 120 ||
    /[\\/<>:"|?*\u0000-\u001f\u007f]/.test(name) || /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) || name === "." || name === "..") return null;
  return `${name}.json`;
}

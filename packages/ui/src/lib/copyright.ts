/**
 * The footer copyright line, shared by both apps and the mobile navigation drawer.
 * Previously a literal in all three places, which is how the year went stale and the
 * wording drifted. Evaluated at render, so statically rendered pages pick up the
 * current year on their next build.
 */
export function copyrightLine(): string {
  return `©Zivoe ${new Date().getFullYear()}. All Rights Reserved.`;
}

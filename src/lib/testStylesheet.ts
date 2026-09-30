/**
 * jsdom's CSSOM predates CSS cascade layers and rejects any stylesheet
 * containing `@layer { … }` outright — the whole sheet fails to parse and
 * every computed value comes back empty. Tests that inject globals.css for
 * computed-style assertions unwrap the components layer first: the
 * declarations are byte-identical, and layers only arbitrate precedence
 * between competing rules — the injected test sheet contains no Tailwind
 * competition, so computed values are unchanged. Source-text assertions
 * always run against the raw file.
 */
export function stylesheetForJsdom(css: string): string {
  const marker = '@layer components {';
  const open = css.indexOf(marker);
  if (open === -1) return css;
  let depth = 0;
  for (let i = open + marker.length - 1; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return css.slice(0, open) + css.slice(open + marker.length, i) + css.slice(i + 1);
    }
  }
  return css;
}

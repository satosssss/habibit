/**
 * jsdom's CSSOM predates CSS cascade layers and rejects any stylesheet
 * containing `@layer … { … }` outright — the whole sheet fails to parse and
 * every computed value comes back empty. Tests that inject globals.css for
 * computed-style assertions unwrap every layer block first: the declarations
 * are byte-identical, and layers only arbitrate precedence between competing
 * rules — the injected test sheet contains no Tailwind competition, so
 * computed values are unchanged. Source-text assertions always run against
 * the raw file.
 */
export function stylesheetForJsdom(css: string): string {
  let out = css;
  for (;;) {
    const m = /@layer [\w-]+ \{/.exec(out);
    if (!m) return out;
    const marker = m[0];
    let depth = 0;
    let end = -1;
    for (let i = m.index + marker.length - 1; i < out.length; i++) {
      const ch = out[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) return out;
    out = out.slice(0, m.index) + out.slice(m.index + marker.length, end) + out.slice(end + 1);
  }
}

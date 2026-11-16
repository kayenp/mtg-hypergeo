const STYLE_MARKER = '<!--STYLE-->';
const SCRIPT_MARKER = '<!--SCRIPT-->';

/**
 * Puts the CSS and the script bundle into the page, in place of the two markers.
 * A "</script" or "</style" in the content would end its element early, so each one gets a backslash.
 * The replacements are functions, because a string replacement expands "$&" and similar patterns.
 */
export function inlinePage(html: string, css: string, js: string): string {
  if (!html.includes(STYLE_MARKER) || !html.includes(SCRIPT_MARKER)) {
    throw new Error(`The page needs the ${STYLE_MARKER} and ${SCRIPT_MARKER} markers.`);
  }
  const safeCss = css.replace(/<\/style/gi, (m) => `<\\${m.slice(1)}`);
  const safeJs = js.replace(/<\/script/gi, (m) => `<\\${m.slice(1)}`);
  return html.replace(STYLE_MARKER, () => `<style>${safeCss}</style>`).replace(SCRIPT_MARKER, () => `<script>${safeJs}</script>`);
}

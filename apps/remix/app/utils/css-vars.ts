import { CSS_LENGTH_REGEX, type TCssVarsSchema } from '@documenso/lib/types/css-vars';
import { colord } from 'colord';
import { toKebabCase } from 'remeda';

const CSS_LENGTH_KEYS = new Set<keyof TCssVarsSchema>([
  'radius',
  'fieldRequiredCardBorderWidth',
  'fieldOptionalCardBorderWidth',
]);

export const toNativeCssVars = (vars: TCssVarsSchema) => {
  const cssVars: Record<string, string> = {};

  for (const [key, value] of Object.entries(vars)) {
    if (!value) {
      continue;
    }

    if (CSS_LENGTH_KEYS.has(key as keyof TCssVarsSchema)) {
      if (CSS_LENGTH_REGEX.test(value)) {
        cssVars[`--${toKebabCase(key)}`] = value;
      }

      continue;
    }

    const color = colord(value);
    const { h, s, l, a } = color.toHsl();

    // Tailwind's theme.css consumes these via `hsl(var(--token))`. CSS
    // Color 4 space-separated `hsl()` requires `%` on saturation and
    // lightness — without it, the function is invalid and the property
    // falls back to its initial value (which is why bare numeric output
    // here used to silently break customer colours).
    //
    // Alpha is included when < 1 so tokens like field backgrounds can
    // carry opacity inside the variable (`hsl(var(--token))`) instead of
    // hard-coding `/ 0.9` at every call site.
    cssVars[`--${toKebabCase(key)}`] = a < 1 ? `${h} ${s}% ${l}% / ${a}` : `${h} ${s}% ${l}%`;
  }

  return cssVars;
};

/**
 * Pure-string sibling of `toNativeCssVars` — returns the same set of CSS custom
 * property declarations as a single string suitable for SSR inlining inside a
 * rule block. Does not touch the DOM.
 *
 * Example: { background: '#111', radius: '0.5rem' }
 *  -> "--background: 0 0% 6.7%; --radius: 0.5rem;"
 *
 * Saturation and lightness include the `%` suffix that
 * `hsl(var(--token))` requires under CSS Color 4 space-separated syntax.
 */
export const toNativeCssVarsString = (vars: TCssVarsSchema): string => {
  const map = toNativeCssVars(vars);
  return Object.entries(map)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
};

export const injectCss = (options: { css?: string; cssVars?: TCssVarsSchema }) => {
  const { css, cssVars } = options;

  if (css) {
    const style = document.createElement('style');
    style.textContent = css;

    document.head.appendChild(style);
  }

  if (cssVars) {
    const nativeVars = toNativeCssVars(cssVars);

    for (const [key, value] of Object.entries(nativeVars)) {
      document.documentElement.style.setProperty(key, value);
    }
  }
};

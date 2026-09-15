const LIGHT_MODE_EMAIL_META =
  '<meta name="color-scheme" content="light"/><meta name="supported-color-schemes" content="light"/>';

/**
 * Post-process rendered recipient email HTML to discourage dark-mode inversion
 * in mail clients that honour `prefers-color-scheme: dark` rules.
 */
export const postProcessEmailHtmlForLightMode = (html: string): string => {
  let result = html.replaceAll(/prefers-color-scheme:\s*dark/gi, 'min-width:0');

  if (!result.includes('color-scheme')) {
    result = result.replace(/<head>/i, `<head>${LIGHT_MODE_EMAIL_META}`);
  }

  return result;
};

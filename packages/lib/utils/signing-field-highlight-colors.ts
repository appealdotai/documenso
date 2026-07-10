import { DEFAULT_BRAND_COLORS, DEFAULT_BRAND_LENGTHS } from '../constants/theme';
import type { TCssVarsSchema } from '../types/css-vars';

export const SIGNING_FIELD_HIGHLIGHT_COLOR_KEYS = [
  'fieldRequiredCard',
  'fieldRequiredCardBorder',
  'fieldRequiredCardBorderWidth',
  'fieldOptionalCard',
  'fieldOptionalCardBorder',
  'fieldOptionalCardBorderWidth',
  'fieldValidationCardBorder',
] as const satisfies readonly (keyof TCssVarsSchema)[];

export type SigningFieldHighlightColorKey = (typeof SIGNING_FIELD_HIGHLIGHT_COLOR_KEYS)[number];

const DEFAULT_SIGNING_FIELD_HIGHLIGHT_COLORS: Pick<TCssVarsSchema, SigningFieldHighlightColorKey> = {
  fieldRequiredCard: DEFAULT_BRAND_COLORS.fieldRequiredCard,
  fieldRequiredCardBorder: DEFAULT_BRAND_COLORS.fieldRequiredCardBorder,
  fieldRequiredCardBorderWidth: DEFAULT_BRAND_LENGTHS.fieldRequiredCardBorderWidth,
  fieldOptionalCard: DEFAULT_BRAND_COLORS.fieldOptionalCard,
  fieldOptionalCardBorder: DEFAULT_BRAND_COLORS.fieldOptionalCardBorder,
  fieldOptionalCardBorderWidth: DEFAULT_BRAND_LENGTHS.fieldOptionalCardBorderWidth,
  fieldValidationCardBorder: DEFAULT_BRAND_COLORS.fieldValidationCardBorder,
};

/**
 * Merge saved branding overrides with defaults for signing-field highlight tokens.
 * Ensures recipient signing always receives a complete set of CSS variables.
 */
export const resolveSigningFieldHighlightColors = (
  brandingColors: TCssVarsSchema | null | undefined,
): TCssVarsSchema => {
  const resolved: TCssVarsSchema = { ...DEFAULT_SIGNING_FIELD_HIGHLIGHT_COLORS };

  if (!brandingColors) {
    return resolved;
  }

  for (const key of SIGNING_FIELD_HIGHLIGHT_COLOR_KEYS) {
    const value = brandingColors[key];

    if (typeof value === 'string' && value.trim() !== '') {
      resolved[key] = value;
    }
  }

  return resolved;
};

export const hasSigningFieldHighlightOverrides = (brandingColors: TCssVarsSchema | null | undefined) => {
  if (!brandingColors) {
    return false;
  }

  return SIGNING_FIELD_HIGHLIGHT_COLOR_KEYS.some((key) => {
    const value = brandingColors[key];
    return typeof value === 'string' && value.trim() !== '';
  });
};

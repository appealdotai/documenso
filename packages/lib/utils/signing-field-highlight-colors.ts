import type { Field } from '@prisma/client';
import { colord } from 'colord';
import { DEFAULT_BRAND_COLORS, DEFAULT_BRAND_LENGTHS } from '../constants/theme';
import type { TCssVarsSchema } from '../types/css-vars';
import type { FieldCanvasStyle } from '../universal/field-renderer/field-renderer';
import { isRequiredField } from './advanced-fields-helpers';

const TRANSPARENT_BACKGROUND = 'rgba(0, 0, 0, 0)';

export const SIGNING_FIELD_HIGHLIGHT_COLOR_KEYS = [
  'fieldRequiredCard',
  'fieldRequiredCardBorder',
  'fieldRequiredCardBorderHover',
  'fieldRequiredCardBorderWidth',
  'fieldOptionalCard',
  'fieldOptionalCardBorder',
  'fieldOptionalCardBorderHover',
  'fieldOptionalCardBorderWidth',
  'fieldValidationCardBorder',
] as const satisfies readonly (keyof TCssVarsSchema)[];

export type SigningFieldHighlightColorKey = (typeof SIGNING_FIELD_HIGHLIGHT_COLOR_KEYS)[number];

const DEFAULT_SIGNING_FIELD_HIGHLIGHT_COLORS: Pick<TCssVarsSchema, SigningFieldHighlightColorKey> = {
  fieldRequiredCard: DEFAULT_BRAND_COLORS.fieldRequiredCard,
  fieldRequiredCardBorder: DEFAULT_BRAND_COLORS.fieldRequiredCardBorder,
  fieldRequiredCardBorderHover: DEFAULT_BRAND_COLORS.fieldRequiredCardBorderHover,
  fieldRequiredCardBorderWidth: DEFAULT_BRAND_LENGTHS.fieldRequiredCardBorderWidth,
  fieldOptionalCard: DEFAULT_BRAND_COLORS.fieldOptionalCard,
  fieldOptionalCardBorder: DEFAULT_BRAND_COLORS.fieldOptionalCardBorder,
  fieldOptionalCardBorderHover: DEFAULT_BRAND_COLORS.fieldOptionalCardBorderHover,
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

const parsePixelValue = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue)) {
    return undefined;
  }

  return parsedValue;
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

const colorToCanvasColor = (value: string | undefined, alpha?: number) => {
  if (!value) {
    return undefined;
  }

  const color = colord(value);

  if (!color.isValid()) {
    return undefined;
  }

  if (alpha !== undefined) {
    return color.alpha(alpha).toRgbString();
  }

  return color.toRgbString();
};

const OPTIONAL_FIELD_SIDE_BORDER_OPACITY = 0.4;

type SigningFieldStateInput = {
  inserted: boolean;
  isValidating?: boolean;
  isEditing?: boolean;
  fieldMeta?: { readOnly?: boolean } | null;
  type: Field['type'];
};

const FILLED_FIELD_BACKGROUND = 'rgba(255, 255, 255, 0.9)';

const getOptionalHoverSideStyle = ({
  optionalBorderWidth,
  optionalBorderHoverColor,
}: {
  optionalBorderWidth: number;
  optionalBorderHoverColor: string | undefined;
}) => {
  const sideColor = colorToCanvasColor(optionalBorderHoverColor, OPTIONAL_FIELD_SIDE_BORDER_OPACITY);
  const bottomColor = optionalBorderHoverColor;

  return {
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: optionalBorderWidth + 1,
    borderLeftWidth: 1,
    borderTopColor: sideColor,
    borderRightColor: sideColor,
    borderBottomColor: bottomColor,
    borderLeftColor: sideColor,
    borderColor: bottomColor,
    borderHoverColor: bottomColor,
  };
};

/**
 * Resolve Konva field styles directly from branding colour tokens.
 * This bypasses CSS probing so saved highlight settings always apply on signing.
 */
export const resolveFieldCanvasStyleFromBrandingColors = (
  field: SigningFieldStateInput,
  brandingColors: TCssVarsSchema | null | undefined,
): FieldCanvasStyle | undefined => {
  const colors = resolveSigningFieldHighlightColors(brandingColors);
  const isRequired = isRequiredField({ type: field.type, fieldMeta: field.fieldMeta ?? null } as Field);
  const isEditing = Boolean(field.isEditing);
  const requiredBorderWidth =
    parsePixelValue(colors.fieldRequiredCardBorderWidth ?? DEFAULT_BRAND_LENGTHS.fieldRequiredCardBorderWidth) ?? 2;
  const optionalBorderWidth =
    parsePixelValue(colors.fieldOptionalCardBorderWidth ?? DEFAULT_BRAND_LENGTHS.fieldOptionalCardBorderWidth) ?? 2;
  const requiredBorderColor = colorToCanvasColor(colors.fieldRequiredCardBorder);
  const requiredBorderHoverColor = colorToCanvasColor(colors.fieldRequiredCardBorderHover);
  const optionalBorderColor = colorToCanvasColor(colors.fieldOptionalCardBorder);
  const optionalBorderHoverColor = colorToCanvasColor(colors.fieldOptionalCardBorderHover);
  const optionalHoverSideStyle = getOptionalHoverSideStyle({
    optionalBorderWidth,
    optionalBorderHoverColor,
  });

  if (field.fieldMeta?.readOnly) {
    return {
      backgroundColor: FILLED_FIELD_BACKGROUND,
      borderColor: 'rgb(176, 176, 176)',
      borderWidth: 2,
      borderRadius: 2,
    };
  }

  if (field.inserted) {
    if (isRequired) {
      return {
        backgroundColor: FILLED_FIELD_BACKGROUND,
        borderColor: isEditing ? requiredBorderHoverColor : requiredBorderColor,
        borderHoverColor: requiredBorderHoverColor,
        borderWidth: requiredBorderWidth,
        borderRadius: 2,
        showAccentRing: isEditing,
        accentRingColor: isEditing ? requiredBorderHoverColor : undefined,
      };
    }

    return {
      backgroundColor: FILLED_FIELD_BACKGROUND,
      borderColor: isEditing ? optionalBorderHoverColor : optionalBorderColor,
      borderHoverColor: optionalBorderHoverColor,
      borderWidth: optionalBorderWidth,
      borderRadius: 2,
      showAccentRing: isEditing,
      accentRingColor: isEditing
        ? colorToCanvasColor(colors.fieldOptionalCardBorderHover, OPTIONAL_FIELD_SIDE_BORDER_OPACITY)
        : undefined,
    };
  }

  const isValidating = Boolean(field.isValidating && isRequired);

  if (isValidating) {
    return {
      backgroundColor: TRANSPARENT_BACKGROUND,
      borderColor: colorToCanvasColor(colors.fieldValidationCardBorder),
      borderWidth: requiredBorderWidth + 1,
      borderRadius: 2,
    };
  }

  if (isRequired) {
    return {
      backgroundColor: colorToCanvasColor(colors.fieldRequiredCard, 0.9),
      borderColor: isEditing ? requiredBorderHoverColor : requiredBorderColor,
      borderHoverColor: requiredBorderHoverColor,
      borderWidth: requiredBorderWidth,
      borderRadius: 2,
      showAccentRing: isEditing,
      accentRingColor: isEditing ? requiredBorderHoverColor : undefined,
    };
  }

  if (isEditing) {
    return {
      backgroundColor: colorToCanvasColor(colors.fieldOptionalCard, 0.9),
      borderRadius: 2,
      ...optionalHoverSideStyle,
    };
  }

  return {
    backgroundColor: colorToCanvasColor(colors.fieldOptionalCard, 0.9),
    borderColor: optionalBorderColor,
    borderHoverColor: optionalBorderHoverColor,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: optionalBorderWidth,
    borderLeftWidth: 0,
    borderRadius: 2,
    hoverBorderTopWidth: optionalHoverSideStyle.borderTopWidth,
    hoverBorderRightWidth: optionalHoverSideStyle.borderRightWidth,
    hoverBorderBottomWidth: optionalHoverSideStyle.borderBottomWidth,
    hoverBorderLeftWidth: optionalHoverSideStyle.borderLeftWidth,
    hoverBorderTopColor: optionalHoverSideStyle.borderTopColor,
    hoverBorderRightColor: optionalHoverSideStyle.borderRightColor,
    hoverBorderBottomColor: optionalHoverSideStyle.borderBottomColor,
    hoverBorderLeftColor: optionalHoverSideStyle.borderLeftColor,
  };
};

export const getSigningFieldHighlightCacheKey = (brandingColors: TCssVarsSchema | null | undefined) => {
  const colors = resolveSigningFieldHighlightColors(brandingColors);

  return SIGNING_FIELD_HIGHLIGHT_COLOR_KEYS.map((key) => colors[key] ?? '').join(':');
};

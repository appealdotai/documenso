import type { TCssVarsSchema } from '@documenso/lib/types/css-vars';
import { isRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import {
  getSigningFieldHighlightCacheKey,
  resolveFieldCanvasStyleFromBrandingColors,
} from '@documenso/lib/utils/signing-field-highlight-colors';
import {
  FIELD_PROBE_ANCHOR_SELECTOR,
  FIELD_ROOT_CONTAINER_PROBE_CLASS_NAME,
} from '@documenso/ui/lib/field-root-container-classes';
import type { Field } from '@prisma/client';
import { colord } from 'colord';
import type { FieldCanvasStyle, FieldRenderMode, FieldToRender } from './field-renderer';

export type FieldCanvasStyleCache = Map<string, FieldCanvasStyle | undefined>;

export const createFieldCanvasStyleCache = (): FieldCanvasStyleCache => new Map();

export const getFieldCanvasStyleCacheKey = (field: FieldToRender) => {
  const isRequired = !field.fieldMeta?.readOnly && isRequiredField(field as unknown as Field);

  return `${field.type}:${field.inserted}:${field.fieldMeta?.readOnly ?? false}:${field.isValidating ?? false}:${field.isEditing ?? false}:${isRequired ? 'required' : 'optional'}`;
};

export const getPixelValue = (value: string) => {
  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue)) {
    return undefined;
  }

  return parsedValue;
};

export const getOpacityValue = (value: string) => {
  const parsedValue = Number.parseFloat(value);

  if (!Number.isFinite(parsedValue) || parsedValue === 1) {
    return undefined;
  }

  return Math.max(0, Math.min(parsedValue, 1));
};

// Canonical value Konva paints as fully transparent. We normalize transparent
// inputs to this so the renderer can tell "customer asked for transparent"
// (honored — paint nothing) apart from "no custom style" (undefined — fall back
// to the renderer default).
export const TRANSPARENT_COLOR = 'rgba(0, 0, 0, 0)';

export const getRenderableColor = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const color = colord(value);

  // Unparseable input (e.g. `none`) has no canvas meaning, so fall back to the
  // renderer defaults. Inputs come from `getComputedStyle`, which normalizes to
  // `rgb()`/`rgba()`, so the base colord parser (no named-colors plugin) is
  // sufficient here. The `transparent` keyword is the one exception colord
  // reports as invalid; we treat it as an explicit transparent request.
  if (!color.isValid()) {
    return value.trim().toLowerCase() === 'transparent' ? TRANSPARENT_COLOR : undefined;
  }

  // A fully transparent color is a deliberate choice — honor it by painting
  // nothing rather than falling back to the default background/border.
  if (color.alpha() === 0) {
    return TRANSPARENT_COLOR;
  }

  return value;
};

/**
 * Build a throwaway field container that mirrors the real `FieldRootContainer`
 * (same classes + data attributes) so we can read whatever the active embed CSS
 * resolves for this field's state.
 *
 * `transition` is disabled because we read the computed style synchronously right
 * after attaching — leaving transitions on would surface mid-animation values.
 * `visibility: hidden` + zero size keep it invisible and out of layout flow
 * without using `display: none`, which would prevent border/background resolution.
 */
const createFieldProbeElement = (field: FieldToRender): HTMLElement => {
  const $probe = document.createElement('div');

  $probe.className = FIELD_ROOT_CONTAINER_PROBE_CLASS_NAME;
  $probe.setAttribute('aria-hidden', 'true');

  $probe.dataset.fieldType = field.type;
  $probe.dataset.inserted = field.inserted ? 'true' : 'false';
  $probe.dataset.validate = field.isValidating ? 'true' : 'false';
  $probe.dataset.readonly = field.fieldMeta?.readOnly ? 'true' : 'false';
  $probe.dataset.editing = field.isEditing ? 'true' : 'false';
  $probe.dataset.fieldRequired =
    !field.fieldMeta?.readOnly && isRequiredField(field as unknown as Field) ? 'true' : 'false';

  Object.assign($probe.style, {
    position: 'absolute',
    width: '48px',
    height: '24px',
    overflow: 'hidden',
    pointerEvents: 'none',
    visibility: 'hidden',
    transition: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  return $probe;
};

const getCssVarHslColor = (element: Element, variableName: string, alpha?: number) => {
  const value = getComputedStyle(element).getPropertyValue(variableName).trim();

  if (!value) {
    return undefined;
  }

  // Variables that already carry alpha (`h s% l% / a`) must not gain a second
  // `/ alpha` — that produces invalid CSS.
  if (value.includes('/')) {
    return `hsl(${value})`;
  }

  if (alpha !== undefined) {
    return `hsl(${value} / ${alpha})`;
  }

  return `hsl(${value})`;
};

const OPTIONAL_FIELD_SIDE_BORDER_OPACITY = 0.4;

const resolveFieldCanvasStyleFromCssVars = (field: FieldToRender): FieldCanvasStyle | undefined => {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const $styleSource = document.querySelector('.documenso-branded') ?? document.documentElement;
  const isRequired = isRequiredField(field as unknown as Field);
  const isEditing = Boolean(field.isEditing);
  const requiredBorderWidth =
    getPixelValue(
      getComputedStyle($styleSource).getPropertyValue('--field-required-card-border-width').trim() || '2px',
    ) ?? 2;
  const requiredFilledBorderWidth =
    getPixelValue(
      getComputedStyle($styleSource).getPropertyValue('--field-required-filled-card-border-width').trim() || '2px',
    ) ?? 2;
  const optionalBorderWidth =
    getPixelValue(
      getComputedStyle($styleSource).getPropertyValue('--field-optional-card-border-width').trim() || '2px',
    ) ?? 2;
  const optionalFilledBorderWidth =
    getPixelValue(
      getComputedStyle($styleSource).getPropertyValue('--field-optional-filled-card-border-width').trim() || '2px',
    ) ?? 2;
  const requiredBorderColor = getRenderableColor(getCssVarHslColor($styleSource, '--field-required-card-border'));
  const requiredBorderHoverColor = getRenderableColor(
    getCssVarHslColor($styleSource, '--field-required-card-border-hover'),
  );
  const requiredFilledBorderColor = getRenderableColor(
    getCssVarHslColor($styleSource, '--field-required-filled-card-border'),
  );
  const requiredFilledBorderHoverColor = getRenderableColor(
    getCssVarHslColor($styleSource, '--field-required-filled-card-border-hover'),
  );
  const optionalBorderColor = getRenderableColor(getCssVarHslColor($styleSource, '--field-optional-card-border'));
  const optionalBorderHoverColor = getRenderableColor(
    getCssVarHslColor($styleSource, '--field-optional-card-border-hover'),
  );
  const optionalFilledBorderColor = getRenderableColor(
    getCssVarHslColor($styleSource, '--field-optional-filled-card-border'),
  );
  const optionalFilledBorderHoverColor = getRenderableColor(
    getCssVarHslColor($styleSource, '--field-optional-filled-card-border-hover'),
  );
  const optionalSideHoverColor = getRenderableColor(
    getCssVarHslColor($styleSource, '--field-optional-card-border-hover', OPTIONAL_FIELD_SIDE_BORDER_OPACITY),
  );
  const optionalFilledSideHoverColor = getRenderableColor(
    getCssVarHslColor($styleSource, '--field-optional-filled-card-border-hover', OPTIONAL_FIELD_SIDE_BORDER_OPACITY),
  );
  const readOnlyBackground = 'rgba(255, 255, 255, 0.9)';
  const optionalHoverSideStyle = {
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: optionalBorderWidth + 1,
    borderLeftWidth: 1,
    borderTopColor: optionalSideHoverColor,
    borderRightColor: optionalSideHoverColor,
    borderBottomColor: optionalBorderHoverColor,
    borderLeftColor: optionalSideHoverColor,
    borderColor: optionalBorderHoverColor,
    borderHoverColor: optionalBorderHoverColor,
  };

  if (field.fieldMeta?.readOnly) {
    return {
      backgroundColor: readOnlyBackground,
      borderColor: 'rgb(176, 176, 176)',
      borderWidth: 2,
      borderRadius: 2,
    };
  }

  if (field.inserted) {
    if (isRequired) {
      return {
        backgroundColor: getRenderableColor(getCssVarHslColor($styleSource, '--field-required-filled-card')),
        borderColor: isEditing ? requiredFilledBorderHoverColor : requiredFilledBorderColor,
        borderHoverColor: requiredFilledBorderHoverColor,
        borderWidth: requiredFilledBorderWidth,
        borderRadius: 2,
        showAccentRing: isEditing,
        accentRingColor: isEditing ? requiredFilledBorderHoverColor : undefined,
      };
    }

    return {
      backgroundColor: getRenderableColor(getCssVarHslColor($styleSource, '--field-optional-filled-card')),
      borderColor: isEditing ? optionalFilledBorderHoverColor : optionalFilledBorderColor,
      borderHoverColor: optionalFilledBorderHoverColor,
      borderWidth: optionalFilledBorderWidth,
      borderRadius: 2,
      showAccentRing: isEditing,
      accentRingColor: isEditing ? optionalFilledSideHoverColor : undefined,
    };
  }

  const isValidating = Boolean(field.isValidating && isRequired);

  if (isValidating) {
    return {
      backgroundColor: TRANSPARENT_COLOR,
      borderColor: getRenderableColor(getCssVarHslColor($styleSource, '--field-validation-card-border')),
      borderWidth: requiredBorderWidth + 1,
      borderRadius: 2,
    };
  }

  if (isRequired) {
    return {
      backgroundColor: getRenderableColor(getCssVarHslColor($styleSource, '--field-required-card')),
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
      backgroundColor: getRenderableColor(getCssVarHslColor($styleSource, '--field-optional-card')),
      borderRadius: 2,
      ...optionalHoverSideStyle,
    };
  }

  return {
    backgroundColor: getRenderableColor(getCssVarHslColor($styleSource, '--field-optional-card')),
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

const mergeFieldCanvasStyles = (
  primary: FieldCanvasStyle | undefined,
  fallback: FieldCanvasStyle | undefined,
): FieldCanvasStyle | undefined => {
  if (!primary && !fallback) {
    return undefined;
  }

  return {
    backgroundColor: primary?.backgroundColor ?? fallback?.backgroundColor,
    borderColor: primary?.borderColor ?? fallback?.borderColor,
    borderHoverColor: primary?.borderHoverColor ?? fallback?.borderHoverColor,
    borderRadius: primary?.borderRadius ?? fallback?.borderRadius,
    borderWidth: primary?.borderWidth ?? fallback?.borderWidth,
    borderTopWidth: primary?.borderTopWidth ?? fallback?.borderTopWidth,
    borderRightWidth: primary?.borderRightWidth ?? fallback?.borderRightWidth,
    borderBottomWidth: primary?.borderBottomWidth ?? fallback?.borderBottomWidth,
    borderLeftWidth: primary?.borderLeftWidth ?? fallback?.borderLeftWidth,
    borderTopColor: primary?.borderTopColor ?? fallback?.borderTopColor,
    borderRightColor: primary?.borderRightColor ?? fallback?.borderRightColor,
    borderBottomColor: primary?.borderBottomColor ?? fallback?.borderBottomColor,
    borderLeftColor: primary?.borderLeftColor ?? fallback?.borderLeftColor,
    showAccentRing: primary?.showAccentRing ?? fallback?.showAccentRing,
    accentRingColor: primary?.accentRingColor ?? fallback?.accentRingColor,
    hoverBorderTopWidth: primary?.hoverBorderTopWidth ?? fallback?.hoverBorderTopWidth,
    hoverBorderRightWidth: primary?.hoverBorderRightWidth ?? fallback?.hoverBorderRightWidth,
    hoverBorderBottomWidth: primary?.hoverBorderBottomWidth ?? fallback?.hoverBorderBottomWidth,
    hoverBorderLeftWidth: primary?.hoverBorderLeftWidth ?? fallback?.hoverBorderLeftWidth,
    hoverBorderTopColor: primary?.hoverBorderTopColor ?? fallback?.hoverBorderTopColor,
    hoverBorderRightColor: primary?.hoverBorderRightColor ?? fallback?.hoverBorderRightColor,
    hoverBorderBottomColor: primary?.hoverBorderBottomColor ?? fallback?.hoverBorderBottomColor,
    hoverBorderLeftColor: primary?.hoverBorderLeftColor ?? fallback?.hoverBorderLeftColor,
    opacity: primary?.opacity ?? fallback?.opacity,
  };
};

const computeFieldCanvasStyleFromProbe = (field: FieldToRender): FieldCanvasStyle | undefined => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return undefined;
  }

  // The probe must be appended inside the same subtree as the real fields so it
  // inherits the identical CSS cascade. Custom embed CSS is typically scoped
  // under `.embed--DocumentContainer`; appending to `document.body` would resolve
  // a different (wrong) cascade. Fall back to `.documenso-branded` on recipient
  // routes when the document container is not present.
  const $anchor = document.querySelector(FIELD_PROBE_ANCHOR_SELECTOR);

  if (!$anchor) {
    return undefined;
  }

  const $probe = createFieldProbeElement(field);

  $anchor.appendChild($probe);

  try {
    const computedStyle = window.getComputedStyle($probe);
    const borderTopWidth = getPixelValue(computedStyle.borderTopWidth) ?? 0;
    const borderRightWidth = getPixelValue(computedStyle.borderRightWidth) ?? 0;
    const borderBottomWidth = getPixelValue(computedStyle.borderBottomWidth) ?? 0;
    const borderLeftWidth = getPixelValue(computedStyle.borderLeftWidth) ?? 0;
    const maxBorderWidth = Math.max(borderTopWidth, borderRightWidth, borderBottomWidth, borderLeftWidth);
    const isUniformBorder =
      borderTopWidth === borderRightWidth &&
      borderRightWidth === borderBottomWidth &&
      borderBottomWidth === borderLeftWidth;
    const borderColor = getRenderableColor(
      borderBottomWidth > 0
        ? computedStyle.borderBottomColor
        : borderTopWidth > 0
          ? computedStyle.borderTopColor
          : borderRightWidth > 0
            ? computedStyle.borderRightColor
            : computedStyle.borderLeftColor,
    );
    const hasBorderStyle =
      maxBorderWidth > 0 &&
      [
        computedStyle.borderTopStyle,
        computedStyle.borderRightStyle,
        computedStyle.borderBottomStyle,
        computedStyle.borderLeftStyle,
      ].some((style) => style !== 'none');
    const borderRadius = getPixelValue(computedStyle.borderTopLeftRadius);

    return {
      backgroundColor: getRenderableColor(computedStyle.backgroundColor),
      borderColor: hasBorderStyle ? borderColor : undefined,
      borderRadius,
      borderWidth: hasBorderStyle && isUniformBorder ? maxBorderWidth : undefined,
      borderTopWidth: hasBorderStyle && !isUniformBorder ? borderTopWidth : undefined,
      borderRightWidth: hasBorderStyle && !isUniformBorder ? borderRightWidth : undefined,
      borderBottomWidth: hasBorderStyle && !isUniformBorder ? borderBottomWidth : undefined,
      borderLeftWidth: hasBorderStyle && !isUniformBorder ? borderLeftWidth : undefined,
      opacity: getOpacityValue(computedStyle.opacity),
    };
  } finally {
    $probe.remove();
  }
};

/**
 * Resolve the canvas style for a field by reading a throwaway probe element's
 * computed CSS.
 *
 * Sign-mode only — the editor and export views intentionally use the renderer
 * defaults. Reads are cache-gated, so the probe is created/removed at most once
 * per unique field state per render pass.
 */
export const resolveFieldCanvasStyle = (
  field: FieldToRender,
  mode: FieldRenderMode,
  cache?: FieldCanvasStyleCache,
  brandingColors?: TCssVarsSchema | null,
): FieldCanvasStyle | undefined => {
  if (mode !== 'sign') {
    return undefined;
  }

  const cacheKey = `${getFieldCanvasStyleCacheKey(field)}:${getSigningFieldHighlightCacheKey(brandingColors)}`;

  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const brandingStyle = resolveFieldCanvasStyleFromBrandingColors(field, brandingColors);
  const probeStyle = computeFieldCanvasStyleFromProbe(field);
  const cssVarStyle = resolveFieldCanvasStyleFromCssVars(field);
  const style = mergeFieldCanvasStyles(brandingStyle, mergeFieldCanvasStyles(probeStyle, cssVarStyle));

  cache?.set(cacheKey, style);

  return style;
};

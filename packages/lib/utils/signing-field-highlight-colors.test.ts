import { describe, expect, it } from 'vitest';

import { DEFAULT_BRAND_COLORS } from '../constants/theme';
import {
  hasExplicitAlphaChannel,
  normalizeSigningFieldHighlightColor,
  resolveFieldCanvasStyleFromBrandingColors,
  resolveSigningFieldHighlightColors,
} from './signing-field-highlight-colors';

describe('hasExplicitAlphaChannel', () => {
  it('detects 8-digit and 4-digit hex', () => {
    expect(hasExplicitAlphaChannel('#e2f8d3e6')).toBe(true);
    expect(hasExplicitAlphaChannel('#e2f8d3ff')).toBe(true);
    expect(hasExplicitAlphaChannel('#e2f8')).toBe(true);
  });

  it('detects rgba/hsla and modern slash syntax', () => {
    expect(hasExplicitAlphaChannel('rgba(226, 248, 211, 0.9)')).toBe(true);
    expect(hasExplicitAlphaChannel('rgb(226 248 211 / 0.9)')).toBe(true);
    expect(hasExplicitAlphaChannel('hsl(95 74% 90% / 0.5)')).toBe(true);
  });

  it('treats opaque 6-digit hex as legacy (no explicit alpha)', () => {
    expect(hasExplicitAlphaChannel('#e2f8d3')).toBe(false);
    expect(hasExplicitAlphaChannel('#fff')).toBe(false);
  });
});

describe('normalizeSigningFieldHighlightColor', () => {
  it('applies legacy 0.9 alpha to opaque background colours', () => {
    expect(normalizeSigningFieldHighlightColor('fieldRequiredCard', '#e2f8d3')).toBe('#e2f8d3e6');
    expect(normalizeSigningFieldHighlightColor('fieldOptionalCard', '#ffffff')).toBe('#ffffffe6');
  });

  it('preserves explicit alpha on backgrounds', () => {
    expect(normalizeSigningFieldHighlightColor('fieldRequiredCard', '#e2f8d3ff')).toBe('#e2f8d3ff');
    expect(normalizeSigningFieldHighlightColor('fieldRequiredCard', '#e2f8d380')).toBe('#e2f8d380');
  });

  it('does not alter border tokens', () => {
    expect(normalizeSigningFieldHighlightColor('fieldRequiredCardBorder', '#a2e771')).toBe('#a2e771');
  });

  it('applies legacy 0.9 alpha to filled background colours', () => {
    expect(normalizeSigningFieldHighlightColor('fieldRequiredFilledCard', '#ffffff')).toBe('#ffffffe6');
    expect(normalizeSigningFieldHighlightColor('fieldOptionalFilledCard', '#aabbcc')).toBe('#aabbcce6');
  });
});

describe('resolveSigningFieldHighlightColors', () => {
  it('uses defaults with baked-in background opacity', () => {
    const resolved = resolveSigningFieldHighlightColors(null);

    expect(resolved.fieldRequiredCard).toBe(DEFAULT_BRAND_COLORS.fieldRequiredCard);
    expect(resolved.fieldOptionalCard).toBe(DEFAULT_BRAND_COLORS.fieldOptionalCard);
    expect(resolved.fieldRequiredFilledCard).toBe(DEFAULT_BRAND_COLORS.fieldRequiredFilledCard);
    expect(resolved.fieldOptionalFilledCard).toBe(DEFAULT_BRAND_COLORS.fieldOptionalFilledCard);
  });

  it('normalises legacy opaque background overrides', () => {
    const resolved = resolveSigningFieldHighlightColors({
      fieldRequiredCard: '#aabbcc',
      fieldRequiredFilledCard: '#112233',
    });

    expect(resolved.fieldRequiredCard).toBe('#aabbcce6');
    expect(resolved.fieldRequiredFilledCard).toBe('#112233e6');
  });
});

describe('resolveFieldCanvasStyleFromBrandingColors', () => {
  it('uses colour alpha for required unsigned field backgrounds', () => {
    const style = resolveFieldCanvasStyleFromBrandingColors(
      {
        type: 'SIGNATURE',
        inserted: false,
        fieldMeta: null,
      },
      {
        fieldRequiredCard: '#e2f8d380',
      },
    );

    expect(style?.backgroundColor).toBe('rgba(226, 248, 211, 0.5)');
  });

  it('applies legacy 0.9 when background is opaque 6-digit hex', () => {
    const style = resolveFieldCanvasStyleFromBrandingColors(
      {
        type: 'SIGNATURE',
        inserted: false,
        fieldMeta: null,
      },
      {
        fieldRequiredCard: '#e2f8d3',
      },
    );

    expect(style?.backgroundColor).toBe('rgba(226, 248, 211, 0.9)');
  });

  it('uses required filled tokens for inserted required fields', () => {
    const style = resolveFieldCanvasStyleFromBrandingColors(
      {
        type: 'SIGNATURE',
        inserted: true,
        fieldMeta: null,
      },
      {
        fieldRequiredFilledCard: '#ff000080',
        fieldRequiredFilledCardBorder: '#00ff00',
        fieldRequiredFilledCardBorderWidth: '4px',
      },
    );

    expect(style?.backgroundColor).toBe('rgba(255, 0, 0, 0.5)');
    expect(style?.borderColor).toBe('rgb(0, 255, 0)');
    expect(style?.borderWidth).toBe(4);
  });

  it('uses optional filled tokens for inserted optional fields', () => {
    const style = resolveFieldCanvasStyleFromBrandingColors(
      {
        type: 'TEXT',
        inserted: true,
        fieldMeta: { required: false },
      },
      {
        fieldOptionalFilledCard: '#0000ff80',
        fieldOptionalFilledCardBorder: '#ff00ff',
        fieldOptionalFilledCardBorderWidth: '3px',
      },
    );

    expect(style?.backgroundColor).toBe('rgba(0, 0, 255, 0.5)');
    expect(style?.borderColor).toBe('rgb(255, 0, 255)');
    expect(style?.borderTopWidth).toBe(0);
    expect(style?.borderRightWidth).toBe(0);
    expect(style?.borderBottomWidth).toBe(3);
    expect(style?.borderLeftWidth).toBe(0);
  });
});

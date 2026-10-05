import { describe, expect, it } from 'vitest';

import {
  FIELD_SHAPE_META_DEFAULT_VALUES,
  ZFieldMetaSchema,
  ZShapeFieldMeta,
  ZShapeFieldMetaLenientSchema,
} from './field-meta';

describe('ZShapeFieldMeta', () => {
  it('should apply shape defaults', () => {
    expect(ZShapeFieldMeta.parse({ type: 'shape' })).toEqual({
      type: 'shape',
      shape: 'rectangle',
      fillColor: null,
      fillOpacity: 1,
      borderColor: '#000000',
      borderWidth: 2,
      borderStyle: 'solid',
      cornerRadius: 0,
    });
  });

  it('should accept valid 6-digit hex colors', () => {
    const result = ZShapeFieldMeta.safeParse({
      type: 'shape',
      fillColor: '#ff0000',
      borderColor: '#00FF00',
    });

    expect(result.success).toBe(true);
  });

  it('should reject invalid colors', () => {
    for (const fillColor of ['red', '#fff', '#ff000080', 'transparent', '']) {
      const result = ZShapeFieldMeta.safeParse({ type: 'shape', fillColor });

      expect(result.success).toBe(false);
    }
  });

  it('should reject out of range border widths and corner radii', () => {
    expect(ZShapeFieldMeta.safeParse({ type: 'shape', borderWidth: -1 }).success).toBe(false);
    expect(ZShapeFieldMeta.safeParse({ type: 'shape', borderWidth: 21 }).success).toBe(false);
    expect(ZShapeFieldMeta.safeParse({ type: 'shape', borderWidth: 0 }).success).toBe(true);
    expect(ZShapeFieldMeta.safeParse({ type: 'shape', cornerRadius: 101 }).success).toBe(false);
  });

  it('should reject out of range fill opacity', () => {
    expect(ZShapeFieldMeta.safeParse({ type: 'shape', fillOpacity: -0.1 }).success).toBe(false);
    expect(ZShapeFieldMeta.safeParse({ type: 'shape', fillOpacity: 1.5 }).success).toBe(false);
    expect(ZShapeFieldMeta.safeParse({ type: 'shape', fillOpacity: 0 }).success).toBe(true);
  });

  it('should parse through the generic field meta schema', () => {
    const result = ZFieldMetaSchema.safeParse({
      type: 'shape',
      shape: 'ellipse',
      fillColor: '#00ff00',
      borderColor: '#0000ff',
      borderWidth: 4,
    });

    expect(result.success).toBe(true);
  });

  it('should normalize legacy shape meta', () => {
    const result = ZShapeFieldMetaLenientSchema.safeParse({
      type: 'shape',
      shapeKind: 'ellipse',
      fillColor: 'transparent',
      borderColor: '#00000080',
      borderWidth: 3,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      type: 'shape',
      shape: 'ellipse',
      fillColor: null,
      borderColor: '#000000',
      borderWidth: 3,
    });
  });

  it('should expose matching default values', () => {
    expect(FIELD_SHAPE_META_DEFAULT_VALUES).toEqual({
      type: 'shape',
      shape: 'rectangle',
      fillColor: null,
      fillOpacity: 1,
      borderColor: '#000000',
      borderWidth: 2,
      borderStyle: 'solid',
      cornerRadius: 0,
    });
  });
});

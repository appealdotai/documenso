import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { getOverlappingFieldPairs, hasOverlappingFields } from './fields-overlap';

const makeField = (id: string | number, type: FieldType, positionX = 10, positionY = 10) => ({
  id,
  type,
  envelopeItemId: 'item-1',
  page: 1,
  positionX,
  positionY,
  width: 20,
  height: 20,
});

describe('getOverlappingFieldPairs', () => {
  it('should flag two overlapping signer fields', () => {
    const pairs = getOverlappingFieldPairs([makeField('a', FieldType.TEXT), makeField('b', FieldType.TEXT, 12, 12)]);

    expect(pairs).toHaveLength(1);
  });

  it('should ignore pairs involving a shape in either direction', () => {
    const shapeOverField = getOverlappingFieldPairs([
      makeField('a', FieldType.SHAPE),
      makeField('b', FieldType.TEXT, 12, 12),
    ]);
    const fieldOverShape = getOverlappingFieldPairs([
      makeField('a', FieldType.TEXT),
      makeField('b', FieldType.SHAPE, 12, 12),
    ]);
    const shapeOverShape = getOverlappingFieldPairs([
      makeField('a', FieldType.SHAPE),
      makeField('b', FieldType.SHAPE, 12, 12),
    ]);

    expect(shapeOverField).toHaveLength(0);
    expect(fieldOverShape).toHaveLength(0);
    expect(shapeOverShape).toHaveLength(0);
  });

  it('should still flag signer field pairs when a shape is present', () => {
    const pairs = getOverlappingFieldPairs([
      makeField('a', FieldType.SHAPE, 12, 12),
      makeField('b', FieldType.TEXT),
      makeField('c', FieldType.TEXT, 12, 12),
    ]);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].fieldA.id).toBe('b');
    expect(pairs[0].fieldB.id).toBe('c');
  });
});

describe('hasOverlappingFields', () => {
  it('should return false when only a shape overlaps', () => {
    expect(hasOverlappingFields([makeField('a', FieldType.SHAPE), makeField('b', FieldType.TEXT, 12, 12)])).toBe(false);
  });
});

import { FieldType } from '@prisma/client';
import { assert, describe, expect, it } from 'vitest';

import { renumberFieldOrder, reorderFieldsByDirection, type TLocalField } from './use-editor-fields';

const makeField = (formId: string, order: number): TLocalField => ({
  formId,
  envelopeItemId: 'item-1',
  type: FieldType.TEXT,
  recipientId: 1,
  page: 1,
  positionX: 0,
  positionY: 0,
  width: 10,
  height: 10,
  order,
  fieldMeta: undefined,
});

const orderedIds = (fields: TLocalField[] | null) => {
  assert(fields, 'expected reorder to produce fields');

  return fields.map((field) => field.formId);
};

describe('renumberFieldOrder', () => {
  it('should number fields sequentially from the array position', () => {
    const result = renumberFieldOrder([makeField('a', 5), makeField('b', 2)]);

    expect(result.map((field) => field.order)).toEqual([0, 1]);
  });
});

describe('reorderFieldsByDirection', () => {
  it('should move a field to the front', () => {
    const fields = [makeField('a', 0), makeField('b', 1), makeField('c', 2)];

    expect(orderedIds(reorderFieldsByDirection(fields, ['a'], 'front'))).toEqual(['b', 'c', 'a']);
  });

  it('should move a field to the back', () => {
    const fields = [makeField('a', 0), makeField('b', 1), makeField('c', 2)];

    expect(orderedIds(reorderFieldsByDirection(fields, ['c'], 'back'))).toEqual(['c', 'a', 'b']);
  });

  it('should move a field one step forward', () => {
    const fields = [makeField('a', 0), makeField('b', 1), makeField('c', 2)];

    expect(orderedIds(reorderFieldsByDirection(fields, ['a'], 'forward'))).toEqual(['b', 'a', 'c']);
  });

  it('should not move past the ends', () => {
    const fields = [makeField('a', 0), makeField('b', 1)];

    expect(orderedIds(reorderFieldsByDirection(fields, ['b'], 'forward'))).toEqual(['a', 'b']);
    expect(orderedIds(reorderFieldsByDirection(fields, ['a'], 'backward'))).toEqual(['a', 'b']);
  });

  it('should keep a multi-select block together', () => {
    const fields = [makeField('a', 0), makeField('b', 1), makeField('c', 2), makeField('d', 3)];

    expect(orderedIds(reorderFieldsByDirection(fields, ['b', 'c'], 'front'))).toEqual(['a', 'd', 'b', 'c']);
    expect(orderedIds(reorderFieldsByDirection(fields, ['b', 'c'], 'forward'))).toEqual(['a', 'd', 'b', 'c']);
  });

  it('should return null when nothing is selected', () => {
    const fields = [makeField('a', 0)];

    expect(reorderFieldsByDirection(fields, ['missing'], 'front')).toBeNull();
  });
});

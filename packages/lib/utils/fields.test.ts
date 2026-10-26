import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  compareFieldsByStackOrder,
  getFieldInsertedStatus,
  isFieldInsertedForCompletion,
  isShapeField,
  sortFieldsByStackOrder,
} from './fields';

describe('shape field insertion helpers', () => {
  it('identifies shape fields', () => {
    expect(isShapeField({ type: FieldType.SHAPE })).toBe(true);
    expect(isShapeField({ type: FieldType.TEXT })).toBe(false);
  });

  it('always marks shapes as inserted', () => {
    expect(getFieldInsertedStatus(FieldType.SHAPE)).toBe(true);
    expect(getFieldInsertedStatus(FieldType.SHAPE, false)).toBe(true);
    expect(getFieldInsertedStatus(FieldType.TEXT)).toBe(false);
    expect(getFieldInsertedStatus(FieldType.TEXT, true)).toBe(true);
  });

  it('includes legacy uninserted shapes during completion', () => {
    expect(isFieldInsertedForCompletion({ type: FieldType.SHAPE, inserted: false })).toBe(true);
    expect(isFieldInsertedForCompletion({ type: FieldType.TEXT, inserted: false })).toBe(false);
    expect(isFieldInsertedForCompletion({ type: FieldType.TEXT, inserted: true })).toBe(true);
  });
});

describe('sortFieldsByStackOrder', () => {
  it('sorts by order and then by id', () => {
    const fields = [
      { id: 3, order: 1 },
      { id: 1, order: 2 },
      { id: 2, order: 1 },
    ];

    expect(sortFieldsByStackOrder(fields).map((field) => field.id)).toEqual([2, 3, 1]);
  });

  it('uses formId as a stable fallback for unsaved fields', () => {
    const fields = [
      { formId: 'b', order: 0 },
      { formId: 'a', order: 0 },
    ];

    expect(sortFieldsByStackOrder(fields).map((field) => field.formId)).toEqual(['a', 'b']);
  });

  it('does not mutate the input', () => {
    const fields = [
      { id: 2, order: 1 },
      { id: 1, order: 0 },
    ];

    sortFieldsByStackOrder(fields);

    expect(fields.map((field) => field.id)).toEqual([2, 1]);
  });

  it('exposes the comparator for callers that already have a sorted pipeline', () => {
    expect(compareFieldsByStackOrder({ id: 1, order: 0 }, { id: 2, order: 0 })).toBeLessThan(0);
  });
});

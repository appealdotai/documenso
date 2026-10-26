import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { withEnvelopeShapes } from './get-envelope-for-recipient-signing';

type TestField = {
  type: FieldType;
  recipientId: number;
  id: number;
};

const shapeField = (id: number, recipientId: number): TestField => ({
  type: FieldType.SHAPE,
  recipientId,
  id,
});

const textField = (id: number, recipientId: number): TestField => ({
  type: FieldType.TEXT,
  recipientId,
  id,
});

describe('withEnvelopeShapes', () => {
  it('should append shapes owned by other recipients', () => {
    const recipient = { id: 1, fields: [textField(10, 1)] };
    const recipients = [
      { id: 1, fields: [textField(10, 1)] },
      { id: 2, fields: [shapeField(20, 2)] },
    ];

    const result = withEnvelopeShapes(recipient, recipients);

    expect(result.fields.map((field) => field.id)).toEqual([10, 20]);
  });

  it('should keep the recipient own shapes without duplicating them', () => {
    const recipient = { id: 1, fields: [shapeField(20, 1)] };
    const recipients = [{ id: 1, fields: [shapeField(20, 1)] }];

    const result = withEnvelopeShapes(recipient, recipients);

    expect(result.fields.map((field) => field.id)).toEqual([20]);
  });

  it('should not append non-shape fields owned by other recipients', () => {
    const recipient: { id: number; fields: TestField[] } = { id: 1, fields: [] };
    const recipients = [
      { id: 1, fields: [] },
      { id: 2, fields: [textField(30, 2), shapeField(20, 2)] },
    ];

    const result = withEnvelopeShapes(recipient, recipients);

    expect(result.fields.map((field) => field.id)).toEqual([20]);
  });
});

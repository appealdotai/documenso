import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import type { TNumberFieldMeta } from '@documenso/lib/types/field-meta';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

export const getNumberFieldDefaultValue = ({
  field,
  number = null,
}: {
  field: {
    customText?: string | null;
    fieldMeta?: TNumberFieldMeta | null;
  };
  number?: string | null;
}): string => {
  if (field.customText) {
    return field.customText;
  }

  if (number) {
    return number;
  }

  if (field.fieldMeta?.value !== undefined && field.fieldMeta?.value !== null) {
    return String(field.fieldMeta.value);
  }

  return '';
};

export const validateInlineNumberFieldValue = (value: string, fieldMeta?: TNumberFieldMeta | null): string[] => {
  return validateNumberField(value, fieldMeta ?? undefined, true);
};

export const buildNumberFieldSignPayload = (
  value: string,
): Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.NUMBER }> => {
  return {
    type: FieldType.NUMBER,
    value,
  };
};

/**
 * Validates and builds a NUMBER sign payload.
 * Returns null when validation fails.
 */
export const commitNumberFieldValue = ({
  value,
  fieldMeta,
}: {
  value: string;
  fieldMeta?: TNumberFieldMeta | null;
}): Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.NUMBER }> | null => {
  const errors = validateInlineNumberFieldValue(value, fieldMeta);

  if (errors.length > 0) {
    return null;
  }

  return buildNumberFieldSignPayload(value);
};

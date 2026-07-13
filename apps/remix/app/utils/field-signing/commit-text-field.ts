import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import type { TFieldText } from '@documenso/lib/types/field';
import type { TTextFieldMeta } from '@documenso/lib/types/field-meta';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

export const getTextFieldDefaultValue = ({
  field,
  text = null,
}: {
  field: Pick<TFieldText, 'customText' | 'fieldMeta'>;
  text?: string | null;
}): string => {
  return field.customText || text || field.fieldMeta?.text || '';
};

export const validateInlineTextFieldValue = (value: string, fieldMeta?: TTextFieldMeta | null): string[] => {
  if (!fieldMeta) {
    if (!value.trim()) {
      return ['Value is required'];
    }

    return [];
  }

  return validateTextField(value, fieldMeta, true);
};

export const buildTextFieldSignPayload = (
  value: string,
): Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.TEXT }> => {
  return {
    type: FieldType.TEXT,
    value,
  };
};

/**
 * Validates and builds a TEXT sign payload.
 * Returns null when validation fails.
 */
export const commitTextFieldValue = ({
  value,
  fieldMeta,
}: {
  value: string;
  fieldMeta?: TTextFieldMeta | null;
}): Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.TEXT }> | null => {
  const errors = validateInlineTextFieldValue(value, fieldMeta);

  if (errors.length > 0) {
    return null;
  }

  return buildTextFieldSignPayload(value);
};

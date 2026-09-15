import { validateDropdownField } from '@documenso/lib/advanced-fields-validation/validate-dropdown';
import type { TDropdownFieldMeta } from '@documenso/lib/types/field-meta';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

export const getDropdownFieldDefaultValue = ({
  field,
  text = null,
}: {
  field: {
    customText?: string | null;
    fieldMeta?: TDropdownFieldMeta | null;
  };
  text?: string | null;
}): string => {
  return field.customText || text || field.fieldMeta?.defaultValue || '';
};

export const validateInlineDropdownFieldValue = (value: string, fieldMeta?: TDropdownFieldMeta | null): string[] => {
  return validateDropdownField(value, fieldMeta ?? { type: 'dropdown' }, true);
};

export const buildDropdownFieldSignPayload = (
  value: string | null,
): Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.DROPDOWN }> => {
  return {
    type: FieldType.DROPDOWN,
    value,
  };
};

/**
 * Validates and builds a DROPDOWN sign payload.
 * Returns null when validation fails.
 */
export const commitDropdownFieldValue = ({
  value,
  fieldMeta,
}: {
  value: string;
  fieldMeta?: TDropdownFieldMeta | null;
}): Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.DROPDOWN }> | null => {
  const errors = validateInlineDropdownFieldValue(value, fieldMeta);

  if (errors.length > 0) {
    return null;
  }

  return buildDropdownFieldSignPayload(value);
};

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldDropdown } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { buildDropdownFieldSignPayload, getDropdownFieldDefaultValue } from './commit-dropdown-field';

type HandleDropdownFieldClickOptions = {
  field: TFieldDropdown;
  text: string | null;
};

/**
 * Builds a DROPDOWN sign payload when a value is already known.
 * Inline overlay handles interactive selection; this remains for programmatic paths.
 */
export const handleDropdownFieldClick = (
  options: HandleDropdownFieldClickOptions,
): Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.DROPDOWN }> | null => {
  const { field, text } = options;

  if (field.type !== FieldType.DROPDOWN || !field.fieldMeta) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (field.inserted) {
    return {
      type: FieldType.DROPDOWN,
      value: null,
    };
  }

  const textToInsert = text ?? getDropdownFieldDefaultValue({ field, text });

  if (!textToInsert) {
    return null;
  }

  return buildDropdownFieldSignPayload(textToInsert);
};

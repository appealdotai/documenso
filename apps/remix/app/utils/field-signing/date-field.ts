import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldDate } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';
import { DateTime } from 'luxon';

import { buildDateFieldSignPayload, getDateFieldInitialJsDate, jsDateToIsoDate } from './commit-date-field';

type HandleDateFieldClickOptions = {
  field: TFieldDate;
  dateFormat?: string;
};

/**
 * Builds a DATE sign payload from the field's existing/default value.
 * Inline overlay handles interactive selection; this remains for programmatic paths.
 */
export const handleDateFieldClick = (
  options: HandleDateFieldClickOptions,
): Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.DATE }> | null => {
  const { field, dateFormat } = options;

  if (field.type !== FieldType.DATE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  const initialDate = getDateFieldInitialJsDate({
    field: {
      customText: field.customText,
      fieldMeta: field.fieldMeta,
    },
    dateFormat,
  });

  const dateToInsert = initialDate ? jsDateToIsoDate(initialDate) : DateTime.now().toISODate();

  if (!dateToInsert) {
    return null;
  }

  return buildDateFieldSignPayload(dateToInsert);
};

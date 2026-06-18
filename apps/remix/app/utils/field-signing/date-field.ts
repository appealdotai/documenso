import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldDate } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { SignFieldDateDialog } from '~/components/dialogs/sign-field-date-dialog';

type HandleDateFieldClickOptions = {
  field: TFieldDate;
  dateFormat?: string;
};

export const handleDateFieldClick = async (
  options: HandleDateFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.DATE }> | null> => {
  const { field, dateFormat } = options;

  if (field.type !== FieldType.DATE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  const defaultValue = field.customText || field.fieldMeta?.value || '';

  const dateToInsert = await SignFieldDateDialog.call({
    fieldMeta: field.fieldMeta,
    defaultValue,
    dateFormat,
  });

  if (!dateToInsert) {
    return null;
  }

  return {
    type: FieldType.DATE,
    value: dateToInsert,
  };
};

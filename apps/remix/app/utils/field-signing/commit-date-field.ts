import type { TDateFieldMeta } from '@documenso/lib/types/field-meta';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';
import { DateTime } from 'luxon';

export const getDateFieldInitialJsDate = ({
  field,
  dateFormat,
}: {
  field: {
    customText?: string | null;
    fieldMeta?: TDateFieldMeta | null;
  };
  dateFormat?: string;
}): Date | undefined => {
  const candidates = [field.customText, field.fieldMeta?.value].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

  for (const candidate of candidates) {
    const fromIso = DateTime.fromISO(candidate);

    if (fromIso.isValid) {
      return fromIso.toJSDate();
    }

    if (dateFormat) {
      const fromFormat = DateTime.fromFormat(candidate, dateFormat);

      if (fromFormat.isValid) {
        return fromFormat.toJSDate();
      }
    }
  }

  return undefined;
};

export const jsDateToIsoDate = (date: Date): string | null => {
  return DateTime.fromJSDate(date).toISODate();
};

export const buildDateFieldSignPayload = (
  value: string | null,
): Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.DATE }> => {
  return {
    type: FieldType.DATE,
    value,
  };
};

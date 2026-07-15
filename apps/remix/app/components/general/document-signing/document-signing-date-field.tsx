import { convertToLocalSystemFormat, DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZDateFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { Calendar } from '@documenso/ui/primitives/calendar';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import { useEffect, useRef, useState } from 'react';
import { useRevalidator } from 'react-router';

import { getDateFieldInitialJsDate, jsDateToIsoDate } from '~/utils/field-signing/commit-date-field';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningFieldContainer } from './document-signing-field-container';
import {
  DocumentSigningFieldsInserted,
  DocumentSigningFieldsLoader,
  DocumentSigningFieldsUninserted,
} from './document-signing-fields';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

export type DocumentSigningDateFieldProps = {
  field: FieldWithSignature;
  dateFormat?: string | null;
  timezone?: string | null;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningDateField = ({
  field,
  dateFormat = DEFAULT_DOCUMENT_DATE_FORMAT,
  timezone = DEFAULT_DOCUMENT_TIME_ZONE,
  onSignField,
  onUnsignField,
}: DocumentSigningDateFieldProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient, isAssistantMode } = useDocumentSigningRecipientContext();
  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();

  const panelRef = useRef<HTMLDivElement>(null);
  const isCommittingRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { mutateAsync: removeSignedFieldWithToken, isPending: isRemoveSignedFieldWithTokenLoading } =
    trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;

  const safeFieldMeta = ZDateFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;
  const isReadOnly = parsedFieldMeta?.readOnly ?? false;

  const resolvedDateFormat = dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT;

  const localDateString = convertToLocalSystemFormat(field.customText, dateFormat, timezone);
  const isDifferentTime = field.inserted && localDateString !== field.customText;
  const tooltipText = t`"${field.customText}" will appear on the document as it has a timezone of "${timezone || ''}".`;

  const initialDate = getDateFieldInitialJsDate({
    field: {
      customText: field.customText,
      fieldMeta: parsedFieldMeta,
    },
    dateFormat: resolvedDateFormat,
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);

  const onSign = async (authOptions?: TRecipientActionAuth, isoDate?: string) => {
    try {
      if (!isoDate) {
        return;
      }

      if (field.inserted) {
        const removePayload: TRemovedSignedFieldWithTokenMutationSchema = {
          token: recipient.token,
          fieldId: field.id,
        };

        if (onUnsignField) {
          await onUnsignField(removePayload);
        } else {
          await removeSignedFieldWithToken(removePayload);
        }
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value: isoDate,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
        setIsEditing(false);
        return;
      }

      await signFieldWithToken(payload);
      setIsEditing(false);
      await revalidate();
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: t`Error`,
        description: isAssistantMode
          ? t`An error occurred while signing as assistant.`
          : t`An error occurred while signing the document.`,
        variant: 'destructive',
      });
    }
  };

  const onRemove = async () => {
    try {
      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
        return;
      }

      await removeSignedFieldWithToken(payload);
      await revalidate();
    } catch (err) {
      console.error(err);

      toast({
        title: t`Error`,
        description: t`An error occurred while removing the field.`,
        variant: 'destructive',
      });
    }
  };

  const onPreSign = () => {
    if (isReadOnly) {
      return false;
    }

    setSelectedDate(initialDate);
    setIsEditing(true);
    return false;
  };

  const onActivateSignedField = () => {
    if (isReadOnly) {
      return;
    }

    setSelectedDate(initialDate);
    setIsEditing(true);
  };

  const handleSelect = async (date: Date | undefined) => {
    if (isCommittingRef.current || isLoading || !date) {
      return;
    }

    setSelectedDate(date);

    const isoDate = jsDateToIsoDate(date);

    if (!isoDate) {
      return;
    }

    if (field.inserted && initialDate && DateTime.fromJSDate(initialDate).toISODate() === isoDate) {
      setIsEditing(false);
      return;
    }

    isCommittingRef.current = true;

    try {
      await executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions, isoDate),
        actionTarget: field.type,
      });
    } finally {
      isCommittingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (isCommittingRef.current) {
        return;
      }

      if (panelRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsEditing(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsEditing(false);
      }
    };

    const timeoutId = window.setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 0);

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditing]);

  return (
    <DocumentSigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      onActivateSignedField={onActivateSignedField}
      isEditing={isEditing}
      type="Date"
      tooltipText={isDifferentTime ? tooltipText : undefined}
    >
      {isLoading && <DocumentSigningFieldsLoader />}

      {isEditing && !isLoading && (
        <div ref={panelRef} className="absolute top-full left-0 z-30 mt-1">
          <div className="rounded-md border bg-background shadow-md" onPointerDown={(event) => event.stopPropagation()}>
            <Calendar mode="single" selected={selectedDate} onSelect={(date) => void handleSelect(date)} initialFocus />
          </div>
        </div>
      )}

      {!isEditing && !field.inserted && (
        <DocumentSigningFieldsUninserted>
          <Trans>Date</Trans>
        </DocumentSigningFieldsUninserted>
      )}

      {!isEditing && field.inserted && (
        <DocumentSigningFieldsInserted textAlign={parsedFieldMeta?.textAlign} overflow={parsedFieldMeta?.overflow}>
          {localDateString}
        </DocumentSigningFieldsInserted>
      )}
    </DocumentSigningFieldContainer>
  );
};

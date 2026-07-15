import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZNumberFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useRef } from 'react';
import { useRevalidator } from 'react-router';

import { getNumberFieldDefaultValue, validateInlineNumberFieldValue } from '~/utils/field-signing/commit-number-field';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningFieldContainer } from './document-signing-field-container';
import {
  DocumentSigningFieldsInserted,
  DocumentSigningFieldsLoader,
  DocumentSigningFieldsUninserted,
} from './document-signing-fields';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';
import { InlineFieldInput } from './inline-field-input';
import { useInlineFieldEditor } from './use-inline-field-editor';

export type DocumentSigningNumberFieldProps = {
  field: FieldWithSignature;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningNumberField = ({ field, onSignField, onUnsignField }: DocumentSigningNumberFieldProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient, isAssistantMode } = useDocumentSigningRecipientContext();
  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { mutateAsync: removeSignedFieldWithToken, isPending: isRemoveSignedFieldWithTokenLoading } =
    trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const safeFieldMeta = ZNumberFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;
  const isReadOnly = parsedFieldMeta?.readOnly ?? false;
  const defaultValue = parsedFieldMeta?.value;

  const shouldAutoSignField = !field.inserted && !!defaultValue;

  const initialValue = getNumberFieldDefaultValue({
    field: {
      customText: field.customText,
      fieldMeta: parsedFieldMeta,
    },
  });

  const validate = useCallback(
    (value: string) => validateInlineNumberFieldValue(value, parsedFieldMeta),
    [parsedFieldMeta],
  );

  const {
    draftValue,
    errors,
    hasErrors,
    isEditing,
    startEditing,
    stopEditing,
    updateDraft,
    tryValidateForCommit,
    resetDraft,
  } = useInlineFieldEditor({
    initialValue,
    validate,
  });

  const isCommittingRef = useRef(false);
  const hasAutoSignedRef = useRef(false);

  const onSign = async (authOptions?: TRecipientActionAuth, value = draftValue) => {
    try {
      const validationErrors = validateInlineNumberFieldValue(value, parsedFieldMeta);

      if (validationErrors.length > 0 || !value) {
        return;
      }

      // V1 rejects signing an already-inserted field — clear it first when re-editing.
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
        value,
        isBase64: true,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
        stopEditing();
        return;
      }

      await signFieldWithToken(payload);
      stopEditing();
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

      const resetValue = parsedFieldMeta?.value ? String(parsedFieldMeta.value) : '';

      if (onUnsignField) {
        await onUnsignField(payload);
        resetDraft(resetValue);
        return;
      }

      await removeSignedFieldWithToken(payload);
      resetDraft(resetValue);
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

    startEditing(initialValue);
    return false;
  };

  const onActivateSignedField = async () => {
    if (isReadOnly) {
      return;
    }

    startEditing(field.customText || initialValue);
  };

  const handleCommit = async () => {
    if (isCommittingRef.current || isLoading || !isEditing) {
      return;
    }

    const trimmed = draftValue;
    const previousValue = field.inserted ? field.customText : '';

    if (field.inserted && trimmed === previousValue) {
      stopEditing();
      return;
    }

    if (!trimmed) {
      if (field.inserted) {
        if (!tryValidateForCommit()) {
          return;
        }

        isCommittingRef.current = true;

        try {
          await onRemove();
          stopEditing();
        } finally {
          isCommittingRef.current = false;
        }

        return;
      }

      if (!tryValidateForCommit()) {
        return;
      }

      stopEditing();
      return;
    }

    if (!tryValidateForCommit()) {
      return;
    }

    isCommittingRef.current = true;

    try {
      await executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions, trimmed),
        actionTarget: field.type,
      });
    } finally {
      isCommittingRef.current = false;
    }
  };

  const handleCancel = () => {
    resetDraft(field.inserted ? field.customText || initialValue : initialValue);
    stopEditing();
  };

  useEffect(() => {
    if (!shouldAutoSignField || hasAutoSignedRef.current) {
      return;
    }

    hasAutoSignedRef.current = true;

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) =>
        await onSign(authOptions, parsedFieldMeta?.value ? String(parsedFieldMeta.value) : ''),
      actionTarget: field.type,
    });
    // Intentionally run once on mount for prefilled auto-sign.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DocumentSigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      onActivateSignedField={onActivateSignedField}
      isEditing={isEditing}
      type="Number"
    >
      {isLoading && <DocumentSigningFieldsLoader />}

      {isEditing && !isLoading && (
        <div
          className={cn('absolute inset-0 z-20 flex h-full w-full', {
            'ring-2 ring-red-300 ring-offset-1': hasErrors,
          })}
        >
          <InlineFieldInput
            variant="number"
            value={draftValue}
            onChange={updateDraft}
            onCommit={() => void handleCommit()}
            onCancel={handleCancel}
            placeholder={parsedFieldMeta?.placeholder ?? t`Enter your number here`}
            textAlign={parsedFieldMeta?.textAlign}
            overflow={parsedFieldMeta?.overflow}
            fontSize={parsedFieldMeta?.fontSize}
            hasError={hasErrors}
            disabled={isLoading}
            aria-label={t`Number field`}
          />

          {hasErrors && (
            <div className="pointer-events-none absolute top-full left-0 z-30 mt-1 max-w-[240px] rounded bg-background/95 px-1.5 py-1 text-red-500 text-xs shadow-sm">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {!isEditing && !field.inserted && (
        <DocumentSigningFieldsUninserted>
          <Trans>Enter Number</Trans>
        </DocumentSigningFieldsUninserted>
      )}

      {!isEditing && field.inserted && (
        <DocumentSigningFieldsInserted textAlign={parsedFieldMeta?.textAlign} overflow={parsedFieldMeta?.overflow}>
          {field.customText}
        </DocumentSigningFieldsInserted>
      )}
    </DocumentSigningFieldContainer>
  );
};

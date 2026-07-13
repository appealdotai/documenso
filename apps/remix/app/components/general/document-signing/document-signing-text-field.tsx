import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZTextFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
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

import { getTextFieldDefaultValue, validateInlineTextFieldValue } from '~/utils/field-signing/commit-text-field';

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

export type DocumentSigningTextFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningTextField = ({ field, onSignField, onUnsignField }: DocumentSigningTextFieldProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient, isAssistantMode } = useDocumentSigningRecipientContext();
  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { mutateAsync: removeSignedFieldWithToken, isPending: isRemoveSignedFieldWithTokenLoading } =
    trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const safeFieldMeta = ZTextFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;
  const isReadOnly = parsedFieldMeta?.readOnly ?? false;

  const shouldAutoSignField =
    (!field.inserted && parsedFieldMeta?.text) ||
    (!field.inserted && parsedFieldMeta?.text && parsedFieldMeta?.readOnly);

  const initialValue = getTextFieldDefaultValue({
    field: {
      customText: field.customText,
      fieldMeta: parsedFieldMeta,
    },
  });

  const validate = useCallback(
    (value: string) => validateInlineTextFieldValue(value, parsedFieldMeta),
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
      const validationErrors = validateInlineTextFieldValue(value, parsedFieldMeta);

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

      if (onUnsignField) {
        await onUnsignField(payload);
        resetDraft(parsedFieldMeta?.text ?? '');
        return;
      }

      await removeSignedFieldWithToken(payload);
      resetDraft(parsedFieldMeta?.text ?? '');
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

    // Unchanged inserted value — just leave edit mode.
    if (field.inserted && trimmed === previousValue) {
      stopEditing();
      return;
    }

    // Empty optional / cancel empty uninserted — leave without signing.
    // Clearing an inserted field removes it when validation allows (optional).
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
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions, parsedFieldMeta?.text ?? ''),
      actionTarget: field.type,
    });
    // Intentionally run once on mount for prefilled/read-only auto-sign.
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
      type="Text"
    >
      {isLoading && <DocumentSigningFieldsLoader />}

      {isEditing && !isLoading && (
        <div
          className={cn('absolute inset-0 z-20 flex h-full w-full flex-col', {
            'ring-2 ring-red-300 ring-offset-1': hasErrors,
          })}
        >
          <InlineFieldInput
            variant="text"
            value={draftValue}
            onChange={updateDraft}
            onCommit={() => void handleCommit()}
            onCancel={handleCancel}
            placeholder={parsedFieldMeta?.placeholder ?? t`Enter your text here`}
            textAlign={parsedFieldMeta?.textAlign}
            overflow={parsedFieldMeta?.overflow}
            fontSize={parsedFieldMeta?.fontSize}
            characterLimit={parsedFieldMeta?.characterLimit}
            hasError={hasErrors}
            disabled={isLoading}
            aria-label={t`Text field`}
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
          <Trans>Enter Text</Trans>
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

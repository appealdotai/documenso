import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZDropdownFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignatureAndFieldMeta } from '@documenso/prisma/types/field-with-signature-and-fieldmeta';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { useRevalidator } from 'react-router';

import { getDropdownFieldDefaultValue } from '~/utils/field-signing/commit-dropdown-field';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningFieldContainer } from './document-signing-field-container';
import {
  DocumentSigningFieldsInserted,
  DocumentSigningFieldsLoader,
  DocumentSigningFieldsUninserted,
} from './document-signing-fields';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

export type DocumentSigningDropdownFieldProps = {
  field: FieldWithSignatureAndFieldMeta;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningDropdownField = ({
  field,
  onSignField,
  onUnsignField,
}: DocumentSigningDropdownFieldProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient, isAssistantMode } = useDocumentSigningRecipientContext();
  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();

  const listRef = useRef<HTMLDivElement>(null);
  const isCommittingRef = useRef(false);
  const hasAutoSignedRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { mutateAsync: removeSignedFieldWithToken, isPending: isRemoveSignedFieldWithTokenLoading } =
    trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const parsedFieldMeta = ZDropdownFieldMeta.parse(field.fieldMeta);
  const isReadOnly = parsedFieldMeta?.readOnly ?? false;
  const defaultValue = parsedFieldMeta?.defaultValue;
  const values = parsedFieldMeta?.values?.map((item) => item.value) ?? [];

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;
  const shouldAutoSignField = !field.inserted && !!defaultValue;

  const selectedValue = getDropdownFieldDefaultValue({
    field: {
      customText: field.customText,
      fieldMeta: parsedFieldMeta,
    },
  });

  const onSign = async (authOptions?: TRecipientActionAuth, value = selectedValue) => {
    try {
      if (!value) {
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
        value,
        isBase64: true,
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

    setIsEditing(true);
    return false;
  };

  const onActivateSignedField = () => {
    if (isReadOnly) {
      return;
    }

    setIsEditing(true);
  };

  const handleSelect = async (value: string) => {
    if (isCommittingRef.current || isLoading) {
      return;
    }

    if (field.inserted && value === field.customText) {
      setIsEditing(false);
      return;
    }

    isCommittingRef.current = true;

    try {
      await executeActionAuthProcedure({
        onReauthFormSubmit: async (authOptions) => await onSign(authOptions, value),
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

      if (listRef.current?.contains(event.target as Node)) {
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

  useEffect(() => {
    if (!shouldAutoSignField || hasAutoSignedRef.current) {
      return;
    }

    hasAutoSignedRef.current = true;

    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions, defaultValue ?? ''),
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
      type="Dropdown"
    >
      {isLoading && <DocumentSigningFieldsLoader />}

      {isEditing && !isLoading && (
        <div ref={listRef} className="absolute inset-x-0 top-0 z-20">
          <div className="pointer-events-none mb-0.5 flex h-full min-h-[100%] items-center rounded-[2px] border border-primary/40 bg-white px-1.5 text-[clamp(0.425rem,25cqw,0.825rem)] text-foreground">
            <span className="truncate">{selectedValue || t`Select`}</span>
          </div>

          <div
            role="listbox"
            aria-label={t`Dropdown options`}
            className="max-h-48 overflow-y-auto rounded-md border bg-background shadow-md"
          >
            {values.map((value) => (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={value === selectedValue}
                disabled={isLoading}
                className={cn(
                  'flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm outline-none',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:bg-accent focus-visible:text-accent-foreground',
                  'disabled:pointer-events-none disabled:opacity-50',
                  {
                    'bg-accent text-accent-foreground': value === selectedValue,
                  },
                )}
                onClick={() => void handleSelect(value)}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isEditing && !field.inserted && (
        <DocumentSigningFieldsUninserted>
          <Trans>Select</Trans>
        </DocumentSigningFieldsUninserted>
      )}

      {!isEditing && field.inserted && (
        <DocumentSigningFieldsInserted>{field.customText}</DocumentSigningFieldsInserted>
      )}
    </DocumentSigningFieldContainer>
  );
};

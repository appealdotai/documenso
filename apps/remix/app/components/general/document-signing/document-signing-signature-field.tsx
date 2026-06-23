import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { DocumentAuth } from '@documenso/lib/types/document-auth';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRevalidator } from 'react-router';
import { handleSignatureFieldClick, signatureDialogResultToFieldValue } from '~/utils/field-signing/signature-field';
import { runSignatureFieldAction } from '~/utils/field-signing/signature-field-auth';
import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningFieldContainer } from './document-signing-field-container';
import { useRequiredDocumentSigningContext } from './document-signing-provider';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

type SignatureFieldState = 'empty' | 'signed-image' | 'signed-text';

export type DocumentSigningSignatureFieldProps = {
  field: FieldWithSignature;
  recipientSignatureFields: FieldWithSignature[];
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
};

export const DocumentSigningSignatureField = ({
  field,
  recipientSignatureFields,
  onSignField,
  onUnsignField,
  typedSignatureEnabled = true,
  uploadSignatureEnabled = true,
  drawSignatureEnabled = true,
}: DocumentSigningSignatureFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient } = useDocumentSigningRecipientContext();

  const signatureRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(2);

  const {
    fullName,
    signature: suggestedSignature,
    profileSignature,
    hasCompletedSignatureActionAuth,
    markSignatureActionAuthCompleted,
  } = useRequiredDocumentSigningContext();

  const { executeActionAuthProcedure, derivedRecipientActionAuth } = useRequiredDocumentSigningAuthContext();

  const recipientActionAuthRequired =
    derivedRecipientActionAuth.length > 0 && !derivedRecipientActionAuth.includes(DocumentAuth.EXPLICIT_NONE);

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { mutateAsync: removeSignedFieldWithToken, isPending: isRemoveSignedFieldWithTokenLoading } =
    trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const { signature } = field;

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;

  const state = useMemo<SignatureFieldState>(() => {
    if (!field.inserted) {
      return 'empty';
    }

    if (signature?.signatureImageAsBase64) {
      return 'signed-image';
    }

    return 'signed-text';
  }, [field.inserted, signature?.signatureImageAsBase64]);

  const applySignatureResult = async (authOptions?: TRecipientActionAuth, signatureValue?: string) => {
    const value = signatureValue;

    if (!value) {
      return;
    }

    const isTypedSignature = !value.startsWith('data:image');

    if (isTypedSignature && typedSignatureEnabled === false) {
      toast({
        title: _(msg`Error`),
        description: _(msg`Typed signatures are not allowed. Please draw your signature.`),
        variant: 'destructive',
      });

      return;
    }

    const payload: TSignFieldWithTokenMutationSchema = {
      token: recipient.token,
      fieldId: field.id,
      value,
      isBase64: !isTypedSignature,
      authOptions,
    };

    if (onSignField) {
      await onSignField(payload);
    } else {
      await signFieldWithToken(payload);
    }

    await revalidate();
  };

  const removeSignature = async () => {
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
  };

  const openSignatureDialog = async () => {
    try {
      const result = await handleSignatureFieldClick({
        field,
        recipientFields: recipientSignatureFields,
        fullName,
        suggestedSignature,
        profileSignature,
        typedSignatureEnabled,
        uploadSignatureEnabled,
        drawSignatureEnabled,
      });

      if (!result) {
        return;
      }

      const payload = signatureDialogResultToFieldValue(result);

      await runSignatureFieldAction({
        result,
        hasAuthedOnceThisSession: hasCompletedSignatureActionAuth,
        recipientActionAuthRequired,
        markSignatureActionAuthCompleted,
        executeActionAuthProcedure,
        onApply: async (authOptions) => {
          if (payload.value) {
            await applySignatureResult(authOptions, payload.value);
          }
        },
        onRemove: async () => {
          await removeSignature();
        },
      });
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while signing the document.`),
        variant: 'destructive',
      });
    }
  };

  const onPreSign = () => {
    void openSignatureDialog();
    return false;
  };

  useLayoutEffect(() => {
    if (!signatureRef.current || !containerRef.current || !signature?.typedSignature) {
      return;
    }

    const adjustTextSize = () => {
      const container = containerRef.current;
      const text = signatureRef.current;

      if (!container || !text) {
        return;
      }

      let size = 2;
      text.style.fontSize = `${size}rem`;

      while ((text.scrollWidth > container.clientWidth || text.scrollHeight > container.clientHeight) && size > 0.8) {
        size -= 0.1;
        text.style.fontSize = `${size}rem`;
      }

      setFontSize(size);
    };

    const resizeObserver = new ResizeObserver(adjustTextSize);
    resizeObserver.observe(containerRef.current);

    adjustTextSize();

    return () => resizeObserver.disconnect();
  }, [signature?.typedSignature]);

  return (
    <DocumentSigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onActivateSignedField={openSignatureDialog}
      type="Signature"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background">
          <Loader className="h-5 w-5 animate-spin text-primary md:h-8 md:w-8" />
        </div>
      )}

      {state === 'empty' && (
        <p className="font-signature text-[clamp(0.575rem,25cqw,1.2rem)] text-muted-foreground text-xl duration-200 group-hover:text-primary group-hover:text-recipient-green">
          <Trans>Signature</Trans>
        </p>
      )}

      {state === 'signed-image' && signature?.signatureImageAsBase64 && (
        <img
          src={signature.signatureImageAsBase64}
          alt={`Signature for ${recipient.name}`}
          className="h-full w-full object-contain"
        />
      )}

      {state === 'signed-text' && (
        <div ref={containerRef} className="flex h-full w-full items-center justify-center p-2">
          <p
            ref={signatureRef}
            className="w-full overflow-hidden break-all text-center font-signature text-muted-foreground leading-tight duration-200"
            style={{ fontSize: `${fontSize}rem` }}
          >
            {signature?.typedSignature}
          </p>
        </div>
      )}
    </DocumentSigningFieldContainer>
  );
};

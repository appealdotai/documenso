import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  collectSignaturePickerOptions,
  signatureDataToValue,
  type TSignFieldSignatureDialogResult,
} from '@documenso/lib/utils/signature-picker';
import { isSignatureFieldType } from '@documenso/prisma/guards/is-signature-field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { SignFieldSignatureDialog } from '~/components/dialogs/sign-field-signature-dialog';

type SignatureFieldLike = {
  id: number;
  type: FieldType;
  inserted: boolean;
  signature?: {
    signatureImageAsBase64?: string | null;
    typedSignature?: string | null;
  } | null;
};

type HandleSignatureFieldClickOptions = {
  field: SignatureFieldLike;
  recipientFields: SignatureFieldLike[];
  fullName?: string;
  suggestedSignature?: string | null;
  profileSignature?: string | null;
  isSigningLocked?: boolean;
  typedSignatureEnabled: boolean;
  uploadSignatureEnabled: boolean;
  drawSignatureEnabled: boolean;
};

export const handleSignatureFieldClick = async (
  options: HandleSignatureFieldClickOptions,
): Promise<TSignFieldSignatureDialogResult | null> => {
  const {
    field,
    recipientFields,
    fullName,
    suggestedSignature,
    profileSignature,
    isSigningLocked,
    typedSignatureEnabled,
    uploadSignatureEnabled,
    drawSignatureEnabled,
  } = options;

  if (!isSignatureFieldType(field.type)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (isSigningLocked) {
    return null;
  }

  const currentFieldValue = field.inserted ? signatureDataToValue(field.signature) : null;

  const availableOptions = collectSignaturePickerOptions({
    fields: recipientFields,
    excludeFieldId: field.inserted ? undefined : field.id,
    profileSignature,
    currentFieldValue,
    typedSignatureEnabled,
    uploadSignatureEnabled,
    drawSignatureEnabled,
  });

  const result = await SignFieldSignatureDialog.call({
    mode: field.inserted ? 'change' : 'unsigned',
    fullName,
    suggestedSignature,
    availableOptions,
    typedSignatureEnabled,
    uploadSignatureEnabled,
    drawSignatureEnabled,
  });

  return result;
};

export const signatureDialogResultToFieldValue = (
  result: TSignFieldSignatureDialogResult,
): Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.SIGNATURE }> => {
  if (result.action === 'remove') {
    return {
      type: FieldType.SIGNATURE,
      value: null,
    };
  }

  return {
    type: FieldType.SIGNATURE,
    value: result.value,
  };
};

import { isSignatureFieldType } from '@documenso/prisma/guards/is-signature-field';
import type { FieldType } from '@prisma/client';

import { isBase64Image } from '../constants/signatures';

type FieldSignatureData = {
  signatureImageAsBase64?: string | null;
  typedSignature?: string | null;
};

type SignatureFieldLike = {
  id: number;
  type: FieldType;
  inserted: boolean;
  signature?: FieldSignatureData | null;
};

export type TSignaturePickerOption = {
  id: string;
  value: string;
  isImage: boolean;
  source: 'document' | 'profile' | 'current';
  labelIndex: number;
};

export const signatureDataToValue = (signature: FieldSignatureData | null | undefined): string | null => {
  if (!signature) {
    return null;
  }

  if (signature.signatureImageAsBase64) {
    return signature.signatureImageAsBase64;
  }

  if (signature.typedSignature) {
    return signature.typedSignature;
  }

  return null;
};

const isSignatureValueAllowed = (
  value: string,
  {
    typedSignatureEnabled,
    uploadSignatureEnabled,
    drawSignatureEnabled,
  }: {
    typedSignatureEnabled: boolean;
    uploadSignatureEnabled: boolean;
    drawSignatureEnabled: boolean;
  },
) => {
  const isImage = isBase64Image(value);

  if (isImage) {
    return uploadSignatureEnabled || drawSignatureEnabled;
  }

  return typedSignatureEnabled;
};

export const collectSignaturePickerOptions = ({
  fields,
  excludeFieldId,
  profileSignature,
  currentFieldValue,
  typedSignatureEnabled,
  uploadSignatureEnabled,
  drawSignatureEnabled,
}: {
  fields: SignatureFieldLike[];
  excludeFieldId?: number;
  profileSignature?: string | null;
  currentFieldValue?: string | null;
  typedSignatureEnabled: boolean;
  uploadSignatureEnabled: boolean;
  drawSignatureEnabled: boolean;
}): TSignaturePickerOption[] => {
  const seenValues = new Set<string>();
  const currentOptions: TSignaturePickerOption[] = [];
  const documentOptions: TSignaturePickerOption[] = [];
  const profileOptions: TSignaturePickerOption[] = [];

  const pushOption = (value: string, source: TSignaturePickerOption['source'], target: TSignaturePickerOption[]) => {
    if (seenValues.has(value)) {
      return;
    }

    if (
      !isSignatureValueAllowed(value, {
        typedSignatureEnabled,
        uploadSignatureEnabled,
        drawSignatureEnabled,
      })
    ) {
      return;
    }

    seenValues.add(value);

    target.push({
      id: `${source}-${target.length}-${value.length}`,
      value,
      isImage: isBase64Image(value),
      source,
      labelIndex: 0,
    });
  };

  if (currentFieldValue) {
    pushOption(currentFieldValue, 'current', currentOptions);
  }

  for (const field of fields) {
    if (!isSignatureFieldType(field.type) || !field.inserted || field.id === excludeFieldId) {
      continue;
    }

    const value = signatureDataToValue(field.signature);

    if (value) {
      pushOption(value, 'document', documentOptions);
    }
  }

  if (profileSignature) {
    pushOption(profileSignature, 'profile', profileOptions);
  }

  return [
    ...currentOptions,
    ...documentOptions.map((option, index) => ({
      ...option,
      labelIndex: index + 1,
    })),
    ...profileOptions,
  ];
};

export const isNewSignatureValue = (value: string, options: TSignaturePickerOption[]): boolean => {
  return !options.some((option) => option.value === value);
};

export type TSignFieldSignatureDialogResult =
  | {
      action: 'apply';
      value: string;
      isNewSignature: boolean;
    }
  | {
      action: 'remove';
    };

export const requiresSignatureActionAuth = ({
  result,
  hasAuthedOnceThisSession,
  recipientActionAuthRequired,
}: {
  result: TSignFieldSignatureDialogResult;
  hasAuthedOnceThisSession: boolean;
  recipientActionAuthRequired: boolean;
}): boolean => {
  if (!recipientActionAuthRequired) {
    return false;
  }

  if (result.action === 'remove') {
    return true;
  }

  if (result.isNewSignature) {
    return true;
  }

  if (!hasAuthedOnceThisSession) {
    return true;
  }

  return false;
};

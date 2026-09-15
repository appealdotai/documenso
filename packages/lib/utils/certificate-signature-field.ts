import { isSignatureFieldType } from '@documenso/prisma/guards/is-signature-field';
import type { FieldType } from '@prisma/client';

type CertificateSignatureField = {
  type: FieldType;
  signature?: {
    signatureImageAsBase64?: string | null;
    typedSignature?: string | null;
  } | null;
};

export const fieldHasSignatureContent = (field: CertificateSignatureField) => {
  return Boolean(field.signature?.signatureImageAsBase64 || field.signature?.typedSignature);
};

/**
 * Pick the signature field to display on the signing certificate.
 *
 * Recipients may have multiple signature fields (e.g. one required and one
 * optional). Prefer the field that actually contains signature data instead of
 * blindly using the first signature field in the list.
 */
export const findSignatureFieldForCertificate = <T extends CertificateSignatureField>(fields: T[]): T | undefined => {
  const signatureFields = fields.filter((field) => isSignatureFieldType(field.type));

  return signatureFields.find(fieldHasSignatureContent) ?? signatureFields[0];
};

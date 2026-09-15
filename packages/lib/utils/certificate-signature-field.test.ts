import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { fieldHasSignatureContent, findSignatureFieldForCertificate } from './certificate-signature-field';

describe('findSignatureFieldForCertificate', () => {
  it('prefers a signed signature field over an earlier unsigned one', () => {
    const fields = [
      {
        id: 1,
        type: FieldType.SIGNATURE,
        secondaryId: 'unsigned-field',
        signature: null,
      },
      {
        id: 2,
        type: FieldType.SIGNATURE,
        secondaryId: 'signed-field',
        signature: {
          typedSignature: 'Jane Doe',
          signatureImageAsBase64: null,
        },
      },
    ];

    expect(findSignatureFieldForCertificate(fields)?.secondaryId).toBe('signed-field');
  });

  it('falls back to the first signature field when none are signed', () => {
    const fields = [
      {
        id: 1,
        type: FieldType.SIGNATURE,
        secondaryId: 'first-field',
        signature: null,
      },
      {
        id: 2,
        type: FieldType.TEXT,
        secondaryId: 'text-field',
        signature: null,
      },
    ];

    expect(findSignatureFieldForCertificate(fields)?.secondaryId).toBe('first-field');
  });

  it('returns undefined when there are no signature fields', () => {
    expect(
      findSignatureFieldForCertificate([
        {
          id: 1,
          type: FieldType.TEXT,
          secondaryId: 'text-field',
          signature: null,
        },
      ]),
    ).toBeUndefined();
  });
});

describe('fieldHasSignatureContent', () => {
  it('detects typed and image signatures', () => {
    expect(
      fieldHasSignatureContent({
        type: FieldType.SIGNATURE,
        signature: { typedSignature: 'Jane Doe', signatureImageAsBase64: null },
      }),
    ).toBe(true);

    expect(
      fieldHasSignatureContent({
        type: FieldType.SIGNATURE,
        signature: { typedSignature: null, signatureImageAsBase64: 'data:image/png;base64,abc' },
      }),
    ).toBe(true);

    expect(
      fieldHasSignatureContent({
        type: FieldType.SIGNATURE,
        signature: null,
      }),
    ).toBe(false);
  });
});

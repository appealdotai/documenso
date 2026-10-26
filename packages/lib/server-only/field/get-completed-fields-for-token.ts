import { prisma } from '@documenso/prisma';
import { EnvelopeType, FieldType, SigningStatus } from '@prisma/client';

export type GetCompletedFieldsForTokenOptions = {
  token: string;
};

// Note: You many need to filter this on a per envelope item ID basis.
export const getCompletedFieldsForToken = async ({ token }: GetCompletedFieldsForTokenOptions) => {
  return await prisma.field.findMany({
    where: {
      envelope: {
        type: EnvelopeType.DOCUMENT,
        recipients: {
          some: {
            token,
          },
        },
      },
      recipient: {
        signingStatus: SigningStatus.SIGNED,
      },
      OR: [{ inserted: true }, { type: FieldType.SHAPE }],
    },
    include: {
      signature: true,
      recipient: {
        select: {
          name: true,
          email: true,
          signingStatus: true,
        },
      },
    },
  });
};

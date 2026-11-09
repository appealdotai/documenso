import { prisma } from '@documenso/prisma';
import { FieldType, SigningStatus } from '@prisma/client';

export type GetCompletedFieldsForDocumentOptions = {
  documentId: number;
};

export const getCompletedFieldsForDocument = async ({ documentId }: GetCompletedFieldsForDocumentOptions) => {
  return await prisma.field.findMany({
    where: {
      documentId,
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
        },
      },
    },
  });
};

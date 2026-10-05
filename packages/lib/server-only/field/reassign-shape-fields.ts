import { prisma } from '@documenso/prisma';
import type { Prisma, PrismaClient } from '@prisma/client';
import { FieldType } from '@prisma/client';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export type ReassignEnvelopeShapeFieldsOptions = {
  envelopeId: string;
  /**
   * Recipient IDs being removed. Their shape fields move to a remaining
   * recipient so decorative shapes survive recipient edits.
   */
  fromRecipientIds: number[];
  tx?: TransactionClient | Prisma.TransactionClient;
};

/**
 * Move decorative shape fields off recipients that are being removed.
 *
 * Shapes belong to no workflow, so they are reassigned to the first
 * remaining recipient instead of being cascade-deleted with their owner.
 * Returns the number of reassigned fields (0 when no shapes or no remaining
 * recipient exist — in the latter case the cascade delete stands).
 */
export const reassignEnvelopeShapeFields = async ({
  envelopeId,
  fromRecipientIds,
  tx = prisma,
}: ReassignEnvelopeShapeFieldsOptions) => {
  if (fromRecipientIds.length === 0) {
    return 0;
  }

  const fallbackRecipient = await tx.recipient.findFirst({
    where: {
      envelopeId,
      id: {
        notIn: fromRecipientIds,
      },
    },
    orderBy: {
      id: 'asc',
    },
    select: {
      id: true,
    },
  });

  if (!fallbackRecipient) {
    return 0;
  }

  const { count } = await tx.field.updateMany({
    where: {
      envelopeId,
      type: FieldType.SHAPE,
      recipientId: {
        in: fromRecipientIds,
      },
    },
    data: {
      recipientId: fallbackRecipient.id,
    },
  });

  return count;
};

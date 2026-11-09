import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { assertEnvelopeMutable } from '@documenso/lib/server-only/envelope/assert-envelope-mutable';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { applyEnvelopeItemPageOperationsService } from '@documenso/lib/server-only/envelope-item/apply-envelope-item-page-operations';
import { getEnvelopeItemPermissions } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZApplyEnvelopeItemPageOperationsRequestSchema,
  ZApplyEnvelopeItemPageOperationsResponseSchema,
} from './apply-envelope-item-page-operations.types';

export const applyEnvelopeItemPageOperationsRoute = authenticatedProcedure
  .input(ZApplyEnvelopeItemPageOperationsRequestSchema)
  .output(ZApplyEnvelopeItemPageOperationsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId, metadata } = ctx;
    const { payload, file } = input;
    const { envelopeId, envelopeItemId, operations } = payload;

    ctx.logger.info({
      input: {
        envelopeId,
        envelopeItemId,
      },
    });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      type: null,
      userId: user.id,
      teamId,
    });

    const envelope = await prisma.envelope.findUnique({
      where: envelopeWhereInput,
      include: {
        recipients: true,
        envelopeItems: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    await assertEnvelopeMutable(envelope);

    if (envelope.internalVersion !== 2) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Page operations are only supported for version 2 envelopes',
      });
    }

    const { canFileBeChanged } = getEnvelopeItemPermissions(envelope, envelope.recipients);

    if (!canFileBeChanged) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item is not editable',
      });
    }

    const envelopeItem = envelope.envelopeItems.find((item) => item.id === envelopeItemId);

    if (!envelopeItem) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope item not found',
      });
    }

    return await applyEnvelopeItemPageOperationsService({
      envelope,
      envelopeItemId,
      operations,
      importFile: file,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      apiRequestMetadata: metadata,
    });
  });

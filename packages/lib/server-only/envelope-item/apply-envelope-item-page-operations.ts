import { normalizePdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { Envelope } from '@prisma/client';
import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { assertEnvelopeMutable } from '../envelope/assert-envelope-mutable';
import { applyEnvelopeItemPageOperations, type EnvelopeItemPageOperation, remapFieldPages } from './page-operations';

type ApplyEnvelopeItemPageOperationsOptions = {
  envelope: Pick<Envelope, 'id' | 'type'>;

  envelopeItemId: string;

  operations: EnvelopeItemPageOperation[];

  importFile?: File;

  user: {
    id: number;
    name: string | null;
    email: string;
  };

  apiRequestMetadata: ApiRequestMetadata;
};

export const applyEnvelopeItemPageOperationsService = async ({
  envelope,
  envelopeItemId,
  operations,
  importFile,
  user,
  apiRequestMetadata,
}: ApplyEnvelopeItemPageOperationsOptions) => {
  const envelopeItem = await prisma.envelopeItem.findFirst({
    where: {
      id: envelopeItemId,
      envelopeId: envelope.id,
    },
    include: {
      documentData: true,
    },
  });

  if (!envelopeItem) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope item not found',
    });
  }

  if (operations.length === 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'At least one page operation is required',
    });
  }

  const hasImportOperation = operations.some((operation) => operation.type === 'import');

  if (hasImportOperation && !importFile) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'An import file is required for import operations',
    });
  }

  if (!hasImportOperation && importFile) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'An import file was provided without an import operation',
    });
  }

  const sourcePdf = await getFileServerSide({
    type: envelopeItem.documentData.type,
    data: envelopeItem.documentData.initialData,
  });

  const importPdf = importFile
    ? await normalizePdf(Buffer.from(await importFile.arrayBuffer()), {
        flattenForm: true,
      })
    : undefined;

  const { pdf: transformedPdf, pageMap } = await applyEnvelopeItemPageOperations({
    sourcePdf,
    operations,
    importPdf,
  });

  const existingFields = await prisma.field.findMany({
    where: {
      envelopeId: envelope.id,
      envelopeItemId,
    },
    select: {
      id: true,
      page: true,
    },
  });

  remapFieldPages(existingFields, pageMap);

  const normalizedPdf = await normalizePdf(Buffer.from(transformedPdf), {
    flattenForm: envelope.type !== EnvelopeType.TEMPLATE,
  });

  const normalizedPdfBytes = new Uint8Array(normalizedPdf);

  const { documentData: newDocumentData, filePageCount } = await putPdfFileServerSide({
    name: envelopeItem.title.endsWith('.pdf') ? envelopeItem.title : `${envelopeItem.title}.pdf`,
    type: 'application/pdf',
    arrayBuffer: async () => normalizedPdfBytes.buffer,
  });

  const { item: updatedItem, fields } = await prisma
    .$transaction(async (tx) => {
      await assertEnvelopeMutable({ id: envelope.id }, tx);

      const currentFields = await tx.field.findMany({
        where: {
          envelopeId: envelope.id,
          envelopeItemId,
        },
        select: {
          id: true,
          page: true,
        },
      });

      const remappedFields = remapFieldPages(currentFields, pageMap);
      const fieldsToDelete = remappedFields.fieldsOnRemovedPages.map((field) => field.id);

      if (fieldsToDelete.length > 0) {
        await tx.field.deleteMany({
          where: {
            id: {
              in: fieldsToDelete,
            },
          },
        });
      }

      const currentPageByFieldId = new Map(currentFields.map((field) => [field.id, field.page]));

      for (const field of remappedFields.updated) {
        if (currentPageByFieldId.get(field.id) === field.page) {
          continue;
        }

        await tx.field.update({
          where: {
            id: field.id,
          },
          data: {
            page: field.page,
          },
        });
      }

      const updateResult = await tx.envelopeItem.updateMany({
        where: {
          id: envelopeItem.id,
          envelopeId: envelope.id,
          documentDataId: envelopeItem.documentDataId,
        },
        data: {
          documentDataId: newDocumentData.id,
        },
      });

      if (updateResult.count !== 1) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'The envelope item changed while applying page operations',
        });
      }

      const item = await tx.envelopeItem.findUniqueOrThrow({
        where: {
          id: envelopeItem.id,
        },
      });

      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_PAGES_UPDATED,
          envelopeId: envelope.id,
          data: {
            envelopeItemId: item.id,
            envelopeItemTitle: item.title,
            fromPageCount: pageMap.length,
            toPageCount: filePageCount,
          },
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          requestMetadata: apiRequestMetadata.requestMetadata,
        }),
      });

      const fields = await tx.field.findMany({
        where: {
          envelopeId: envelope.id,
        },
      });

      return { item, fields };
    })
    .catch(async (error) => {
      const isReferenced = await prisma.envelopeItem
        .findFirst({
          where: {
            documentDataId: newDocumentData.id,
          },
          select: {
            id: true,
          },
        })
        .catch((cleanupError) => {
          console.error(cleanupError);

          return { id: 'unknown' };
        });

      if (!isReferenced) {
        await prisma.documentData.delete({ where: { id: newDocumentData.id } }).catch((cleanupError) => {
          console.error(cleanupError);
        });
      }

      throw error;
    });

  await prisma.documentData.delete({ where: { id: envelopeItem.documentDataId } }).catch((error) => {
    console.error(error);
  });

  return {
    data: updatedItem,
    fields,
  };
};

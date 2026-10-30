import { PDF } from '@libpdf/core';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type EnvelopeItemPageOperation =
  | {
      type: 'remove';
      pageIndex: number;
    }
  | {
      type: 'move';
      fromIndex: number;
      toIndex: number;
    }
  | {
      type: 'duplicate';
      pageIndex: number;
    }
  | {
      type: 'import';
      pageIndices: number[];
      insertAt: number;
    };

export type ApplyEnvelopeItemPageOperationsOptions = {
  sourcePdf: Uint8Array;
  operations: EnvelopeItemPageOperation[];
  importPdf?: Uint8Array;
};

export type ApplyEnvelopeItemPageOperationsResult = {
  pdf: Uint8Array;
  pageMap: (number | null)[];
};

export type PageMappedField = {
  id: number;
  page: number;
};

export type RemapFieldPagesResult = {
  updated: PageMappedField[];
  fieldsOnRemovedPages: PageMappedField[];
};

const assertPageIndex = (index: number, pageCount: number, label: string) => {
  if (!Number.isInteger(index) || index < 0 || index >= pageCount) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `${label} ${index} is out of range for a document with ${pageCount} pages`,
    });
  }
};

const loadPdf = async (bytes: Uint8Array, label: string) => {
  return await PDF.load(new Uint8Array(bytes)).catch((error) => {
    console.error(`Failed to load ${label}: ${error.message}`);

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `The ${label} is not a valid PDF`,
    });
  });
};

export const applyEnvelopeItemPageOperations = async ({
  sourcePdf,
  operations,
  importPdf,
}: ApplyEnvelopeItemPageOperationsOptions): Promise<ApplyEnvelopeItemPageOperationsResult> => {
  const pdf = await loadPdf(sourcePdf, 'source PDF');

  const originalPageCount = pdf.getPageCount();

  if (originalPageCount === 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'The source PDF does not contain any pages',
    });
  }

  const pageOrder: (number | null)[] = Array.from({ length: originalPageCount }, (_, index) => index);

  let importPdfDocument: PDF | null = null;

  const getImportPdf = async () => {
    if (!importPdf) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'An import file is required for import operations',
      });
    }

    if (!importPdfDocument) {
      importPdfDocument = await loadPdf(importPdf, 'import PDF');
    }

    return importPdfDocument;
  };

  for (const operation of operations) {
    const currentPageCount = pdf.getPageCount();

    switch (operation.type) {
      case 'remove': {
        assertPageIndex(operation.pageIndex, currentPageCount, 'Page index');

        pdf.removePage(operation.pageIndex);
        pageOrder.splice(operation.pageIndex, 1);

        break;
      }

      case 'move': {
        assertPageIndex(operation.fromIndex, currentPageCount, 'From index');
        assertPageIndex(operation.toIndex, currentPageCount, 'To index');

        pdf.movePage(operation.fromIndex, operation.toIndex);

        const [page] = pageOrder.splice(operation.fromIndex, 1);
        pageOrder.splice(operation.toIndex, 0, page);

        break;
      }

      case 'duplicate': {
        assertPageIndex(operation.pageIndex, currentPageCount, 'Page index');

        await pdf.copyPagesFrom(pdf, [operation.pageIndex], {
          insertAt: operation.pageIndex + 1,
        });

        pageOrder.splice(operation.pageIndex + 1, 0, null);

        break;
      }

      case 'import': {
        if (operation.pageIndices.length === 0) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: 'At least one import page index is required',
          });
        }

        if (!Number.isInteger(operation.insertAt) || operation.insertAt < 0 || operation.insertAt > currentPageCount) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: `Insert position ${operation.insertAt} is out of range for a document with ${currentPageCount} pages`,
          });
        }

        const importDocument = await getImportPdf();
        const importPageCount = importDocument.getPageCount();

        for (const pageIndex of operation.pageIndices) {
          assertPageIndex(pageIndex, importPageCount, 'Import page index');
        }

        await pdf.copyPagesFrom(importDocument, operation.pageIndices, {
          insertAt: operation.insertAt,
        });

        pageOrder.splice(operation.insertAt, 0, ...operation.pageIndices.map(() => null));

        break;
      }

      default: {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Unknown page operation',
        });
      }
    }
  }

  if (pdf.getPageCount() < 1) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'A PDF must have at least one page',
    });
  }

  const pageMap = Array.from({ length: originalPageCount }, (_, originalIndex) => {
    const newIndex = pageOrder.indexOf(originalIndex);

    return newIndex === -1 ? null : newIndex;
  });

  return {
    pdf: await pdf.save(),
    pageMap,
  };
};

export const remapFieldPages = (fields: PageMappedField[], pageMap: (number | null)[]): RemapFieldPagesResult => {
  const updated: PageMappedField[] = [];
  const fieldsOnRemovedPages: PageMappedField[] = [];

  for (const field of fields) {
    const originalPageIndex = field.page - 1;

    if (originalPageIndex < 0 || originalPageIndex >= pageMap.length) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Field ${field.id} is on an invalid page (${field.page})`,
      });
    }

    const newPageIndex = pageMap[originalPageIndex];

    if (newPageIndex === null) {
      fieldsOnRemovedPages.push(field);

      continue;
    }

    updated.push({
      ...field,
      page: newPageIndex + 1,
    });
  }

  return {
    updated,
    fieldsOnRemovedPages,
  };
};

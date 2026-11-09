import { PDF } from '@libpdf/core';
import { describe, expect, it } from 'vitest';

import { applyEnvelopeItemPageOperations, remapFieldPages } from './page-operations';

const createPdf = async (pageCount: number) => {
  const pdf = PDF.create();

  for (let index = 0; index < pageCount; index++) {
    pdf.addPage({ size: 'letter' });
  }

  return new Uint8Array(await pdf.save());
};

const getPageCount = async (pdf: Uint8Array) => {
  const document = await PDF.load(pdf);

  return document.getPageCount();
};

describe('applyEnvelopeItemPageOperations', () => {
  it('returns an identity page map when there are no operations', async () => {
    const result = await applyEnvelopeItemPageOperations({
      sourcePdf: await createPdf(4),
      operations: [],
    });

    expect(result.pageMap).toEqual([0, 1, 2, 3]);
    expect(await getPageCount(result.pdf)).toBe(4);
  });

  it('remaps original pages after a removal', async () => {
    const result = await applyEnvelopeItemPageOperations({
      sourcePdf: await createPdf(4),
      operations: [{ type: 'remove', pageIndex: 1 }],
    });

    expect(result.pageMap).toEqual([0, null, 1, 2]);
    expect(await getPageCount(result.pdf)).toBe(3);
  });

  it('remaps original pages after a move', async () => {
    const result = await applyEnvelopeItemPageOperations({
      sourcePdf: await createPdf(4),
      operations: [{ type: 'move', fromIndex: 0, toIndex: 2 }],
    });

    expect(result.pageMap).toEqual([2, 0, 1, 3]);
    expect(await getPageCount(result.pdf)).toBe(4);
  });

  it('does not map duplicated pages to the source page fields', async () => {
    const result = await applyEnvelopeItemPageOperations({
      sourcePdf: await createPdf(4),
      operations: [{ type: 'duplicate', pageIndex: 1 }],
    });

    expect(result.pageMap).toEqual([0, 1, 3, 4]);
    expect(await getPageCount(result.pdf)).toBe(5);
  });

  it('does not map imported pages to the source page fields', async () => {
    const result = await applyEnvelopeItemPageOperations({
      sourcePdf: await createPdf(4),
      operations: [{ type: 'import', pageIndices: [1, 0], insertAt: 2 }],
      importPdf: await createPdf(2),
    });

    expect(result.pageMap).toEqual([0, 1, 4, 5]);
    expect(await getPageCount(result.pdf)).toBe(6);
  });

  it('applies mixed operations in order', async () => {
    const result = await applyEnvelopeItemPageOperations({
      sourcePdf: await createPdf(5),
      operations: [
        { type: 'remove', pageIndex: 0 },
        { type: 'move', fromIndex: 2, toIndex: 0 },
        { type: 'duplicate', pageIndex: 1 },
        { type: 'import', pageIndices: [0], insertAt: 3 },
      ],
      importPdf: await createPdf(1),
    });

    expect(result.pageMap).toEqual([null, 1, 4, 0, 5]);
    expect(await getPageCount(result.pdf)).toBe(6);
  });

  it('allows removing an original page when a duplicate remains', async () => {
    const result = await applyEnvelopeItemPageOperations({
      sourcePdf: await createPdf(3),
      operations: [
        { type: 'duplicate', pageIndex: 0 },
        { type: 'remove', pageIndex: 0 },
      ],
    });

    expect(result.pageMap).toEqual([null, 1, 2]);
    expect(await getPageCount(result.pdf)).toBe(3);
  });

  it('rejects removing every page', async () => {
    await expect(
      applyEnvelopeItemPageOperations({
        sourcePdf: await createPdf(1),
        operations: [{ type: 'remove', pageIndex: 0 }],
      }),
    ).rejects.toThrow('A PDF must have at least one page');
  });

  it('rejects out of range page indices', async () => {
    await expect(
      applyEnvelopeItemPageOperations({
        sourcePdf: await createPdf(2),
        operations: [{ type: 'remove', pageIndex: 2 }],
      }),
    ).rejects.toThrow('Page index 2 is out of range');
  });

  it('requires an import PDF for import operations', async () => {
    await expect(
      applyEnvelopeItemPageOperations({
        sourcePdf: await createPdf(2),
        operations: [{ type: 'import', pageIndices: [0], insertAt: 1 }],
      }),
    ).rejects.toThrow('An import file is required for import operations');
  });

  it('rejects out of range import page indices', async () => {
    await expect(
      applyEnvelopeItemPageOperations({
        sourcePdf: await createPdf(2),
        operations: [{ type: 'import', pageIndices: [1], insertAt: 1 }],
        importPdf: await createPdf(1),
      }),
    ).rejects.toThrow('Import page index 1 is out of range');
  });

  it('rejects out of range insert positions', async () => {
    await expect(
      applyEnvelopeItemPageOperations({
        sourcePdf: await createPdf(2),
        operations: [{ type: 'import', pageIndices: [0], insertAt: 3 }],
        importPdf: await createPdf(1),
      }),
    ).rejects.toThrow('Insert position 3 is out of range');
  });
});

describe('remapFieldPages', () => {
  it('remaps fields and reports fields on removed pages', () => {
    const result = remapFieldPages(
      [
        { id: 1, page: 1 },
        { id: 2, page: 2 },
        { id: 3, page: 3 },
      ],
      [0, null, 1],
    );

    expect(result.updated).toEqual([
      { id: 1, page: 1 },
      { id: 3, page: 2 },
    ]);
    expect(result.fieldsOnRemovedPages).toEqual([{ id: 2, page: 2 }]);
  });

  it('rejects fields on pages outside the source document', () => {
    expect(() => remapFieldPages([{ id: 1, page: 4 }], [0, 1, 2])).toThrow('Field 1 is on an invalid page (4)');
  });
});

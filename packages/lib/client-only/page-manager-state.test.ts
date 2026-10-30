import { describe, expect, it } from 'vitest';

import {
  applyPageManagerOperations,
  createOriginalPages,
  duplicatePage,
  getPageManagerSummary,
  importPages,
  movePageByOffset,
  removePages,
  reorderPage,
  resetPages,
  restorePage,
} from './page-manager-state';

const createPages = (pageCount: number) =>
  createOriginalPages({
    pageCount,
    fieldCounts: new Map(),
  });

const getKeys = (pages: ReturnType<typeof createPages>) => pages.map((page) => page.key);

describe('createOriginalPages', () => {
  it('creates original pages with field counts', () => {
    const pages = createOriginalPages({
      pageCount: 3,
      fieldCounts: { 1: 2, 3: 1 },
    });

    expect(pages.map((page) => page.source.pageIndex)).toEqual([0, 1, 2]);
    expect(pages.map((page) => page.fieldCount)).toEqual([2, 0, 1]);
    expect(pages.every((page) => page.kind === 'original' && !page.isRemoved)).toBe(true);
  });
});

describe('reorderPage', () => {
  it('moves a page before and after another page', () => {
    const pages = createPages(3);

    expect(getKeys(reorderPage(pages, 'page-2', 'page-0', 'before'))).toEqual(['page-2', 'page-0', 'page-1']);
    expect(getKeys(reorderPage(pages, 'page-0', 'page-1', 'after'))).toEqual(['page-1', 'page-0', 'page-2']);
  });

  it('keeps the same array when the source and target match', () => {
    const pages = createPages(2);

    expect(reorderPage(pages, 'page-0', 'page-0', 'before')).toBe(pages);
  });
});

describe('movePageByOffset', () => {
  it('moves around removed pages', () => {
    const pages = removePages(createPages(3), ['page-1']);

    expect(getKeys(movePageByOffset(pages, 'page-2', -1))).toEqual(['page-2', 'page-0', 'page-1']);
  });

  it('does not move past the active boundaries', () => {
    const pages = createPages(2);

    expect(movePageByOffset(pages, 'page-0', -1)).toBe(pages);
    expect(movePageByOffset(pages, 'page-1', 1)).toBe(pages);
  });
});

describe('duplicatePage', () => {
  it('inserts a duplicate after the source and inherits its root source', () => {
    const pages = duplicatePage(createPages(3), 1, 'duplicate-1');

    expect(getKeys(pages)).toEqual(['page-0', 'page-1', 'duplicate-1', 'page-2']);
    expect(pages[2]).toMatchObject({
      kind: 'duplicate',
      source: {
        kind: 'original',
        pageIndex: 1,
      },
      fieldCount: 0,
    });
  });

  it('normalizes duplicate-of-duplicate to the root source', () => {
    const pages = duplicatePage(createPages(2), 0, 'duplicate-1');
    const duplicatedAgain = duplicatePage(pages, 1, 'duplicate-2');

    expect(duplicatedAgain[2]).toMatchObject({
      kind: 'duplicate',
      source: {
        kind: 'original',
        pageIndex: 0,
      },
    });
  });
});

describe('removePages and restorePage', () => {
  it('marks original pages as removed and restores them', () => {
    const pages = removePages(createPages(3), ['page-1']);

    expect(pages[1]).toMatchObject({
      key: 'page-1',
      isRemoved: true,
    });

    const restored = restorePage(pages, 'page-1');

    expect(restored[1]).toMatchObject({
      key: 'page-1',
      isRemoved: false,
    });
    expect(getPageManagerSummary(restored).hasChanges).toBe(false);
  });

  it('deletes duplicates and imported pages immediately', () => {
    const pages = duplicatePage(createPages(2), 0, 'duplicate-1');
    const imported = importPages(pages, [0], 0, ['import-1']);
    const removed = removePages(imported, ['duplicate-1', 'import-1']);

    expect(removed.map((page) => page.key)).toEqual(['page-0', 'page-1']);
  });

  it('does not remove every page', () => {
    const pages = createPages(2);

    expect(removePages(pages, ['page-0', 'page-1'])).toBe(pages);
  });
});

describe('importPages', () => {
  it('inserts imported pages at an active position', () => {
    const pages = importPages(createPages(3), [2, 0], 1, ['import-2', 'import-0']);

    expect(getKeys(pages)).toEqual(['page-0', 'import-2', 'import-0', 'page-1', 'page-2']);
    expect(pages.slice(1, 3)).toEqual([
      {
        key: 'import-2',
        kind: 'imported',
        source: {
          kind: 'import',
          pageIndex: 2,
        },
        fieldCount: 0,
        isRemoved: false,
      },
      {
        key: 'import-0',
        kind: 'imported',
        source: {
          kind: 'import',
          pageIndex: 0,
        },
        fieldCount: 0,
        isRemoved: false,
      },
    ]);
  });

  it('inserts imported pages at the end and reset removes them', () => {
    const originalPages = createPages(2);
    const pages = importPages(originalPages, [0], 999, ['import-0']);

    expect(getKeys(pages)).toEqual(['page-0', 'page-1', 'import-0']);
    expect(getKeys(resetPages(originalPages))).toEqual(['page-0', 'page-1']);
  });
});

describe('getPageManagerSummary', () => {
  it('ignores removals and order changes that were reverted', () => {
    const removed = removePages(createPages(3), ['page-1']);
    const restored = restorePage(removed, 'page-1');
    const reordered = reorderPage(restored, 'page-0', 'page-1', 'after');
    const originalOrder = reorderPage(reordered, 'page-0', 'page-1', 'before');

    expect(getPageManagerSummary(originalOrder)).toEqual({
      pageCount: 3,
      removedCount: 0,
      duplicatedCount: 0,
      importedCount: 0,
      fieldsToDelete: 0,
      orderChanged: false,
      hasChanges: false,
    });
  });

  it('counts removed fields, duplicates, imports and order changes', () => {
    const pages = createOriginalPages({
      pageCount: 3,
      fieldCounts: { 2: 2 },
    });
    const duplicated = duplicatePage(pages, 1, 'duplicate-1');
    const imported = importPages(duplicated, [0], 0, ['import-1']);
    const withoutOriginal = removePages(imported, ['page-1']);
    const reordered = reorderPage(withoutOriginal, 'page-2', 'page-0', 'before');

    expect(getPageManagerSummary(reordered)).toEqual({
      pageCount: 4,
      removedCount: 1,
      duplicatedCount: 1,
      importedCount: 1,
      fieldsToDelete: 2,
      orderChanged: true,
      hasChanges: true,
    });
  });
});

describe('applyPageManagerOperations', () => {
  it('returns no operations when all changes are reverted', () => {
    const pages = reorderPage(createPages(3), 'page-0', 'page-1', 'after');
    const originalOrder = reorderPage(pages, 'page-0', 'page-1', 'before');

    expect(applyPageManagerOperations(originalOrder)).toEqual([]);
  });

  it('creates a duplicate before removing its original source', () => {
    const pages = duplicatePage(createPages(3), 0, 'duplicate-1');
    const removed = removePages(pages, ['page-0']);

    expect(applyPageManagerOperations(removed)).toEqual([
      { type: 'duplicate', pageIndex: 0 },
      { type: 'remove', pageIndex: 0 },
    ]);
  });

  it('imports and moves selected pages into position', () => {
    const pages = importPages(createPages(3), [0, 1], 1, ['import-0', 'import-1']);

    expect(applyPageManagerOperations(pages)).toEqual([
      {
        type: 'import',
        pageIndices: [0, 1],
        insertAt: 3,
      },
      {
        type: 'move',
        fromIndex: 3,
        toIndex: 1,
      },
      {
        type: 'move',
        fromIndex: 4,
        toIndex: 2,
      },
    ]);
  });

  it('keeps a hidden import source for a duplicate that remains', () => {
    const pages = importPages(createPages(2), [2], 999, ['import-2']);
    const duplicated = duplicatePage(pages, 2, 'duplicate-2');
    const removedImport = removePages(duplicated, ['import-2']);

    expect(applyPageManagerOperations(removedImport)).toEqual([
      {
        type: 'import',
        pageIndices: [2],
        insertAt: 2,
      },
      {
        type: 'duplicate',
        pageIndex: 2,
      },
      {
        type: 'remove',
        pageIndex: 2,
      },
    ]);
  });
});

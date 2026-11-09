export type TPageManagerPageKind = 'original' | 'imported' | 'duplicate';

export type TPageManagerPageSource =
  | {
      kind: 'original';
      pageIndex: number;
    }
  | {
      kind: 'import';
      pageIndex: number;
    };

export type TPageManagerPage = {
  key: string;
  kind: TPageManagerPageKind;
  source: TPageManagerPageSource;
  fieldCount: number;
  isRemoved: boolean;
};

export type TPageManagerReorderSide = 'before' | 'after';

export type TPageManagerSummary = {
  pageCount: number;
  removedCount: number;
  duplicatedCount: number;
  importedCount: number;
  fieldsToDelete: number;
  orderChanged: boolean;
  hasChanges: boolean;
};

export type TPageManagerOperation =
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

type TCreateOriginalPagesOptions = {
  pageCount: number;
  fieldCounts: Map<number, number> | Record<number, number>;
};

const getFieldCount = (fieldCounts: TCreateOriginalPagesOptions['fieldCounts'], pageIndex: number) => {
  if (fieldCounts instanceof Map) {
    return fieldCounts.get(pageIndex + 1) ?? 0;
  }

  return fieldCounts[pageIndex + 1] ?? 0;
};

export const getActivePages = (pages: TPageManagerPage[]) => pages.filter((page) => !page.isRemoved);

export const createOriginalPages = ({ pageCount, fieldCounts }: TCreateOriginalPagesOptions): TPageManagerPage[] =>
  Array.from({ length: pageCount }, (_, pageIndex) => ({
    key: `page-${pageIndex}`,
    kind: 'original' as const,
    source: {
      kind: 'original' as const,
      pageIndex,
    },
    fieldCount: getFieldCount(fieldCounts, pageIndex),
    isRemoved: false,
  }));

export const reorderPage = (
  pages: TPageManagerPage[],
  sourceKey: string,
  targetKey: string,
  side: TPageManagerReorderSide,
): TPageManagerPage[] => {
  const sourceIndex = pages.findIndex((page) => page.key === sourceKey);

  if (sourceIndex === -1 || sourceKey === targetKey) {
    return pages;
  }

  const next = [...pages];
  const [movedPage] = next.splice(sourceIndex, 1);
  const targetIndex = next.findIndex((page) => page.key === targetKey);

  if (!movedPage || targetIndex === -1) {
    return pages;
  }

  next.splice(side === 'after' ? targetIndex + 1 : targetIndex, 0, movedPage);

  return next;
};

export const movePageByOffset = (pages: TPageManagerPage[], pageKey: string, offset: number): TPageManagerPage[] => {
  const activePages = getActivePages(pages);
  const activeIndex = activePages.findIndex((page) => page.key === pageKey);
  const targetIndex = activeIndex + offset;

  if (activeIndex === -1 || targetIndex < 0 || targetIndex >= activePages.length) {
    return pages;
  }

  const targetPage = activePages[targetIndex];

  if (!targetPage) {
    return pages;
  }

  return reorderPage(pages, pageKey, targetPage.key, offset > 0 ? 'after' : 'before');
};

export const duplicatePage = (pages: TPageManagerPage[], pageIndex: number, key: string): TPageManagerPage[] => {
  const page = pages[pageIndex];

  if (!page || page.isRemoved) {
    return pages;
  }

  const duplicatedPage: TPageManagerPage = {
    key,
    kind: 'duplicate',
    source: page.source,
    fieldCount: 0,
    isRemoved: false,
  };

  const next = [...pages];

  next.splice(pageIndex + 1, 0, duplicatedPage);

  return next;
};

export const removePages = (pages: TPageManagerPage[], pageKeys: string[]): TPageManagerPage[] => {
  const keysToRemove = new Set(pageKeys);
  const activePages = getActivePages(pages);

  if (activePages.length === 0 || activePages.filter((page) => !keysToRemove.has(page.key)).length === 0) {
    return pages;
  }

  return pages.reduce<TPageManagerPage[]>((next, page) => {
    if (!keysToRemove.has(page.key) || page.isRemoved) {
      next.push(page);

      return next;
    }

    if (page.kind === 'original') {
      next.push({
        ...page,
        isRemoved: true,
      });
    }

    return next;
  }, []);
};

export const restorePage = (pages: TPageManagerPage[], pageKey: string): TPageManagerPage[] => {
  return pages.map((page) =>
    page.key === pageKey && page.kind === 'original' && page.isRemoved
      ? {
          ...page,
          isRemoved: false,
        }
      : page,
  );
};

export const importPages = (
  pages: TPageManagerPage[],
  importPageIndices: number[],
  activeInsertAt: number,
  keys: string[],
): TPageManagerPage[] => {
  if (importPageIndices.length === 0 || importPageIndices.length !== keys.length) {
    return pages;
  }

  const activePages = getActivePages(pages);
  const normalizedInsertAt = Math.max(0, Math.min(activeInsertAt, activePages.length));

  let insertIndex = pages.length;

  if (normalizedInsertAt === 0) {
    insertIndex = 0;
  } else if (normalizedInsertAt < activePages.length) {
    const anchorPage = activePages[normalizedInsertAt - 1];

    if (!anchorPage) {
      return pages;
    }

    const anchorIndex = pages.findIndex((page) => page.key === anchorPage.key);

    if (anchorIndex === -1) {
      return pages;
    }

    insertIndex = anchorIndex + 1;
  }

  const importedPages = importPageIndices.map(
    (pageIndex, index): TPageManagerPage => ({
      key: keys[index],
      kind: 'imported',
      source: {
        kind: 'import',
        pageIndex,
      },
      fieldCount: 0,
      isRemoved: false,
    }),
  );

  const next = [...pages];

  next.splice(insertIndex, 0, ...importedPages);

  return next;
};

export const resetPages = (originalPages: TPageManagerPage[]): TPageManagerPage[] =>
  originalPages.map((page) => ({
    ...page,
    isRemoved: false,
  }));

export const getPageManagerSummary = (pages: TPageManagerPage[]): TPageManagerSummary => {
  const activePages = getActivePages(pages);
  const originalPages = pages
    .filter((page) => page.kind === 'original')
    .sort((a, b) => a.source.pageIndex - b.source.pageIndex);
  const activeOriginalKeys = activePages.filter((page) => page.kind === 'original').map((page) => page.key);
  const activeOriginalKeySet = new Set(activeOriginalKeys);
  const expectedOriginalKeys = originalPages.map((page) => page.key).filter((key) => activeOriginalKeySet.has(key));
  const removedPages = originalPages.filter((page) => page.isRemoved);
  const duplicatedCount = activePages.filter((page) => page.kind === 'duplicate').length;
  const importedCount = activePages.filter((page) => page.kind === 'imported').length;
  const orderChanged = activeOriginalKeys.join('\u0000') !== expectedOriginalKeys.join('\u0000');
  const fieldsToDelete = removedPages.reduce((total, page) => total + page.fieldCount, 0);

  return {
    pageCount: activePages.length,
    removedCount: removedPages.length,
    duplicatedCount,
    importedCount,
    fieldsToDelete,
    orderChanged,
    hasChanges: removedPages.length > 0 || duplicatedCount > 0 || importedCount > 0 || orderChanged,
  };
};

export const applyPageManagerOperations = (pages: TPageManagerPage[]): TPageManagerOperation[] => {
  const summary = getPageManagerSummary(pages);

  if (!summary.hasChanges) {
    return [];
  }

  const activePages = getActivePages(pages);
  const finalKeys = new Set(activePages.map((page) => page.key));
  const operations: TPageManagerOperation[] = [];
  const originalPages = pages
    .filter((page) => page.kind === 'original')
    .sort((a, b) => a.source.pageIndex - b.source.pageIndex);

  type TWorkingPage = {
    key: string;
    source: TPageManagerPageSource;
  };

  const workingPages: TWorkingPage[] = originalPages.map((page) => ({
    key: page.key,
    source: page.source,
  }));

  const importSourcePages = new Map<number, string>();

  for (const page of activePages) {
    if (page.kind !== 'imported' || page.source.kind !== 'import') {
      continue;
    }

    importSourcePages.set(page.source.pageIndex, page.key);
  }

  for (const page of activePages) {
    if (page.kind !== 'duplicate' || page.source.kind !== 'import') {
      continue;
    }

    if (!importSourcePages.has(page.source.pageIndex)) {
      importSourcePages.set(page.source.pageIndex, `import-source-${page.source.pageIndex}`);
    }
  }

  if (importSourcePages.size > 0) {
    const importPageIndices = Array.from(importSourcePages.keys()).sort((a, b) => a - b);

    operations.push({
      type: 'import',
      pageIndices: importPageIndices,
      insertAt: workingPages.length,
    });

    for (const importPageIndex of importPageIndices) {
      const key = importSourcePages.get(importPageIndex);

      if (!key) {
        continue;
      }

      workingPages.push({
        key,
        source: {
          kind: 'import',
          pageIndex: importPageIndex,
        },
      });
    }
  }

  for (const page of activePages) {
    if (page.kind !== 'duplicate') {
      continue;
    }

    const sourceIndex = workingPages.findIndex(
      (workingPage) =>
        workingPage.source.kind === page.source.kind && workingPage.source.pageIndex === page.source.pageIndex,
    );

    if (sourceIndex === -1) {
      continue;
    }

    operations.push({
      type: 'duplicate',
      pageIndex: sourceIndex,
    });

    workingPages.splice(sourceIndex + 1, 0, {
      key: page.key,
      source: page.source,
    });
  }

  for (let index = workingPages.length - 1; index >= 0; index -= 1) {
    const workingPage = workingPages[index];

    if (!workingPage || finalKeys.has(workingPage.key)) {
      continue;
    }

    operations.push({
      type: 'remove',
      pageIndex: index,
    });

    workingPages.splice(index, 1);
  }

  for (let targetIndex = 0; targetIndex < activePages.length; targetIndex += 1) {
    const targetPage = activePages[targetIndex];

    if (!targetPage) {
      continue;
    }

    const currentIndex = workingPages.findIndex((page) => page.key === targetPage.key);

    if (currentIndex === -1 || currentIndex === targetIndex) {
      continue;
    }

    operations.push({
      type: 'move',
      fromIndex: currentIndex,
      toIndex: targetIndex,
    });

    const [workingPage] = workingPages.splice(currentIndex, 1);

    if (workingPage) {
      workingPages.splice(targetIndex, 0, workingPage);
    }
  }

  return operations;
};

export const pageOperationIncludesImport = (operations: TPageManagerOperation[]): boolean =>
  operations.some((operation) => operation.type === 'import');

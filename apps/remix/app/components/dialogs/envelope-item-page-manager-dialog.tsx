import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { nanoid } from '@documenso/lib/universal/id';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { getDocumentDataUrl } from '@documenso/lib/utils/envelope-download';
import { trpc } from '@documenso/trpc/react';
import type {
  TApplyEnvelopeItemPageOperationsPayload,
  TEnvelopeItemPageOperation,
} from '@documenso/trpc/server/envelope-router/apply-envelope-item-page-operations.types';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Spinner } from '@documenso/ui/primitives/spinner';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  GripVerticalIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

type ManagedPage = {
  key: string;
  originalPageIndex: number | null;
  previewPageNumber: number;
  previewSource: 'document' | 'import';
  fieldCount: number;
};

export type EnvelopeItemPageManagerDialogProps = {
  envelopeItem: {
    id: string;
    title: string;
    documentDataId: string;
  };
  trigger: ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

export const EnvelopeItemPageManagerDialog = ({
  envelopeItem,
  trigger,
  ...props
}: EnvelopeItemPageManagerDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const { envelope, editorFields, setLocalEnvelope, saveNow, registerPendingMutation, isEmbedded } =
    useCurrentEnvelopeEditor();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isLoadingImport, setIsLoadingImport] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [pages, setPages] = useState<ManagedPage[]>([]);
  const [documentThumbnails, setDocumentThumbnails] = useState<string[]>([]);
  const [operations, setOperations] = useState<TEnvelopeItemPageOperation[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importThumbnails, setImportThumbnails] = useState<string[]>([]);
  const [isImportPanelOpen, setIsImportPanelOpen] = useState(false);
  const [selectedImportPages, setSelectedImportPages] = useState<Set<number>>(new Set());
  const [insertAt, setInsertAt] = useState('1');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fieldCountByPage = useMemo(() => {
    const counts = new Map<number, number>();

    for (const field of editorFields.localFields) {
      if (field.envelopeItemId !== envelopeItem.id) {
        continue;
      }

      counts.set(field.page, (counts.get(field.page) ?? 0) + 1);
    }

    return counts;
  }, [editorFields.localFields, envelopeItem.id]);

  const fieldCountByPageRef = useRef(fieldCountByPage);

  const { mutateAsync: applyPageOperations } = trpc.envelope.item.applyPageOperations.useMutation();

  useEffect(() => {
    fieldCountByPageRef.current = fieldCountByPage;
  }, [fieldCountByPage]);

  useEffect(() => {
    if (!isImportPanelOpen) {
      return;
    }

    setInsertAt((prev) => {
      const position = Number(prev);
      const maxPosition = pages.length + 1;

      if (!Number.isInteger(position) || position < 1 || position > maxPosition) {
        return String(maxPosition);
      }

      return prev;
    });
  }, [isImportPanelOpen, pages.length]);

  useEffect(() => {
    let isCancelled = false;

    if (!isOpen) {
      setPages([]);
      setDocumentThumbnails([]);
      setOperations([]);
      setSelectedKeys(new Set());
      setDragIndex(null);
      setImportFile(null);
      setImportThumbnails([]);
      setIsImportPanelOpen(false);
      setSelectedImportPages(new Set());
      setError(null);

      return;
    }

    const loadDocument = async () => {
      setIsLoadingDocument(true);
      setError(null);
      setPages([]);
      setDocumentThumbnails([]);
      setOperations([]);
      setSelectedKeys(new Set());
      setImportFile(null);
      setImportThumbnails([]);
      setIsImportPanelOpen(false);
      setSelectedImportPages(new Set());

      try {
        const { renderPdfThumbnails } = await import('~/utils/pdf-thumbnails');

        const url = getDocumentDataUrl({
          envelopeId: envelope.id,
          envelopeItemId: envelopeItem.id,
          documentDataId: envelopeItem.documentDataId,
          token: undefined,
          version: 'current',
        });

        const { pageCount, thumbnails } = await renderPdfThumbnails({ url });

        if (isCancelled) {
          return;
        }

        const counts = fieldCountByPageRef.current;

        setDocumentThumbnails(thumbnails);
        setPages(
          Array.from({ length: pageCount }, (_, index) => ({
            key: `page-${index}`,
            originalPageIndex: index,
            previewPageNumber: index + 1,
            previewSource: 'document' as const,
            fieldCount: counts.get(index + 1) ?? 0,
          })),
        );
      } catch (err) {
        console.error(err);

        if (!isCancelled) {
          setError(t`We could not load the pages for this document item.`);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDocument(false);
        }
      }
    };

    void loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, reloadKey, envelope.id, envelopeItem.id, envelopeItem.documentDataId, t]);

  const getPageThumbnail = (page: ManagedPage) => {
    if (page.previewSource === 'document') {
      return documentThumbnails[page.previewPageNumber - 1];
    }

    return importThumbnails[page.previewPageNumber - 1];
  };

  const toggleSelected = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const movePage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= pages.length || toIndex >= pages.length) {
      return;
    }

    setPages((prev) => {
      const next = [...prev];
      const [movedPage] = next.splice(fromIndex, 1);

      next.splice(toIndex, 0, movedPage);

      return next;
    });

    setOperations((prev) => [...prev, { type: 'move', fromIndex, toIndex }]);
  };

  const duplicatePage = (index: number) => {
    const page = pages[index];

    if (!page) {
      return;
    }

    const duplicatedPage: ManagedPage = {
      ...page,
      key: nanoid(),
      fieldCount: 0,
    };

    setPages((prev) => {
      const next = [...prev];

      next.splice(index + 1, 0, duplicatedPage);

      return next;
    });

    setOperations((prev) => [...prev, { type: 'duplicate', pageIndex: index }]);
  };

  const deletePage = (index: number) => {
    const page = pages[index];

    if (!page || page.fieldCount > 0 || pages.length <= 1) {
      return;
    }

    setPages((prev) => prev.filter((_, pageIndex) => pageIndex !== index));
    setOperations((prev) => [...prev, { type: 'remove', pageIndex: index }]);
    setSelectedKeys((prev) => {
      const next = new Set(prev);

      next.delete(page.key);

      return next;
    });
  };

  const selectedHasFields = pages.some((page) => selectedKeys.has(page.key) && page.fieldCount > 0);
  const wouldRemoveAllPages = pages.length > 0 && pages.length - selectedKeys.size < 1;

  const deleteSelected = () => {
    const indices = pages
      .map((page, index) => ({ index, page }))
      .filter(({ page }) => selectedKeys.has(page.key))
      .map(({ index }) => index)
      .sort((a, b) => b - a);

    if (indices.length === 0 || pages.length - indices.length < 1 || selectedHasFields) {
      return;
    }

    const indexSet = new Set(indices);

    setPages((prev) => prev.filter((_, index) => !indexSet.has(index)));
    setOperations((prev) => [
      ...prev,
      ...indices.map((index): TEnvelopeItemPageOperation => ({ type: 'remove', pageIndex: index })),
    ]);
    setSelectedKeys(new Set());
  };

  const toggleImportPage = (pageIndex: number) => {
    setSelectedImportPages((prev) => {
      const next = new Set(prev);

      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }

      return next;
    });
  };

  const onImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    if (file.size > megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT)) {
      toast({
        title: t`File too large`,
        description: t`The file exceeds the maximum allowed size of ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT} MB.`,
        duration: 5000,
        variant: 'destructive',
      });

      return;
    }

    setIsLoadingImport(true);
    setError(null);

    try {
      const { renderPdfThumbnails } = await import('~/utils/pdf-thumbnails');
      const data = new Uint8Array(await file.arrayBuffer());

      const { thumbnails } = await renderPdfThumbnails({ data });

      setImportFile(file);
      setImportThumbnails(thumbnails);
      setSelectedImportPages(new Set());
      setIsImportPanelOpen(true);
      setInsertAt(String(pages.length + 1));
    } catch (err) {
      console.error(err);

      toast({
        title: t`Failed to read file`,
        description: t`The file is not a valid PDF or is password protected.`,
        duration: 5000,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingImport(false);
    }
  };

  const cancelImport = () => {
    setIsImportPanelOpen(false);
    setImportFile(null);
    setImportThumbnails([]);
    setSelectedImportPages(new Set());
  };

  const addImportedPages = () => {
    if (!importFile || selectedImportPages.size === 0) {
      return;
    }

    const insertPosition = Number(insertAt);

    if (!Number.isInteger(insertPosition) || insertPosition < 1 || insertPosition > pages.length + 1) {
      return;
    }

    const pageIndices = Array.from(selectedImportPages).sort((a, b) => a - b);
    const insertIndex = insertPosition - 1;

    const importedPages = pageIndices.map(
      (pageIndex): ManagedPage => ({
        key: nanoid(),
        originalPageIndex: null,
        previewPageNumber: pageIndex + 1,
        previewSource: 'import',
        fieldCount: 0,
      }),
    );

    setPages((prev) => {
      const next = [...prev];

      next.splice(insertIndex, 0, ...importedPages);

      return next;
    });

    setOperations((prev) => [...prev, { type: 'import', pageIndices, insertAt: insertIndex }]);
    setIsImportPanelOpen(false);
    setSelectedImportPages(new Set());
  };

  const onApply = async () => {
    if (operations.length === 0 || isApplying || isImportPanelOpen) {
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      await saveNow();

      const payload = {
        envelopeId: envelope.id,
        envelopeItemId: envelopeItem.id,
        operations,
      } satisfies TApplyEnvelopeItemPageOperationsPayload;

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));

      if (importFile) {
        formData.append('file', importFile);
      }

      const applyPromise = applyPageOperations(formData);

      registerPendingMutation(applyPromise);

      const { data, fields } = await applyPromise;

      setLocalEnvelope({
        envelopeItems: envelope.envelopeItems.map((item) => (item.id === data.id ? { ...item, ...data } : item)),
        fields,
      });

      editorFields.resetForm(fields);

      setIsOpen(false);

      toast({
        title: t`Pages updated`,
        description: t`The pages for this item have been updated.`,
      });
    } catch (err) {
      console.error(err);

      const parsedError = AppError.parseError(err);

      const description =
        parsedError.code === AppErrorCode.ENVELOPE_ITEM_PAGE_HAS_FIELDS
          ? t`Pages containing fields cannot be deleted. Remove the fields from those pages first.`
          : parsedError.userMessage || parsedError.message || t`Something went wrong while updating the pages.`;

      setError(description);

      toast({
        title: t`Failed to update pages`,
        description,
        duration: 5000,
        variant: 'destructive',
      });
    } finally {
      setIsApplying(false);
    }
  };

  const onOpenChange = (value: boolean) => {
    if (!isApplying) {
      setIsOpen(value);
    }
  };

  if (isEmbedded) {
    return null;
  }

  const operationCount = operations.length;

  return (
    <Dialog {...props} open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger onClick={(event) => event.stopPropagation()} asChild>
        {trigger}
      </DialogTrigger>

      <DialogContent
        className="max-w-4xl"
        data-testid="page-manager-dialog"
        onInteractOutside={(event) => isApplying && event.preventDefault()}
        onEscapeKeyDown={(event) => isApplying && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            <Trans>Manage pages</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Reorder, duplicate, delete, or import pages for this document.</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {error && (
            <Alert variant="destructive" padding="tight" data-testid="page-manager-error">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                data-testid="page-manager-import-file-input"
                onChange={(event) => void onImportFileChange(event)}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={isLoadingImport}
                disabled={isLoadingDocument || isLoadingImport || importFile !== null || isApplying}
                onClick={() => fileInputRef.current?.click()}
                data-testid="page-manager-import-button"
              >
                <UploadIcon className="mr-2 h-4 w-4" />
                <Trans>Import from PDF</Trans>
              </Button>

              {operationCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isApplying}
                  onClick={() => setReloadKey((value) => value + 1)}
                  data-testid="page-manager-reset-button"
                >
                  <RotateCcwIcon className="mr-2 h-4 w-4" />
                  <Trans>Reset</Trans>
                </Button>
              )}
            </div>

            <p className="text-muted-foreground text-xs">
              <Trans>Drag pages to reorder them.</Trans>
            </p>
          </div>

          {selectedKeys.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-sm">
                <Plural one="# page selected" other="# pages selected" value={selectedKeys.size} />
              </span>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={selectedHasFields || wouldRemoveAllPages || isApplying}
                title={
                  selectedHasFields
                    ? t`Pages with fields cannot be deleted`
                    : wouldRemoveAllPages
                      ? t`At least one page must remain`
                      : undefined
                }
                onClick={deleteSelected}
                data-testid="page-manager-delete-selected"
              >
                <Trash2Icon className="mr-2 h-4 w-4" />
                <Trans>Delete selected</Trans>
              </Button>
            </div>
          )}

          {isImportPanelOpen && importFile && (
            <div className="space-y-3 rounded-md border bg-muted/20 p-3" data-testid="page-manager-import-panel">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{importFile.name}</p>
                  <p className="text-muted-foreground text-xs">
                    <Plural one="1 page available" other="# pages available" value={importThumbnails.length} />
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={isApplying}
                  onClick={cancelImport}
                  data-testid="page-manager-cancel-import"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {importThumbnails.map((thumbnail, pageIndex) => {
                  const isImportPageSelected = selectedImportPages.has(pageIndex);

                  return (
                    <button
                      type="button"
                      key={pageIndex}
                      data-testid={`page-manager-import-page-${pageIndex}`}
                      aria-pressed={isImportPageSelected}
                      className={cn(
                        'relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded border bg-background',
                        isImportPageSelected && 'border-primary ring-2 ring-primary/30',
                      )}
                      onClick={() => toggleImportPage(pageIndex)}
                    >
                      <img src={thumbnail} alt="" className="h-full w-full object-contain" draggable={false} />

                      <span
                        className={cn(
                          'absolute top-1 left-1 flex h-4 w-4 items-center justify-center rounded-sm border',
                          isImportPageSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-background',
                        )}
                      >
                        {isImportPageSelected && <CheckIcon className="h-3 w-3 stroke-[3px]" />}
                      </span>

                      <span className="absolute right-1 bottom-1 rounded bg-background/80 px-1 text-xs">
                        {pageIndex + 1}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <label className="font-medium text-sm" htmlFor="page-manager-insert-position-select">
                    <Trans>Insert position</Trans>
                  </label>

                  <Select value={insertAt} onValueChange={setInsertAt}>
                    <SelectTrigger id="page-manager-insert-position-select" data-testid="page-manager-insert-position">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {Array.from({ length: pages.length + 1 }, (_, index) => index + 1).map((position) => (
                        <SelectItem key={position} value={String(position)}>
                          {position === 1
                            ? t`Before page 1`
                            : position === pages.length + 1
                              ? t`At the end`
                              : t`After page ${position - 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  disabled={selectedImportPages.size === 0 || isApplying}
                  onClick={addImportedPages}
                  data-testid="page-manager-add-imported-pages"
                >
                  <Plural one="Add # page" other="Add # pages" value={selectedImportPages.size} />
                </Button>
              </div>
            </div>
          )}

          {isLoadingDocument ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : pages.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
              <Trans>No pages found</Trans>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {pages.map((page, index) => {
                const thumbnail = getPageThumbnail(page);
                const isSelected = selectedKeys.has(page.key);

                return (
                  <div
                    key={page.key}
                    data-testid={`page-manager-page-${index}`}
                    draggable={!isApplying}
                    className={cn(
                      'group relative flex flex-col gap-2 rounded-md border bg-muted/20 p-2 transition-colors',
                      isSelected && 'border-primary ring-2 ring-primary/30',
                      dragIndex === index && 'opacity-50',
                    )}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', page.key);
                      setDragIndex(index);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    onDrop={(event) => {
                      event.preventDefault();

                      if (dragIndex !== null && dragIndex !== index) {
                        movePage(dragIndex, index);
                      }

                      setDragIndex(null);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 font-medium text-xs">
                        {index + 1}
                      </span>

                      <div className="flex items-center gap-1">
                        {page.fieldCount > 0 && (
                          <Badge
                            variant="secondary"
                            title={t`Pages with fields cannot be deleted`}
                            data-testid={`page-manager-field-count-${index}`}
                          >
                            <Plural one="# field" other="# fields" value={page.fieldCount} />
                          </Badge>
                        )}

                        <GripVerticalIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="relative flex h-44 items-center justify-center overflow-hidden rounded border bg-background">
                      {thumbnail ? (
                        <img src={thumbnail} alt="" className="h-full w-full object-contain" draggable={false} />
                      ) : (
                        <Spinner size="sm" />
                      )}

                      <div className="absolute top-1 left-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelected(page.key)}
                          data-testid={`page-manager-select-${index}`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={index === 0 || isApplying}
                          title={t`Move left`}
                          onClick={() => movePage(index, index - 1)}
                          data-testid={`page-manager-move-left-${index}`}
                        >
                          <ArrowLeftIcon className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={index === pages.length - 1 || isApplying}
                          title={t`Move right`}
                          onClick={() => movePage(index, index + 1)}
                          data-testid={`page-manager-move-right-${index}`}
                        >
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={isApplying}
                          title={t`Duplicate page`}
                          onClick={() => duplicatePage(index)}
                          data-testid={`page-manager-duplicate-${index}`}
                        >
                          <CopyIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        disabled={page.fieldCount > 0 || pages.length <= 1 || isApplying}
                        title={
                          page.fieldCount > 0
                            ? t`Pages with fields cannot be deleted`
                            : pages.length <= 1
                              ? t`At least one page must remain`
                              : t`Delete page`
                        }
                        onClick={() => deletePage(index)}
                        data-testid={`page-manager-delete-${index}`}
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" disabled={isApplying} onClick={() => setIsOpen(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button
            type="button"
            loading={isApplying}
            disabled={operations.length === 0 || isLoadingDocument || isImportPanelOpen}
            onClick={() => void onApply()}
            data-testid="page-manager-apply-button"
          >
            <Trans>Apply changes</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

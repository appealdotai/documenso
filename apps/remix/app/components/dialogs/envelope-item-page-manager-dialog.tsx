import {
  applyPageManagerOperations,
  createOriginalPages,
  duplicatePage,
  getActivePages,
  getPageManagerSummary,
  importPages,
  movePageByOffset,
  pageOperationIncludesImport,
  removePages,
  reorderPage,
  resetPages,
  restorePage,
  type TPageManagerPage,
  type TPageManagerReorderSide,
} from '@documenso/lib/client-only/page-manager-state';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@documenso/ui/primitives/alert-dialog';
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
  CheckIcon,
  CopyIcon,
  RotateCcwIcon,
  Trash2Icon,
  Undo2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type EnvelopeItemPageManagerDialogProps = {
  envelopeItem: {
    id: string;
    title: string;
    documentDataId: string;
  };
  trigger: ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

type TPageDropTarget = {
  key: string;
  side: TPageManagerReorderSide;
};

const PAGE_DRAG_MIME_TYPE = 'application/x-documenso-page';

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
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pages, setPages] = useState<TPageManagerPage[]>([]);
  const [originalPages, setOriginalPages] = useState<TPageManagerPage[]>([]);
  const [documentThumbnails, setDocumentThumbnails] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TPageDropTarget | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importThumbnails, setImportThumbnails] = useState<string[]>([]);
  const [isImportPanelOpen, setIsImportPanelOpen] = useState(false);
  const [selectedImportPages, setSelectedImportPages] = useState<Set<number>>(new Set());
  const [insertAt, setInsertAt] = useState('1');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const allowCloseRef = useRef(false);
  const dragKeyRef = useRef<string | null>(null);
  const dropTargetRef = useRef<TPageDropTarget | null>(null);

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

  useEffect(() => {
    fieldCountByPageRef.current = fieldCountByPage;
  }, [fieldCountByPage]);

  const activePages = useMemo(() => getActivePages(pages), [pages]);
  const summary = useMemo(() => getPageManagerSummary(pages), [pages]);
  const operations = useMemo(() => applyPageManagerOperations(pages), [pages]);
  const activePageIndexByKey = useMemo(
    () => new Map(activePages.map((page, index) => [page.key, index])),
    [activePages],
  );
  const selectedActiveCount = useMemo(
    () => activePages.filter((page) => selectedKeys.has(page.key)).length,
    [activePages, selectedKeys],
  );
  const selectedFieldCount = useMemo(
    () => activePages.filter((page) => selectedKeys.has(page.key)).reduce((total, page) => total + page.fieldCount, 0),
    [activePages, selectedKeys],
  );

  const { mutateAsync: applyPageOperations } = trpc.envelope.item.applyPageOperations.useMutation();

  const clearDragState = useCallback(() => {
    dragKeyRef.current = null;
    dropTargetRef.current = null;
    setDragKey(null);
    setDropTarget(null);
  }, []);

  const setActiveDropTarget = useCallback((nextTarget: TPageDropTarget | null) => {
    const currentTarget = dropTargetRef.current;

    if (currentTarget?.key === nextTarget?.key && currentTarget?.side === nextTarget?.side) {
      return;
    }

    dropTargetRef.current = nextTarget;
    setDropTarget(nextTarget);
  }, []);

  const getPageDropTargetAtPoint = useCallback((clientX: number, clientY: number): TPageDropTarget | null => {
    const element = document.elementFromPoint(clientX, clientY);
    let card = element?.closest('[data-page-key]') as HTMLElement | null;

    if (!card) {
      let closestCard: HTMLElement | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const pageElement of pageElementsRef.current.values()) {
        const key = pageElement.dataset.pageKey;

        if (!key || key === dragKeyRef.current || pageElement.dataset.pageRemoved === 'true') {
          continue;
        }

        const rect = pageElement.getBoundingClientRect();
        const distanceX = Math.max(rect.left - clientX, 0, clientX - rect.right);
        const distanceY = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
        const distance = Math.hypot(distanceX, distanceY);

        if (distance < closestDistance) {
          closestCard = pageElement;
          closestDistance = distance;
        }
      }

      card = closestCard;
    }

    const key = card?.dataset.pageKey;

    if (!card || !key || key === dragKeyRef.current || card.dataset.pageRemoved === 'true') {
      return null;
    }

    const rect = card.getBoundingClientRect();

    return {
      key,
      side: clientX < rect.left + rect.width / 2 ? 'before' : 'after',
    };
  }, []);

  const onPageDragStart = (event: DragEvent<HTMLElement>, page: TPageManagerPage) => {
    if (page.isRemoved || isApplying) {
      event.preventDefault();

      return;
    }

    dragKeyRef.current = page.key;
    dropTargetRef.current = null;

    setDragKey(page.key);
    setDropTarget(null);

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(PAGE_DRAG_MIME_TYPE, page.key);
    event.dataTransfer.setData('text/plain', page.key);
  };

  const onPageGridDragOver = (event: DragEvent<HTMLFieldSetElement>) => {
    const isPageDrag =
      dragKeyRef.current !== null || Array.from(event.dataTransfer.types).includes(PAGE_DRAG_MIME_TYPE);

    if (!isPageDrag) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    setActiveDropTarget(getPageDropTargetAtPoint(event.clientX, event.clientY));
  };

  const onPageGridDragLeave = (event: DragEvent<HTMLFieldSetElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setActiveDropTarget(null);
  };

  const onPageGridDrop = (event: DragEvent<HTMLFieldSetElement>) => {
    event.preventDefault();

    const sourceKey =
      event.dataTransfer.getData(PAGE_DRAG_MIME_TYPE) || event.dataTransfer.getData('text/plain') || dragKeyRef.current;
    const target = getPageDropTargetAtPoint(event.clientX, event.clientY) ?? dropTargetRef.current;

    if (sourceKey && target && sourceKey !== target.key) {
      setPages((prev) => reorderPage(prev, sourceKey, target.key, target.side));
    }

    clearDragState();
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.addEventListener('dragend', clearDragState);
    window.addEventListener('drop', clearDragState);

    return () => {
      window.removeEventListener('dragend', clearDragState);
      window.removeEventListener('drop', clearDragState);
    };
  }, [clearDragState, isOpen]);

  useEffect(() => {
    if (!isImportPanelOpen) {
      return;
    }

    setInsertAt((prev) => {
      const position = Number(prev);
      const maxPosition = activePages.length + 1;

      if (!Number.isInteger(position) || position < 1 || position > maxPosition) {
        return String(maxPosition);
      }

      return prev;
    });
  }, [isImportPanelOpen, activePages.length]);

  useEffect(() => {
    let isCancelled = false;

    if (!isOpen) {
      allowCloseRef.current = false;
      setPages([]);
      setOriginalPages([]);
      setDocumentThumbnails([]);
      setSelectedKeys(new Set());
      dragKeyRef.current = null;
      dropTargetRef.current = null;
      setDragKey(null);
      setDropTarget(null);
      setImportFile(null);
      setImportThumbnails([]);
      setIsImportPanelOpen(false);
      setSelectedImportPages(new Set());
      setIsDiscardDialogOpen(false);
      setError(null);

      return;
    }

    allowCloseRef.current = false;

    const loadDocument = async () => {
      setIsLoadingDocument(true);
      setError(null);
      setPages([]);
      setOriginalPages([]);
      setDocumentThumbnails([]);
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

        const basePages = createOriginalPages({
          pageCount,
          fieldCounts: fieldCountByPageRef.current,
        });

        setDocumentThumbnails(thumbnails);
        setOriginalPages(basePages);
        setPages(basePages);
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
  }, [isOpen, envelope.id, envelopeItem.id, envelopeItem.documentDataId, t]);

  const getPageThumbnail = (page: TPageManagerPage) => {
    if (page.source.kind === 'original') {
      return documentThumbnails[page.source.pageIndex];
    }

    return importThumbnails[page.source.pageIndex];
  };

  const getPageCaption = (page: TPageManagerPage) => {
    if (page.kind === 'imported') {
      return t`Imported`;
    }

    if (page.kind !== 'duplicate') {
      return null;
    }

    if (page.source.kind === 'original') {
      return t`Copy of p.${page.source.pageIndex + 1}`;
    }

    return t`Copy of imported p.${page.source.pageIndex + 1}`;
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

  const toggleSelectAll = () => {
    if (selectedActiveCount === activePages.length) {
      setSelectedKeys(new Set());

      return;
    }

    setSelectedKeys(new Set(activePages.map((page) => page.key)));
  };

  const removePageByKey = (key: string) => {
    setPages((prev) => {
      if (getActivePages(prev).length <= 1) {
        return prev;
      }

      return removePages(prev, [key]);
    });

    setSelectedKeys((prev) => {
      const next = new Set(prev);

      next.delete(key);

      return next;
    });
  };

  const removeSelected = () => {
    if (selectedKeys.size === 0 || selectedActiveCount >= activePages.length) {
      return;
    }

    const keys = Array.from(selectedKeys);

    setPages((prev) => removePages(prev, keys));
    setSelectedKeys(new Set());
  };

  const duplicateSelected = () => {
    if (selectedKeys.size === 0) {
      return;
    }

    const selectedPages = activePages.filter((page) => selectedKeys.has(page.key));

    setPages((prev) => {
      let next = prev;

      for (const page of selectedPages) {
        const pageIndex = next.findIndex((item) => item.key === page.key);

        if (pageIndex === -1) {
          continue;
        }

        next = duplicatePage(next, pageIndex, nanoid());
      }

      return next;
    });

    setSelectedKeys(new Set());
  };

  const restoreRemovedPage = (key: string) => {
    setPages((prev) => restorePage(prev, key));
  };

  const resetPageState = () => {
    setPages(resetPages(originalPages));
    setSelectedKeys(new Set());
    dragKeyRef.current = null;
    dropTargetRef.current = null;
    setDragKey(null);
    setDropTarget(null);
    setImportFile(null);
    setImportThumbnails([]);
    setIsImportPanelOpen(false);
    setSelectedImportPages(new Set());
    setError(null);
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

  const getDefaultImportPosition = () => {
    let lastSelectedIndex = -1;

    activePages.forEach((page, index) => {
      if (selectedKeys.has(page.key)) {
        lastSelectedIndex = index;
      }
    });

    return lastSelectedIndex === -1 ? activePages.length + 1 : lastSelectedIndex + 2;
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
      setInsertAt(String(getDefaultImportPosition()));
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

    if (!Number.isInteger(insertPosition) || insertPosition < 1 || insertPosition > activePages.length + 1) {
      return;
    }

    const pageIndices = Array.from(selectedImportPages).sort((a, b) => a - b);
    const keys = pageIndices.map(() => nanoid());

    setPages((prev) => importPages(prev, pageIndices, insertPosition - 1, keys));
    setIsImportPanelOpen(false);
    setSelectedImportPages(new Set());
  };

  const onApply = async () => {
    if (operations.length === 0 || isApplying || isImportPanelOpen) {
      return;
    }

    const needsImportFile = pageOperationIncludesImport(operations);

    if (needsImportFile && !importFile) {
      setError(t`Select a PDF before adding imported pages.`);

      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      await saveNow();

      const payload = {
        envelopeId: envelope.id,
        envelopeItemId: envelopeItem.id,
        operations: operations satisfies TEnvelopeItemPageOperation[],
      } satisfies TApplyEnvelopeItemPageOperationsPayload;

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));

      if (needsImportFile && importFile) {
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

      allowCloseRef.current = true;
      setIsDiscardDialogOpen(false);
      setIsOpen(false);

      toast({
        title: t`Pages updated`,
        description: t`The pages for this item have been updated.`,
      });
    } catch (err) {
      console.error(err);

      const parsedError = AppError.parseError(err);

      const description =
        parsedError.userMessage || parsedError.message || t`Something went wrong while updating the pages.`;

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

  const closeDialog = () => {
    allowCloseRef.current = true;
    setIsDiscardDialogOpen(false);
    setIsOpen(false);
  };

  const requestClose = () => {
    if (isApplying) {
      return;
    }

    if (summary.hasChanges) {
      setIsDiscardDialogOpen(true);

      return;
    }

    closeDialog();
  };

  const onOpenChange = (value: boolean) => {
    if (value) {
      setIsOpen(true);

      return;
    }

    if (isApplying) {
      return;
    }

    if (summary.hasChanges && !allowCloseRef.current) {
      setIsDiscardDialogOpen(true);

      return;
    }

    allowCloseRef.current = false;
    setIsOpen(false);
  };

  const onPageKeyDown = (event: KeyboardEvent<HTMLElement>, page: TPageManagerPage) => {
    if (page.isRemoved) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target !== event.currentTarget && target.closest('button,[role="checkbox"]')) {
      return;
    }

    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      setPages((prev) => movePageByOffset(prev, page.key, event.key === 'ArrowLeft' ? -1 : 1));

      return;
    }

    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      toggleSelected(page.key);

      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && summary.pageCount > 1) {
      event.preventDefault();
      removePageByKey(page.key);
    }
  };

  const summaryItems: ReactNode[] = [];

  if (summary.orderChanged) {
    summaryItems.push(<Trans key="order-changed">Order changed</Trans>);
  }

  if (summary.removedCount > 0) {
    summaryItems.push(<Plural key="removed" one="# removed" other="# removed" value={summary.removedCount} />);
  }

  if (summary.duplicatedCount > 0) {
    summaryItems.push(
      <Plural key="duplicated" one="# duplicated" other="# duplicated" value={summary.duplicatedCount} />,
    );
  }

  if (summary.importedCount > 0) {
    summaryItems.push(<Plural key="imported" one="# imported" other="# imported" value={summary.importedCount} />);
  }

  if (isEmbedded) {
    return null;
  }

  return (
    <Dialog {...props} open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger onClick={(event) => event.stopPropagation()} asChild>
        {trigger}
      </DialogTrigger>

      <DialogContent
        className="flex h-[min(92vh,780px)] w-[calc(100%-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:h-[min(88vh,780px)] sm:w-full sm:max-w-4xl"
        data-testid="page-manager-dialog"
        onInteractOutside={(event) => isApplying && event.preventDefault()}
        onEscapeKeyDown={(event) => isApplying && event.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 sm:px-6">
          <DialogTitle>
            <Trans>Manage pages</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Reorder, duplicate, delete, or import pages for this document.</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
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

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isLoadingDocument || activePages.length === 0 || isApplying}
              onClick={toggleSelectAll}
              data-testid="page-manager-select-all"
            >
              {selectedActiveCount === activePages.length && activePages.length > 0 ? (
                <Trans>Clear selection</Trans>
              ) : (
                <Trans>Select all</Trans>
              )}
            </Button>
          </div>

          <p className="hidden text-muted-foreground text-xs sm:block">
            <Trans>Drag pages to reorder them.</Trans>
          </p>
        </div>

        {selectedKeys.size > 0 && (
          <div
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2 sm:px-6"
            data-testid="page-manager-selection-bar"
          >
            <div className="min-w-0">
              <span className="text-sm">
                <Plural one="# page selected" other="# pages selected" value={selectedKeys.size} />
              </span>

              {selectedFieldCount > 0 && (
                <span className="ml-2 text-destructive text-xs">
                  <Plural one="# field will be deleted" other="# fields will be deleted" value={selectedFieldCount} />
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isApplying}
                onClick={duplicateSelected}
                data-testid="page-manager-duplicate-selected"
              >
                <CopyIcon className="mr-2 h-3.5 w-3.5" />
                <Trans>Duplicate</Trans>
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={selectedActiveCount >= activePages.length || isApplying}
                title={selectedActiveCount >= activePages.length ? t`At least one page must remain` : undefined}
                onClick={removeSelected}
                data-testid="page-manager-delete-selected"
              >
                <Trash2Icon className="mr-2 h-3.5 w-3.5" />
                <Trans>Remove</Trans>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isApplying}
                onClick={() => setSelectedKeys(new Set())}
                data-testid="page-manager-clear-selection"
              >
                <Trans>Clear</Trans>
              </Button>
            </div>
          </div>
        )}

        <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6">
          {error && (
            <Alert variant="destructive" padding="tight" data-testid="page-manager-error">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
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
                  <span className="sr-only">
                    <Trans>Cancel import</Trans>
                  </span>
                </Button>
              </div>

              <div className="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2 overflow-y-auto">
                {importThumbnails.map((thumbnail, pageIndex) => {
                  const isImportPageSelected = selectedImportPages.has(pageIndex);

                  return (
                    <button
                      type="button"
                      key={pageIndex}
                      data-testid={`page-manager-import-page-${pageIndex}`}
                      aria-pressed={isImportPageSelected}
                      className={cn(
                        'relative flex h-28 min-w-0 items-center justify-center overflow-hidden rounded border bg-background',
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
                      {Array.from({ length: activePages.length + 1 }, (_, index) => index + 1).map((position) => (
                        <SelectItem key={position} value={String(position)}>
                          {position === 1
                            ? t`Before page 1`
                            : position === activePages.length + 1
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
            <fieldset
              aria-label={t`Page order`}
              className="grid w-full min-w-0 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-[14px]"
              data-testid="page-manager-grid"
              onDragOver={onPageGridDragOver}
              onDragLeave={onPageGridDragLeave}
              onDrop={onPageGridDrop}
              onDragEnd={clearDragState}
            >
              {pages.map((page) => {
                const activePageIndex = activePageIndexByKey.get(page.key);
                const thumbnail = getPageThumbnail(page);
                const caption = getPageCaption(page);
                const isSelected = selectedKeys.has(page.key);
                const pageNumber = activePageIndex !== undefined ? activePageIndex + 1 : page.source.pageIndex + 1;
                const isDropTarget = dropTarget?.key === page.key;

                return (
                  <fieldset
                    key={page.key}
                    ref={(element) => {
                      if (element) {
                        pageElementsRef.current.set(page.key, element);
                      } else {
                        pageElementsRef.current.delete(page.key);
                      }
                    }}
                    tabIndex={page.isRemoved ? -1 : 0}
                    aria-label={
                      page.isRemoved
                        ? t`Page ${pageNumber} removed`
                        : caption
                          ? t`Page ${pageNumber}, ${caption}`
                          : t`Page ${pageNumber}`
                    }
                    data-testid={
                      page.isRemoved
                        ? `page-manager-removed-page-${page.source.pageIndex}`
                        : `page-manager-page-${activePageIndex}`
                    }
                    data-page-key={page.key}
                    data-page-removed={page.isRemoved ? 'true' : undefined}
                    draggable={!page.isRemoved && !isApplying}
                    className={cn(
                      'group relative flex min-w-0 cursor-grab flex-col gap-1.5 rounded-md border bg-muted/20 p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing',
                      isSelected && 'border-primary ring-2 ring-primary/30',
                      page.isRemoved && 'cursor-default opacity-60',
                      dragKey === page.key && 'opacity-40',
                    )}
                    onKeyDown={(event) => onPageKeyDown(event, page)}
                    onDragStart={(event) => onPageDragStart(event, page)}
                  >
                    {isDropTarget && (
                      <span
                        aria-hidden
                        className={cn(
                          'pointer-events-none absolute inset-y-1 z-20 w-0.5 rounded-full bg-primary',
                          dropTarget.side === 'before' ? '-left-[8px]' : '-right-[8px]',
                        )}
                        data-testid="page-manager-drop-indicator"
                        data-drop-side={dropTarget.side}
                      />
                    )}

                    <div className="relative flex h-40 min-w-0 items-center justify-center overflow-hidden rounded border bg-background">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt=""
                          className="h-full w-full object-contain"
                          draggable={false}
                          loading="lazy"
                        />
                      ) : (
                        <Spinner size="sm" />
                      )}

                      <div className="absolute top-1 left-1 z-10 rounded bg-background/90 p-0.5">
                        <Checkbox
                          checked={isSelected}
                          disabled={page.isRemoved || isApplying}
                          aria-label={t`Select page ${pageNumber}`}
                          onCheckedChange={() => toggleSelected(page.key)}
                          data-testid={`page-manager-select-${activePageIndex}`}
                        />
                      </div>

                      {page.fieldCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="pointer-events-none absolute top-1 right-1 z-10 h-5 max-w-[calc(100%-2rem)] px-1.5 text-[10px]"
                          title={t`Removing this page will delete its fields`}
                          data-testid={`page-manager-field-count-${activePageIndex}`}
                        >
                          <Plural one="# field" other="# fields" value={page.fieldCount} />
                        </Badge>
                      )}

                      <span className="absolute bottom-1 left-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-background/90 px-1.5 font-medium text-[10px] shadow-sm">
                        {pageNumber}
                      </span>

                      {!page.isRemoved && (
                        <div
                          className={cn(
                            'absolute right-1 bottom-1 z-10 flex items-center gap-1 rounded bg-background/90 p-0.5 opacity-100 shadow-sm transition-opacity',
                            '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100',
                            isSelected && 'opacity-100',
                          )}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            disabled={isApplying}
                            title={t`Duplicate page`}
                            aria-label={t`Duplicate page ${pageNumber}`}
                            onClick={() => {
                              setPages((prev) => {
                                const pageIndex = prev.findIndex((item) => item.key === page.key);

                                return pageIndex === -1 ? prev : duplicatePage(prev, pageIndex, nanoid());
                              });
                            }}
                            data-testid={`page-manager-duplicate-${activePageIndex}`}
                          >
                            <CopyIcon className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            disabled={summary.pageCount <= 1 || isApplying}
                            title={summary.pageCount <= 1 ? t`At least one page must remain` : t`Remove page`}
                            aria-label={t`Remove page ${pageNumber}`}
                            onClick={() => removePageByKey(page.key)}
                            data-testid={`page-manager-delete-${activePageIndex}`}
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}

                      {page.isRemoved && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/85 p-2 text-center">
                          <span className="font-medium text-xs">
                            <Trans>Removed</Trans>
                          </span>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={isApplying}
                            onClick={() => restoreRemovedPage(page.key)}
                            data-testid={`page-manager-restore-${page.source.pageIndex}`}
                          >
                            <Undo2Icon className="mr-1 h-3 w-3" />
                            <Trans>Undo</Trans>
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="min-h-[14px] min-w-0 px-0.5">
                      {caption && <p className="truncate text-[10px] text-muted-foreground">{caption}</p>}
                    </div>
                  </fieldset>
                );
              })}
            </fieldset>
          )}
        </div>

        <DialogFooter className="shrink-0 items-start gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0 sm:space-y-0 sm:px-6">
          <div className="min-w-0 space-y-1" aria-live="polite" data-testid="page-manager-summary">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground text-xs">
              <Plural one="# page" other="# pages" value={summary.pageCount} />

              {summary.hasChanges ? (
                summaryItems.map((item, index) => (
                  <span key={index} className="inline-flex items-center gap-1.5">
                    <span aria-hidden>·</span>
                    {item}
                  </span>
                ))
              ) : (
                <span>
                  <Trans>No changes yet</Trans>
                </span>
              )}
            </p>

            {summary.fieldsToDelete > 0 && (
              <p className="text-destructive text-xs">
                <Plural
                  one="# field will be deleted when you apply"
                  other="# fields will be deleted when you apply"
                  value={summary.fieldsToDelete}
                />
              </p>
            )}
          </div>

          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              disabled={!summary.hasChanges || isApplying}
              onClick={resetPageState}
              data-testid="page-manager-reset-button"
            >
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              <Trans>Reset</Trans>
            </Button>

            <Button type="button" variant="secondary" disabled={isApplying} onClick={requestClose}>
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
          </div>
        </DialogFooter>

        <AlertDialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>Discard page changes?</Trans>
              </AlertDialogTitle>
              <AlertDialogDescription>
                {summary.fieldsToDelete > 0 ? (
                  <Trans>
                    Your page changes have not been applied. Discarding them will also keep the fields on those pages.
                  </Trans>
                ) : (
                  <Trans>Your page changes have not been applied and will be lost.</Trans>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>
                <Trans>Keep editing</Trans>
              </AlertDialogCancel>

              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={closeDialog}
              >
                <Trans>Discard changes</Trans>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

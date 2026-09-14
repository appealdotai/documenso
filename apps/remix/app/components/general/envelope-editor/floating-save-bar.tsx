import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { CheckIcon, Redo2Icon, RotateCcwIcon, Undo2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * Floating bottom bar shown when auto-save is disabled and there are unsaved
 * changes.  Provides Save, Discard, Undo and Redo actions in one place.
 *
 * The outer wrapper has `pointer-events-none` so the transparent padding around
 * the pill never intercepts Konva canvas events.  The inner pill restores
 * `pointer-events-auto`.  All interactive elements use `onPointerDown` so they
 * respond on the first touch/click even when a canvas event is still in flight.
 */
export const FloatingSaveBar = () => {
  const { t } = useLingui();

  const { saveNow, discardChanges, editorFields, isAutosaving } = useCurrentEnvelopeEditor();

  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveNow();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    try {
      await discardChanges();
    } finally {
      setIsDiscarding(false);
    }
  };

  const isBusy = isSaving || isDiscarding || isAutosaving;

  return (
    // Outer wrapper: pointer-events-none keeps the transparent region from
    // swallowing canvas / Konva pointer events underneath.
    <div className="pointer-events-none fixed right-0 bottom-6 left-0 z-50 flex justify-center">
      {/* Inner pill: pointer-events-auto restores interactivity only on the pill */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
        {/* Undo */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={!editorFields.canUndo || isBusy}
          title={t`Undo (Ctrl+Z)`}
          onClick={(e) => {
            e.stopPropagation();
            editorFields.undo();
          }}
        >
          <Undo2Icon className="h-4 w-4" />
        </Button>

        {/* Redo */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={!editorFields.canRedo || isBusy}
          title={t`Redo (Ctrl+Shift+Z)`}
          onClick={(e) => {
            e.stopPropagation();
            editorFields.redo();
          }}
        >
          <Redo2Icon className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-5 w-px bg-border" />

        <span className="mr-1 select-none text-muted-foreground text-sm">
          <Trans>Unsaved changes</Trans>
        </span>

        {/* Discard */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={isBusy}
          onClick={(e) => {
            e.stopPropagation();
            void handleDiscard();
          }}
        >
          {isDiscarding ? <RotateCcwIcon className="h-3.5 w-3.5 animate-spin" /> : <XIcon className="h-3.5 w-3.5" />}
          <Trans>Discard</Trans>
        </Button>

        {/* Save */}
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5"
          disabled={isBusy}
          onClick={(e) => {
            e.stopPropagation();
            void handleSave();
          }}
        >
          {isSaving ? <RotateCcwIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckIcon className="h-3.5 w-3.5" />}
          <Trans>Save</Trans>
        </Button>
      </div>
    </div>
  );
};

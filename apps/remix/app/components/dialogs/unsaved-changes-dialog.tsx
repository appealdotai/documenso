import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
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
import { Trans } from '@lingui/react/macro';
import { useEffect } from 'react';

/**
 * Modal dialog shown when the user attempts in-app navigation while:
 * - an autosave is in-progress or the last save failed, OR
 * - auto-save is disabled and there are unsaved manual changes.
 *
 * Driven entirely by the `navigationBlocker` from the envelope editor context,
 * so it mounts once at the editor root and requires no per-link wiring.
 */
export const UnsavedChangesDialog = () => {
  const {
    navigationBlocker,
    isAutosaving,
    autosaveError,
    flushAutosave,
    isAutoSaveEnabled,
    hasUnsavedChanges,
    saveNow,
    discardChanges,
  } = useCurrentEnvelopeEditor();

  const isBlocked = navigationBlocker.state === 'blocked';

  /**
   * Auto-proceed once the in-progress save finishes — the user chose "Wait"
   * (i.e. did nothing / cancelled the dialog) and the save completed on its own.
   * Only applies in auto-save mode.
   */
  useEffect(() => {
    if (isBlocked && isAutoSaveEnabled && !isAutosaving && !autosaveError) {
      navigationBlocker.proceed?.();
    }
  }, [isBlocked, isAutoSaveEnabled, isAutosaving, autosaveError]);

  if (!isBlocked) {
    return null;
  }

  // ---- Auto-save OFF path: user has unsaved manual changes ----
  if (!isAutoSaveEnabled && hasUnsavedChanges) {
    const handleSaveAndLeave = async () => {
      try {
        await saveNow();
      } finally {
        navigationBlocker.proceed?.();
      }
    };

    const handleDiscardAndLeave = async () => {
      await discardChanges();
      navigationBlocker.proceed?.();
    };

    const handleCancel = () => {
      navigationBlocker.reset?.();
    };

    return (
      <AlertDialog open={isBlocked}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Unsaved changes</Trans>
            </AlertDialogTitle>

            <AlertDialogDescription>
              <Trans>You have unsaved changes. Would you like to save them before leaving, or discard them?</Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>

            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDiscardAndLeave()}
            >
              <Trans>Discard and leave</Trans>
            </AlertDialogAction>

            <AlertDialogAction onClick={() => void handleSaveAndLeave()}>
              <Trans>Save and leave</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // ---- Auto-save ON path: in-progress save or failed save ----
  const handleWait = () => {
    navigationBlocker.reset?.();
  };

  const handleLeave = () => {
    navigationBlocker.proceed?.();
  };

  const handleSaveAndLeave = async () => {
    try {
      await flushAutosave();
    } finally {
      navigationBlocker.proceed?.();
    }
  };

  return (
    <AlertDialog open={isBlocked}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {autosaveError ? <Trans>Unsaved changes</Trans> : <Trans>Save in progress</Trans>}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {autosaveError ? (
              <Trans>
                Your last save failed. Leaving now will lose recent changes. Would you like to try saving again before
                leaving, or leave without saving?
              </Trans>
            ) : (
              <Trans>
                Your changes are still being saved. You can wait for saving to complete, or leave now and risk losing
                recent changes.
              </Trans>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {autosaveError ? (
            <>
              {/* Save-failed path: stay, try-save-and-leave, or discard */}
              <AlertDialogCancel onClick={handleWait}>
                <Trans>Stay</Trans>
              </AlertDialogCancel>

              <AlertDialogAction onClick={() => void handleSaveAndLeave()}>
                <Trans>Save and leave</Trans>
              </AlertDialogAction>

              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleLeave}
              >
                <Trans>Leave anyway</Trans>
              </AlertDialogAction>
            </>
          ) : (
            <>
              {/* Save-in-progress path: wait or leave */}
              <AlertDialogCancel onClick={handleWait}>
                <Trans>Wait</Trans>
              </AlertDialogCancel>

              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleLeave}
              >
                <Trans>Leave anyway</Trans>
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

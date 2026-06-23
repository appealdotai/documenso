import type { TSignaturePickerOption, TSignFieldSignatureDialogResult } from '@documenso/lib/utils/signature-picker';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Label } from '@documenso/ui/primitives/label';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';
import { Trans } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { createCallable } from 'react-call';

import { DocumentSigningDisclosure } from '../general/document-signing/document-signing-disclosure';

export type SignFieldSignatureDialogProps = {
  mode: 'unsigned' | 'change';
  fullName?: string;
  suggestedSignature?: string | null;
  availableOptions: TSignaturePickerOption[];
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
};

const NEW_SIGNATURE_OPTION_ID = '__new__';

const SignatureOptionPreview = ({ option }: { option: TSignaturePickerOption }) => {
  if (option.isImage) {
    return <img src={option.value} alt="" className="h-12 w-full max-w-[12rem] object-contain" />;
  }

  return (
    <p className="line-clamp-2 w-full max-w-[12rem] text-center font-signature text-lg text-muted-foreground">
      {option.value}
    </p>
  );
};

const getOptionLabel = (option: TSignaturePickerOption) => {
  if (option.source === 'profile') {
    return <Trans>Profile signature</Trans>;
  }

  if (option.source === 'current') {
    return <Trans>Current signature</Trans>;
  }

  return <Trans>Signature {option.labelIndex}</Trans>;
};

export const SignFieldSignatureDialog = createCallable<
  SignFieldSignatureDialogProps,
  TSignFieldSignatureDialogResult | null
>(
  ({
    call,
    mode,
    fullName,
    suggestedSignature,
    availableOptions,
    typedSignatureEnabled,
    uploadSignatureEnabled,
    drawSignatureEnabled,
  }) => {
    const selectableOptions = useMemo(() => {
      return availableOptions.filter((option) => option.source !== 'current');
    }, [availableOptions]);

    const defaultSelectedId = useMemo(() => {
      if (mode === 'change') {
        const currentOption = availableOptions.find((option) => option.source === 'current');

        if (currentOption) {
          return currentOption.id;
        }
      }

      if (selectableOptions.length > 0) {
        return selectableOptions[0].id;
      }

      return NEW_SIGNATURE_OPTION_ID;
    }, [availableOptions, mode, selectableOptions]);

    const [selectedOptionId, setSelectedOptionId] = useState(defaultSelectedId);
    const [localSignature, setLocalSignature] = useState(suggestedSignature ?? '');

    const isAddingNew = selectedOptionId === NEW_SIGNATURE_OPTION_ID;

    const selectedOption = selectableOptions.find((option) => option.id === selectedOptionId) ?? null;

    const canApply = isAddingNew ? Boolean(localSignature) : Boolean(selectedOption);

    const handleApply = () => {
      if (isAddingNew) {
        if (!localSignature) {
          return;
        }

        const isNewSignature = !availableOptions.some((option) => option.value === localSignature);

        call.end({
          action: 'apply',
          value: localSignature,
          isNewSignature,
        });

        return;
      }

      if (!selectedOption) {
        return;
      }

      call.end({
        action: 'apply',
        value: selectedOption.value,
        isNewSignature: false,
      });
    };

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent position="center" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === 'change' ? <Trans>Change signature</Trans> : <Trans>Sign signature field</Trans>}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {(selectableOptions.length > 0 || mode === 'change') && (
              <div className="flex flex-col gap-3">
                <Label>
                  <Trans>Choose a signature</Trans>
                </Label>

                <RadioGroup value={selectedOptionId} onValueChange={setSelectedOptionId} className="gap-2">
                  {mode === 'change' &&
                    availableOptions
                      .filter((option) => option.source === 'current')
                      .map((option) => (
                        <label
                          key={option.id}
                          htmlFor={option.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg border p-3',
                            selectedOptionId === option.id ? 'border-primary bg-primary/5' : 'border-border',
                          )}
                        >
                          <RadioGroupItem id={option.id} value={option.id} />
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <span className="font-medium text-sm">{getOptionLabel(option)}</span>
                            <SignatureOptionPreview option={option} />
                          </div>
                        </label>
                      ))}

                  {selectableOptions.map((option) => (
                    <label
                      key={option.id}
                      htmlFor={option.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-3',
                        selectedOptionId === option.id ? 'border-primary bg-primary/5' : 'border-border',
                      )}
                    >
                      <RadioGroupItem id={option.id} value={option.id} />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="font-medium text-sm">{getOptionLabel(option)}</span>
                        <SignatureOptionPreview option={option} />
                      </div>
                    </label>
                  ))}

                  <label
                    htmlFor={NEW_SIGNATURE_OPTION_ID}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3',
                      isAddingNew ? 'border-primary bg-primary/5' : 'border-border',
                    )}
                  >
                    <RadioGroupItem id={NEW_SIGNATURE_OPTION_ID} value={NEW_SIGNATURE_OPTION_ID} />
                    <span className="font-medium text-sm">
                      <Trans>Add new signature</Trans>
                    </span>
                  </label>
                </RadioGroup>
              </div>
            )}

            {(isAddingNew || selectableOptions.length === 0) && (
              <div className="flex flex-col gap-2">
                {selectableOptions.length > 0 && (
                  <Label>
                    <Trans>Draw or type your signature</Trans>
                  </Label>
                )}

                <SignaturePad
                  fullName={fullName}
                  value={localSignature}
                  onChange={({ value }) => setLocalSignature(value)}
                  typedSignatureEnabled={typedSignatureEnabled}
                  uploadSignatureEnabled={uploadSignatureEnabled}
                  drawSignatureEnabled={drawSignatureEnabled}
                />
              </div>
            )}
          </div>

          <DocumentSigningDisclosure />

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            {mode === 'change' ? (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                onClick={() => call.end({ action: 'remove' })}
              >
                <Trans>Remove signature</Trans>
              </Button>
            ) : (
              <span className="hidden sm:block sm:flex-1" />
            )}

            <div className="flex flex-1 justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => call.end(null)}>
                <Trans>Cancel</Trans>
              </Button>

              <Button type="button" disabled={!canApply} onClick={handleApply}>
                <Trans>Apply</Trans>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);

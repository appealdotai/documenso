import type { TNumberFieldMeta, TTextFieldMeta } from '@documenso/lib/types/field-meta';
import { cn } from '@documenso/ui/lib/utils';
import { useLingui } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getNumberFieldDefaultValue, validateInlineNumberFieldValue } from '~/utils/field-signing/commit-number-field';
import { getTextFieldDefaultValue, validateInlineTextFieldValue } from '~/utils/field-signing/commit-text-field';

import { InlineFieldInput } from '../document-signing/inline-field-input';
import { useInlineFieldEditor } from '../document-signing/use-inline-field-editor';
import { useFieldOverlayCoords } from './use-field-overlay-coords';

type InlineFieldOverlayProps = {
  field: Pick<
    Field,
    'id' | 'type' | 'page' | 'positionX' | 'positionY' | 'width' | 'height' | 'inserted' | 'customText'
  > & {
    fieldMeta?: TTextFieldMeta | TNumberFieldMeta | null;
  };
  scale: number;
  onCommit: (value: string | null) => Promise<void>;
  onCancel: () => void;
};

/**
 * HTML input overlay positioned over a Konva field during inline signing.
 */
export const InlineFieldOverlay = ({ field, scale, onCommit, onCancel }: InlineFieldOverlayProps) => {
  const { t } = useLingui();
  const isCommittingRef = useRef(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const coords = useFieldOverlayCoords({
    page: field.page,
    positionX: field.positionX,
    positionY: field.positionY,
    width: field.width,
    height: field.height,
  });

  const isNumber = field.type === FieldType.NUMBER;
  const textMeta = !isNumber ? (field.fieldMeta as TTextFieldMeta | null | undefined) : null;
  const numberMeta = isNumber ? (field.fieldMeta as TNumberFieldMeta | null | undefined) : null;

  const initialValue = isNumber
    ? getNumberFieldDefaultValue({
        field: {
          customText: field.customText,
          fieldMeta: numberMeta,
        },
      })
    : getTextFieldDefaultValue({
        field: {
          customText: field.customText,
          fieldMeta: textMeta,
        },
      });

  const validate = useCallback(
    (value: string) => {
      if (isNumber) {
        return validateInlineNumberFieldValue(value, numberMeta);
      }

      return validateInlineTextFieldValue(value, textMeta);
    },
    [isNumber, numberMeta, textMeta],
  );

  const { draftValue, errors, hasErrors, updateDraft, tryValidateForCommit, resetDraft } = useInlineFieldEditor({
    initialValue,
    validate,
  });

  // Seed draft when the overlay mounts for a field.
  useEffect(() => {
    resetDraft(initialValue);
    // Only re-seed when switching to a different field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id]);

  const handleCommit = async () => {
    if (isCommittingRef.current) {
      return;
    }

    const previousValue = field.inserted ? field.customText : '';

    if (field.inserted && draftValue === previousValue) {
      onCancel();
      return;
    }

    if (!draftValue) {
      if (field.inserted) {
        if (!tryValidateForCommit()) {
          return;
        }

        isCommittingRef.current = true;
        setIsCommitting(true);

        try {
          await onCommit(null);
        } finally {
          isCommittingRef.current = false;
          setIsCommitting(false);
        }

        return;
      }

      if (!tryValidateForCommit()) {
        return;
      }

      onCancel();
      return;
    }

    if (!tryValidateForCommit()) {
      return;
    }

    isCommittingRef.current = true;
    setIsCommitting(true);

    try {
      await onCommit(draftValue);
    } finally {
      isCommittingRef.current = false;
      setIsCommitting(false);
    }
  };

  const handleCancel = () => {
    resetDraft(initialValue);
    onCancel();
  };

  return (
    <div
      className={cn('absolute z-20 flex', {
        'ring-2 ring-red-300 ring-offset-1': hasErrors,
      })}
      style={{
        top: `${coords.y}px`,
        left: `${coords.x}px`,
        height: `${coords.height}px`,
        width: `${coords.width}px`,
      }}
    >
      <InlineFieldInput
        variant={isNumber ? 'number' : 'text'}
        value={draftValue}
        onChange={updateDraft}
        onCommit={() => void handleCommit()}
        onCancel={handleCancel}
        placeholder={
          isNumber
            ? (numberMeta?.placeholder ?? t`Enter your number here`)
            : (textMeta?.placeholder ?? t`Enter your text here`)
        }
        textAlign={isNumber ? numberMeta?.textAlign : textMeta?.textAlign}
        overflow={isNumber ? numberMeta?.overflow : textMeta?.overflow}
        fontSize={isNumber ? numberMeta?.fontSize : textMeta?.fontSize}
        characterLimit={!isNumber ? textMeta?.characterLimit : undefined}
        scale={scale}
        hasError={hasErrors}
        disabled={isCommitting}
        aria-label={isNumber ? t`Number field` : t`Text field`}
      />

      {hasErrors && (
        <div className="pointer-events-none absolute top-full left-0 z-30 mt-1 max-w-[240px] rounded bg-background/95 px-1.5 py-1 text-red-500 text-xs shadow-sm">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </div>
  );
};

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
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

  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
    height: 0,
    width: 0,
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

  const calculateCoords = useCallback(() => {
    const $page = document.querySelector<HTMLElement>(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`);

    if (!$page) {
      return;
    }

    const { height, width } = getBoundingClientRect($page);

    setCoords({
      x: (Number(field.positionX) / 100) * width,
      y: (Number(field.positionY) / 100) * height,
      height: (Number(field.height) / 100) * height,
      width: (Number(field.width) / 100) * width,
    });
  }, [field.height, field.page, field.positionX, field.positionY, field.width]);

  useEffect(() => {
    calculateCoords();
  }, [calculateCoords]);

  useEffect(() => {
    const onResize = () => {
      calculateCoords();
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [calculateCoords]);

  useEffect(() => {
    const $page = document.querySelector<HTMLElement>(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`);

    if (!$page) {
      return;
    }

    const observer = new ResizeObserver(() => {
      calculateCoords();
    });

    observer.observe($page);

    return () => {
      observer.disconnect();
    };
  }, [calculateCoords, field.page]);

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
      className={cn('absolute z-20', {
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

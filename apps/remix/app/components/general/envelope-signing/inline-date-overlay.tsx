import type { TDateFieldMeta } from '@documenso/lib/types/field-meta';
import { Calendar } from '@documenso/ui/primitives/calendar';
import { useLingui } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { DateTime } from 'luxon';
import { useEffect, useRef, useState } from 'react';

import { getDateFieldInitialJsDate, jsDateToIsoDate } from '~/utils/field-signing/commit-date-field';

import { useFieldOverlayCoords } from './use-field-overlay-coords';

type InlineDateOverlayProps = {
  field: Pick<Field, 'id' | 'page' | 'positionX' | 'positionY' | 'width' | 'height' | 'inserted' | 'customText'> & {
    fieldMeta?: TDateFieldMeta | null;
  };
  dateFormat?: string;
  onCommit: (value: string | null) => Promise<void>;
  onCancel: () => void;
};

/**
 * Calendar overlay positioned next to a Konva date field during inline signing.
 */
export const InlineDateOverlay = ({ field, dateFormat, onCommit, onCancel }: InlineDateOverlayProps) => {
  const { t } = useLingui();
  const panelRef = useRef<HTMLDivElement>(null);
  const isCommittingRef = useRef(false);

  const coords = useFieldOverlayCoords({
    page: field.page,
    positionX: field.positionX,
    positionY: field.positionY,
    width: field.width,
    height: field.height,
  });

  const initialDate = getDateFieldInitialJsDate({
    field: {
      customText: field.customText,
      fieldMeta: field.fieldMeta,
    },
    dateFormat,
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (isCommittingRef.current) {
        return;
      }

      if (panelRef.current?.contains(event.target as Node)) {
        return;
      }

      onCancel();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    const timeoutId = window.setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 0);

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  const handleSelect = async (date: Date | undefined) => {
    if (isCommittingRef.current || !date) {
      return;
    }

    setSelectedDate(date);

    const isoDate = jsDateToIsoDate(date);

    if (!isoDate) {
      return;
    }

    if (field.inserted && initialDate && DateTime.fromJSDate(initialDate).toISODate() === isoDate) {
      onCancel();
      return;
    }

    isCommittingRef.current = true;

    try {
      await onCommit(isoDate);
    } finally {
      isCommittingRef.current = false;
    }
  };

  const handleClear = async () => {
    if (isCommittingRef.current) {
      return;
    }

    if (!field.inserted) {
      onCancel();
      return;
    }

    isCommittingRef.current = true;

    try {
      await onCommit(null);
    } finally {
      isCommittingRef.current = false;
    }
  };

  const isPastHalfway = coords.pageWidth > 0 && coords.x > coords.pageWidth / 2;
  const isPastVerticalHalfway = coords.pageHeight > 0 && coords.y > coords.pageHeight / 2;

  return (
    <div
      className="absolute z-20"
      style={{
        ...(isPastVerticalHalfway
          ? { bottom: `${coords.pageHeight - coords.y + 4}px` }
          : { top: `${coords.y + coords.height + 4}px` }),
        ...(isPastHalfway ? { right: `calc(100% - ${coords.x + coords.width}px)` } : { left: `${coords.x}px` }),
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t`Select date`}
        className="flex flex-col rounded-md border bg-background shadow-md"
        style={{
          transformOrigin: `${isPastVerticalHalfway ? 'bottom' : 'top'} ${isPastHalfway ? 'right' : 'left'}`,
          transform: typeof window !== 'undefined' && window.innerWidth < 640 ? 'scale(0.85)' : 'none',
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Calendar mode="single" selected={selectedDate} onSelect={(date) => void handleSelect(date)} />
        <div className="border-t p-2">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-center rounded-sm px-3 py-2 font-medium text-muted-foreground text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={() => void handleClear()}
          >
            {t`Clear`}
          </button>
        </div>
      </div>
    </div>
  );
};

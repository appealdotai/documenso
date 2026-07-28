import type { TDateFieldMeta } from '@documenso/lib/types/field-meta';
import { Calendar } from '@documenso/ui/primitives/calendar';
import { useLingui } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { DateTime } from 'luxon';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { getDateFieldInitialJsDate, jsDateToIsoDate } from '~/utils/field-signing/commit-date-field';

import { getMobileOverlayScaleStyle, getOverlayPlacement, type OverlayPlacement } from './get-overlay-placement';
import { useFieldOverlayCoords } from './use-field-overlay-coords';

/** Approximate calendar height used before the panel is measured. */
const FALLBACK_CALENDAR_HEIGHT_PX = 350;

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
 * Prefers opening below the field; flips above when there is not enough room on the page.
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
  const [placement, setPlacement] = useState<OverlayPlacement>(() =>
    getOverlayPlacement({
      fieldY: coords.y,
      fieldHeight: coords.height,
      fieldX: coords.x,
      pageHeight: coords.pageHeight,
      pageWidth: coords.pageWidth,
      panelHeight: FALLBACK_CALENDAR_HEIGHT_PX,
      panelWidth: 0,
    }),
  );

  useLayoutEffect(() => {
    const panelHeight = panelRef.current?.offsetHeight ?? FALLBACK_CALENDAR_HEIGHT_PX;
    const panelWidth = panelRef.current?.offsetWidth ?? 0;

    setPlacement(
      getOverlayPlacement({
        fieldY: coords.y,
        fieldHeight: coords.height,
        fieldX: coords.x,
        pageHeight: coords.pageHeight,
        pageWidth: coords.pageWidth,
        panelHeight,
        panelWidth,
      }),
    );
  }, [coords.height, coords.pageHeight, coords.pageWidth, coords.width, coords.x, coords.y]);

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

  const openAbove = placement.top < coords.y;
  const alignRight = coords.x + coords.width / 2 > coords.pageWidth / 2;

  return (
    <div
      className="absolute z-20"
      style={{
        top: `${placement.top}px`,
        left: `${placement.left}px`,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t`Select date`}
        className="flex flex-col rounded-md border bg-background shadow-md"
        style={getMobileOverlayScaleStyle({ openAbove, alignRight })}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Calendar mode="single" selected={selectedDate} onSelect={(date) => void handleSelect(date)} initialFocus />
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

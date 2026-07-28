import type { TDropdownFieldMeta } from '@documenso/lib/types/field-meta';
import { cn } from '@documenso/ui/lib/utils';
import { useLingui } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { useEffect, useRef, useState } from 'react';

import { getDropdownFieldDefaultValue } from '~/utils/field-signing/commit-dropdown-field';

import {
  getClampedOverlayLeft,
  getMobileOverlayScaleStyle,
  OVERLAY_GAP_PX,
  shouldOpenOverlayAbove,
} from './get-overlay-placement';
import { useFieldOverlayCoords } from './use-field-overlay-coords';

/** Matches `max-h-60` so we flip before the list overflows the page. */
const FALLBACK_LIST_HEIGHT_PX = 240;
const MIN_LIST_WIDTH_PX = 160;

type InlineDropdownOverlayProps = {
  field: Pick<Field, 'id' | 'page' | 'positionX' | 'positionY' | 'width' | 'height' | 'inserted' | 'customText'> & {
    fieldMeta?: TDropdownFieldMeta | null;
  };
  onCommit: (value: string | null) => Promise<void>;
  onCancel: () => void;
};

/**
 * Option list overlay positioned over a Konva dropdown field during inline signing.
 * Keeps the field preview anchored; flips the options list based on available space.
 */
export const InlineDropdownOverlay = ({ field, onCommit, onCancel }: InlineDropdownOverlayProps) => {
  const { t } = useLingui();
  const listRef = useRef<HTMLDivElement>(null);
  const isCommittingRef = useRef(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const coords = useFieldOverlayCoords({
    page: field.page,
    positionX: field.positionX,
    positionY: field.positionY,
    width: field.width,
    height: field.height,
  });

  const values = field.fieldMeta?.values?.map((item) => item.value) ?? [];
  const selectedValue = getDropdownFieldDefaultValue({
    field: {
      customText: field.customText,
      fieldMeta: field.fieldMeta,
    },
  });

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (isCommittingRef.current) {
        return;
      }

      if (listRef.current?.contains(event.target as Node)) {
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

    // Defer so the opening click does not immediately dismiss.
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

  const handleSelect = async (value: string) => {
    if (isCommittingRef.current) {
      return;
    }

    if (field.inserted && value === field.customText) {
      onCancel();
      return;
    }

    isCommittingRef.current = true;
    setIsCommitting(true);

    try {
      await onCommit(value);
    } finally {
      isCommittingRef.current = false;
      setIsCommitting(false);
    }
  };

  const listWidth = Math.max(coords.width, MIN_LIST_WIDTH_PX);
  const listLeft = getClampedOverlayLeft({
    fieldX: coords.x,
    pageWidth: coords.pageWidth,
    panelWidth: listWidth,
  });
  const listOffsetLeft = listLeft - coords.x;

  const openAbove = shouldOpenOverlayAbove({
    fieldY: coords.y,
    fieldHeight: coords.height,
    pageHeight: coords.pageHeight,
    panelHeight: FALLBACK_LIST_HEIGHT_PX,
  });

  const alignRight = listOffsetLeft < 0;

  return (
    <div
      className="absolute z-20"
      style={{
        top: `${coords.y}px`,
        left: `${coords.x}px`,
        width: `${coords.width}px`,
      }}
    >
      <div
        className="pointer-events-none flex items-center rounded-[2px] border border-primary/40 bg-white px-1.5 text-black text-sm"
        style={{ height: `${coords.height}px` }}
      >
        <span className="truncate">{selectedValue || t`Select`}</span>
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label={t`Dropdown options`}
        className="absolute z-20 max-h-60 overflow-y-auto rounded-md border bg-background shadow-md"
        style={{
          width: `${listWidth}px`,
          left: `${listOffsetLeft}px`,
          ...(openAbove
            ? { bottom: '100%', marginBottom: `${OVERLAY_GAP_PX}px` }
            : { top: '100%', marginTop: `${OVERLAY_GAP_PX}px` }),
          ...getMobileOverlayScaleStyle({ openAbove, alignRight }),
        }}
      >
        {values.length === 0 && <p className="px-3 py-2 text-muted-foreground text-sm">{t`No options available`}</p>}

        {values.map((value) => (
          <button
            key={value}
            type="button"
            role="option"
            aria-selected={value === selectedValue}
            disabled={isCommitting}
            className={cn(
              'flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm outline-none',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:bg-accent focus-visible:text-accent-foreground',
              'disabled:pointer-events-none disabled:opacity-50',
              {
                'bg-accent text-accent-foreground': value === selectedValue,
              },
            )}
            onClick={() => void handleSelect(value)}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
};

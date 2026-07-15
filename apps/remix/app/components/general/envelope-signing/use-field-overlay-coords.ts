import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import type { Field } from '@prisma/client';
import { useCallback, useEffect, useState } from 'react';

export type FieldOverlayCoords = {
  x: number;
  y: number;
  height: number;
  width: number;
};

type UseFieldOverlayCoordsOptions = {
  page: number;
  positionX: Field['positionX'];
  positionY: Field['positionY'];
  width: Field['width'];
  height: Field['height'];
};

/**
 * Positions an HTML overlay over a PDF field using page-relative percentage coords.
 */
export const useFieldOverlayCoords = ({
  page,
  positionX,
  positionY,
  width,
  height,
}: UseFieldOverlayCoordsOptions): FieldOverlayCoords => {
  const [coords, setCoords] = useState<FieldOverlayCoords>({
    x: 0,
    y: 0,
    height: 0,
    width: 0,
  });

  const calculateCoords = useCallback(() => {
    const $page = document.querySelector<HTMLElement>(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${page}"]`);

    if (!$page) {
      return;
    }

    const { height: pageHeight, width: pageWidth } = getBoundingClientRect($page);

    setCoords({
      x: (Number(positionX) / 100) * pageWidth,
      y: (Number(positionY) / 100) * pageHeight,
      height: (Number(height) / 100) * pageHeight,
      width: (Number(width) / 100) * pageWidth,
    });
  }, [height, page, positionX, positionY, width]);

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
    const $page = document.querySelector<HTMLElement>(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${page}"]`);

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
  }, [calculateCoords, page]);

  return coords;
};

import type { CSSProperties } from 'react';

export const OVERLAY_GAP_PX = 4;

export type OverlayPlacement = {
  top: number;
  left: number;
};

type OverlaySpaceInput = {
  fieldY: number;
  fieldHeight: number;
  pageHeight: number;
  panelHeight: number;
};

type OverlayClampLeftInput = {
  fieldX: number;
  pageWidth: number;
  panelWidth: number;
};

/**
 * Prefers opening below the field; flips above when there is not enough room on the page.
 */
export const shouldOpenOverlayAbove = ({
  fieldY,
  fieldHeight,
  pageHeight,
  panelHeight,
}: OverlaySpaceInput): boolean => {
  const spaceBelow = pageHeight - (fieldY + fieldHeight);
  const spaceAbove = fieldY;

  const fitsBelow = spaceBelow >= panelHeight + OVERLAY_GAP_PX;
  const fitsAbove = spaceAbove >= panelHeight + OVERLAY_GAP_PX;

  if (fitsBelow) {
    return false;
  }

  if (fitsAbove) {
    return true;
  }

  return spaceAbove > spaceBelow;
};

export const getClampedOverlayLeft = ({ fieldX, pageWidth, panelWidth }: OverlayClampLeftInput): number => {
  const maxLeft = Math.max(0, pageWidth - panelWidth);

  return Math.min(Math.max(0, fieldX), maxLeft);
};

/**
 * Places an overlay panel adjacent to a field, flipping above and clamping horizontally
 * so it stays within the page bounds.
 */
export const getOverlayPlacement = ({
  fieldY,
  fieldHeight,
  fieldX,
  pageHeight,
  pageWidth,
  panelHeight,
  panelWidth,
}: OverlaySpaceInput & OverlayClampLeftInput): OverlayPlacement => {
  const openAbove = shouldOpenOverlayAbove({
    fieldY,
    fieldHeight,
    pageHeight,
    panelHeight,
  });

  const top = openAbove ? Math.max(0, fieldY - panelHeight - OVERLAY_GAP_PX) : fieldY + fieldHeight + OVERLAY_GAP_PX;

  return {
    top,
    left: getClampedOverlayLeft({ fieldX, pageWidth, panelWidth }),
  };
};

export const getMobileOverlayScaleStyle = ({
  openAbove,
  alignRight,
}: {
  openAbove: boolean;
  alignRight: boolean;
}): CSSProperties => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return {
    transformOrigin: `${openAbove ? 'bottom' : 'top'} ${alignRight ? 'right' : 'left'}`,
    transform: isMobile ? 'scale(0.85)' : 'none',
  };
};

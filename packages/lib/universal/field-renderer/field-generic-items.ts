import { DEFAULT_RECT_BACKGROUND, getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import Konva from 'konva';

import type { FieldCanvasStyle, FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

export const konvaTextFontFamily =
  '"Noto Sans", "Noto Sans Japanese", "Noto Sans Chinese", "Noto Sans Korean", sans-serif';
export const konvaTextFill = 'black';

export const upsertFieldGroup = (field: FieldToRender, options: RenderFieldElementOptions): Konva.Group => {
  const { pageWidth, pageHeight, pageLayer, editable, scale } = options;

  const { fieldX, fieldY, fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const fieldGroup: Konva.Group =
    pageLayer.findOne(`#${field.renderId}`) ||
    new Konva.Group({
      id: field.renderId,
      name: 'field-group',
    });

  const maxXPosition = (pageWidth - fieldWidth) * scale;
  const maxYPosition = (pageHeight - fieldHeight) * scale;

  fieldGroup.setAttrs({
    scaleX: 1,
    scaleY: 1,
    x: fieldX,
    y: fieldY,
    draggable: editable,
    opacity: options.fieldCanvasStyle?.opacity ?? 1,
    dragBoundFunc: (pos) => {
      const newX = Math.max(0, Math.min(maxXPosition, pos.x));
      const newY = Math.max(0, Math.min(maxYPosition, pos.y));

      return { x: newX, y: newY };
    },
  } satisfies Partial<Konva.GroupConfig>);

  return fieldGroup;
};

const getFieldBorderSideWidths = (fieldCanvasStyle: FieldCanvasStyle | undefined) => {
  const hasPerSide =
    fieldCanvasStyle?.borderTopWidth !== undefined ||
    fieldCanvasStyle?.borderRightWidth !== undefined ||
    fieldCanvasStyle?.borderBottomWidth !== undefined ||
    fieldCanvasStyle?.borderLeftWidth !== undefined;

  if (!hasPerSide) {
    const uniformWidth = fieldCanvasStyle?.borderWidth ?? 2;

    return {
      top: uniformWidth,
      right: uniformWidth,
      bottom: uniformWidth,
      left: uniformWidth,
      isUniform: true,
    };
  }

  const top = fieldCanvasStyle?.borderTopWidth ?? 0;
  const right = fieldCanvasStyle?.borderRightWidth ?? 0;
  const bottom = fieldCanvasStyle?.borderBottomWidth ?? 0;
  const left = fieldCanvasStyle?.borderLeftWidth ?? 0;

  return {
    top,
    right,
    bottom,
    left,
    isUniform: top === right && right === bottom && bottom === left,
  };
};

const upsertFieldBorderLines = ({
  fieldGroup,
  fieldWidth,
  fieldHeight,
  borderColor,
  sideColors,
  sideWidths,
  visible,
}: {
  fieldGroup: Konva.Group;
  fieldWidth: number;
  fieldHeight: number;
  borderColor: string;
  sideColors?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  sideWidths: ReturnType<typeof getFieldBorderSideWidths>;
  visible: boolean;
}) => {
  const sides = [
    {
      name: 'field-border-top',
      width: sideWidths.top,
      color: sideColors?.top ?? borderColor,
      points: [0, 0, fieldWidth, 0],
    },
    {
      name: 'field-border-right',
      width: sideWidths.right,
      color: sideColors?.right ?? borderColor,
      points: [fieldWidth, 0, fieldWidth, fieldHeight],
    },
    {
      name: 'field-border-bottom',
      width: sideWidths.bottom,
      color: sideColors?.bottom ?? borderColor,
      points: [0, fieldHeight, fieldWidth, fieldHeight],
    },
    {
      name: 'field-border-left',
      width: sideWidths.left,
      color: sideColors?.left ?? borderColor,
      points: [0, 0, 0, fieldHeight],
    },
  ] as const;

  for (const side of sides) {
    const existingLine = fieldGroup.findOne(`.${side.name}`) as Konva.Line | undefined;

    if (side.width <= 0 || !visible) {
      existingLine?.destroy();
      continue;
    }

    const line =
      existingLine ||
      new Konva.Line({
        name: side.name,
        listening: false,
      });

    line.setAttrs({
      name: side.name,
      points: [...side.points],
      stroke: side.color,
      strokeWidth: side.width,
      lineCap: 'square',
      listening: false,
    } satisfies Partial<Konva.LineConfig>);

    if (!existingLine) {
      fieldGroup.add(line);
    }
  }
};

const upsertFieldAccentRing = ({
  fieldGroup,
  fieldWidth,
  fieldHeight,
  ringColor,
  borderRadius,
  visible,
}: {
  fieldGroup: Konva.Group;
  fieldWidth: number;
  fieldHeight: number;
  ringColor: string;
  borderRadius: number;
  visible: boolean;
}) => {
  const existingRing = fieldGroup.findOne('.field-accent-ring') as Konva.Rect | undefined;

  if (!visible) {
    existingRing?.destroy();
    return;
  }

  const ring =
    existingRing ||
    new Konva.Rect({
      name: 'field-accent-ring',
      listening: false,
    });

  ring.setAttrs({
    x: -1,
    y: -1,
    width: fieldWidth + 2,
    height: fieldHeight + 2,
    stroke: ringColor,
    strokeWidth: 1,
    fillEnabled: false,
    cornerRadius: borderRadius,
    listening: false,
  } satisfies Partial<Konva.RectConfig>);

  if (!existingRing) {
    fieldGroup.add(ring);
    ring.moveToBottom();
  }
};

export const upsertFieldRect = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
  fieldGroup: Konva.Group,
): Konva.Rect => {
  const { pageWidth, pageHeight, mode, pageLayer, color } = options;
  const { fieldCanvasStyle } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const fieldRect: Konva.Rect =
    pageLayer.findOne(`#${field.renderId}-rect`) ||
    new Konva.Rect({
      id: `${field.renderId}-rect`,
      name: 'field-rect',
    });

  const sideWidths = getFieldBorderSideWidths(fieldCanvasStyle);
  const borderColor = fieldCanvasStyle?.borderColor ?? (color ? getRecipientColorStyles(color).baseRing : '#e5e7eb');
  const isVisible = mode !== 'export';
  const borderRadius = sideWidths.isUniform ? (fieldCanvasStyle?.borderRadius ?? 2) : 0;

  fieldRect.setAttrs({
    width: fieldWidth,
    height: fieldHeight,
    fill: fieldCanvasStyle?.backgroundColor ?? DEFAULT_RECT_BACKGROUND,
    stroke: borderColor,
    strokeWidth: sideWidths.isUniform ? sideWidths.top : 0,
    cornerRadius: borderRadius,
    strokeScaleEnabled: false,
    visible: isVisible,
  } satisfies Partial<Konva.RectConfig>);

  if (!sideWidths.isUniform) {
    upsertFieldBorderLines({
      fieldGroup,
      fieldWidth,
      fieldHeight,
      borderColor,
      sideColors: {
        top: fieldCanvasStyle?.borderTopColor,
        right: fieldCanvasStyle?.borderRightColor,
        bottom: fieldCanvasStyle?.borderBottomColor,
        left: fieldCanvasStyle?.borderLeftColor,
      },
      sideWidths,
      visible: isVisible,
    });
  } else {
    for (const name of ['field-border-top', 'field-border-right', 'field-border-bottom', 'field-border-left']) {
      fieldGroup.findOne(`.${name}`)?.destroy();
    }
  }

  const accentRingColor = fieldCanvasStyle?.accentRingColor ?? fieldCanvasStyle?.borderHoverColor ?? borderColor;

  upsertFieldAccentRing({
    fieldGroup,
    fieldWidth,
    fieldHeight,
    ringColor: accentRingColor,
    borderRadius: fieldCanvasStyle?.borderRadius ?? 2,
    visible: Boolean(isVisible && fieldCanvasStyle?.showAccentRing && accentRingColor),
  });

  return fieldRect;
};

export const createSpinner = ({ fieldWidth, fieldHeight }: { fieldWidth: number; fieldHeight: number }) => {
  const loadingGroup = new Konva.Group({
    name: 'loading-spinner-group',
    listening: false,
  });

  const rect = new Konva.Rect({
    x: 4,
    y: 4,
    width: fieldWidth - 8,
    height: fieldHeight - 8,
    fill: 'white',
    opacity: 0.8,
  });

  const maxSpinnerSize = 10;
  const smallerDimension = Math.min(fieldWidth, fieldHeight);
  const spinnerSize = Math.min(smallerDimension, maxSpinnerSize);

  const spinner = new Konva.Arc({
    x: fieldWidth / 2,
    y: fieldHeight / 2,
    innerRadius: spinnerSize,
    outerRadius: spinnerSize / 2,
    angle: 270,
    rotation: 0,
    fill: 'rgba(122, 195, 85, 1)',
    lineCap: 'round',
  });

  rect.moveToTop();
  spinner.moveToTop();

  loadingGroup.add(rect);
  loadingGroup.add(spinner);

  const anim = new Konva.Animation((frame) => {
    spinner.rotate(180 * (frame.timeDiff / 500));
  });

  anim.start();

  return loadingGroup;
};

type CreateFieldHoverInteractionOptions = {
  options: RenderFieldElementOptions;
  fieldGroup: Konva.Group;
  fieldRect: Konva.Rect;
};

/**
 * Adds smooth transition-like behavior for hover effects on the field border.
 */
export const createFieldHoverInteraction = ({ options, fieldGroup, fieldRect }: CreateFieldHoverInteractionOptions) => {
  const { mode, fieldCanvasStyle } = options;

  if (mode === 'export' || mode !== 'sign') {
    return;
  }

  // Editing owns the accent treatment; skip ephemeral hover while actively editing.
  if (fieldCanvasStyle?.showAccentRing) {
    return;
  }

  // Optional fields already painted in their editing/hover asymmetric layout.
  if (
    fieldCanvasStyle?.borderTopWidth !== undefined &&
    fieldCanvasStyle.borderTopWidth > 0 &&
    fieldCanvasStyle.hoverBorderTopWidth === undefined
  ) {
    return;
  }

  const defaultStroke = fieldCanvasStyle?.borderColor;
  const hoverStroke = fieldCanvasStyle?.borderHoverColor;
  const hasAsymmetricHover =
    fieldCanvasStyle?.hoverBorderBottomWidth !== undefined || fieldCanvasStyle?.hoverBorderTopWidth !== undefined;

  if (!defaultStroke || (!hoverStroke && !hasAsymmetricHover)) {
    return;
  }

  const idleSideWidths = getFieldBorderSideWidths(fieldCanvasStyle);

  const applyHover = (isHovered: boolean) => {
    const layer = fieldRect.getLayer();

    if (!layer) {
      return;
    }

    if (hasAsymmetricHover) {
      const hoverSideWidths = isHovered
        ? {
            top: fieldCanvasStyle?.hoverBorderTopWidth ?? 0,
            right: fieldCanvasStyle?.hoverBorderRightWidth ?? 0,
            bottom: fieldCanvasStyle?.hoverBorderBottomWidth ?? idleSideWidths.bottom,
            left: fieldCanvasStyle?.hoverBorderLeftWidth ?? 0,
            isUniform: false as const,
          }
        : idleSideWidths;

      fieldRect.strokeWidth(0);

      upsertFieldBorderLines({
        fieldGroup,
        fieldWidth: fieldRect.width(),
        fieldHeight: fieldRect.height(),
        borderColor: isHovered
          ? (fieldCanvasStyle?.hoverBorderBottomColor ?? hoverStroke ?? defaultStroke)
          : defaultStroke,
        sideColors: isHovered
          ? {
              top: fieldCanvasStyle?.hoverBorderTopColor,
              right: fieldCanvasStyle?.hoverBorderRightColor,
              bottom: fieldCanvasStyle?.hoverBorderBottomColor,
              left: fieldCanvasStyle?.hoverBorderLeftColor,
            }
          : undefined,
        sideWidths: hoverSideWidths,
        visible: true,
      });

      upsertFieldAccentRing({
        fieldGroup,
        fieldWidth: fieldRect.width(),
        fieldHeight: fieldRect.height(),
        ringColor: hoverStroke ?? defaultStroke,
        borderRadius: fieldCanvasStyle?.borderRadius ?? 2,
        visible: false,
      });

      layer.batchDraw();
      return;
    }

    const stroke = isHovered ? (hoverStroke ?? defaultStroke) : defaultStroke;

    new Konva.Tween({
      node: fieldRect,
      duration: 0.2,
      stroke,
    }).play();

    for (const name of ['field-border-top', 'field-border-right', 'field-border-bottom', 'field-border-left']) {
      const line = fieldGroup.findOne(`.${name}`);

      if (!line) {
        continue;
      }

      new Konva.Tween({
        node: line,
        duration: 0.2,
        stroke,
      }).play();
    }

    upsertFieldAccentRing({
      fieldGroup,
      fieldWidth: fieldRect.width(),
      fieldHeight: fieldRect.height(),
      ringColor: hoverStroke ?? defaultStroke,
      borderRadius: fieldCanvasStyle?.borderRadius ?? 2,
      visible: isHovered,
    });
  };

  fieldGroup.off('mouseover');
  fieldGroup.off('mouseout');

  fieldGroup.on('mouseover', () => {
    applyHover(true);
  });

  fieldGroup.on('mouseout', () => {
    applyHover(false);
  });
};

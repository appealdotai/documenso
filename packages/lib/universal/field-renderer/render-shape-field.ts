import Konva from 'konva';

import { DEFAULT_SHAPE_BORDER_COLOR, DEFAULT_SHAPE_BORDER_WIDTH, type TShapeFieldMeta } from '../../types/field-meta';
import { getRenderableColor } from './field-canvas-style';
import { upsertFieldGroup } from './field-generic-items';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

const resolveShapeMeta = (field: FieldToRender): TShapeFieldMeta => {
  const meta = field.fieldMeta as TShapeFieldMeta | null;

  return {
    type: 'shape',
    shape: meta?.shape ?? 'rectangle',
    fillColor: meta?.fillColor ?? null,
    fillOpacity: meta?.fillOpacity ?? 1,
    borderColor: meta?.borderColor ?? DEFAULT_SHAPE_BORDER_COLOR,
    borderWidth: meta?.borderWidth ?? DEFAULT_SHAPE_BORDER_WIDTH,
    borderStyle: meta?.borderStyle ?? 'solid',
    cornerRadius: meta?.cornerRadius ?? 0,
  };
};

type ResolvedShapePaint = {
  fill?: string;
  fillOpacity: number;
  stroke?: string;
  strokeWidth: number;
  dash?: number[];
};

const resolveShapePaint = (shapeMeta: TShapeFieldMeta): ResolvedShapePaint => {
  const fill = shapeMeta.fillColor ? getRenderableColor(shapeMeta.fillColor) : undefined;
  const stroke = getRenderableColor(shapeMeta.borderColor);
  const strokeWidth = shapeMeta.borderWidth ?? DEFAULT_SHAPE_BORDER_WIDTH;

  // Opacity applies to the fill only, never the border.
  const fillOpacity = Math.max(0, Math.min(shapeMeta.fillOpacity ?? 1, 1));

  return {
    fill,
    fillOpacity,
    stroke: shapeMeta.borderStyle === 'none' ? undefined : stroke,
    strokeWidth: shapeMeta.borderStyle === 'none' ? 0 : strokeWidth,
    dash: shapeMeta.borderStyle === 'dashed' ? [Math.max(strokeWidth, 1) * 3, Math.max(strokeWidth, 1) * 2] : undefined,
  };
};

/**
 * Polyline points for line/arrow shapes at the given size, sharing one
 * geometry source between initial render and transform rescaling.
 */
const getShapeLinePoints = (shape: TShapeFieldMeta['shape'], fieldWidth: number, fieldHeight: number): number[] => {
  if (shape === 'arrow') {
    const headLength = Math.min(fieldWidth / 4, 24);
    const headWidth = Math.min(fieldHeight, 24);
    const midY = fieldHeight / 2;
    const lineEndX = Math.max(fieldWidth - headLength, 0);

    return [
      0,
      midY,
      lineEndX,
      midY,
      fieldWidth,
      midY - headWidth / 2,
      lineEndX,
      midY,
      fieldWidth,
      midY + headWidth / 2,
    ];
  }

  return [0, fieldHeight / 2, fieldWidth, fieldHeight / 2];
};

const appendShapeElement = (
  fieldGroup: Konva.Group,
  field: FieldToRender,
  fieldWidth: number,
  fieldHeight: number,
  paint: ResolvedShapePaint,
  shapeMeta: TShapeFieldMeta,
) => {
  const renderId = `${field.renderId}-shape`;
  const shape = shapeMeta.shape;

  if (shape === 'ellipse') {
    fieldGroup.add(
      new Konva.Ellipse({
        id: renderId,
        name: 'shape-element',
        x: fieldWidth / 2,
        y: fieldHeight / 2,
        radiusX: Math.max(fieldWidth / 2, 0),
        radiusY: Math.max(fieldHeight / 2, 0),
        fill: paint.fill,
        opacity: paint.fillOpacity,
        stroke: paint.stroke,
        strokeWidth: paint.strokeWidth,
        dash: paint.dash,
      }),
    );

    return;
  }

  if (shape === 'triangle') {
    fieldGroup.add(
      new Konva.Line({
        id: renderId,
        name: 'shape-element',
        points: [fieldWidth / 2, 0, fieldWidth, fieldHeight, 0, fieldHeight],
        closed: true,
        fill: paint.fill,
        opacity: paint.fillOpacity,
        stroke: paint.stroke,
        strokeWidth: paint.strokeWidth,
        dash: paint.dash,
        lineJoin: 'miter',
      }),
    );

    return;
  }

  if (shape === 'line') {
    fieldGroup.add(
      new Konva.Line({
        id: renderId,
        name: 'shape-element',
        points: getShapeLinePoints(shape, fieldWidth, fieldHeight),
        stroke: paint.stroke,
        strokeWidth: Math.max(paint.strokeWidth, 1),
        dash: paint.dash,
        lineCap: 'round',
      }),
    );

    return;
  }

  if (shape === 'arrow') {
    fieldGroup.add(
      new Konva.Line({
        id: renderId,
        name: 'shape-element',
        points: getShapeLinePoints(shape, fieldWidth, fieldHeight),
        stroke: paint.stroke,
        strokeWidth: Math.max(paint.strokeWidth, 1),
        dash: paint.dash,
        lineCap: 'round',
        lineJoin: 'round',
      }),
    );

    return;
  }

  fieldGroup.add(
    new Konva.Rect({
      id: renderId,
      name: 'shape-element',
      x: 0,
      y: 0,
      width: fieldWidth,
      height: fieldHeight,
      fill: paint.fill,
      opacity: paint.fillOpacity,
      stroke: paint.stroke,
      strokeWidth: paint.strokeWidth,
      dash: paint.dash,
      cornerRadius: Math.max(0, shapeMeta.cornerRadius ?? 0),
    }),
  );
};

/**
 * Update an existing shape element's paint attributes in place without recreating it.
 * This avoids the destroy/recreate visual blink when field meta (colour, border, etc.)
 * changes but the shape type stays the same.
 */
const updateShapeElementPaint = (
  shapeElement: Konva.Ellipse | Konva.Line | Konva.Rect,
  paint: ResolvedShapePaint,
  shapeMeta: TShapeFieldMeta,
  fieldWidth: number,
  fieldHeight: number,
): boolean => {
  if (shapeElement instanceof Konva.Ellipse) {
    shapeElement.setAttrs({
      x: fieldWidth / 2,
      y: fieldHeight / 2,
      radiusX: Math.max(fieldWidth / 2, 0),
      radiusY: Math.max(fieldHeight / 2, 0),
      scaleX: 1,
      scaleY: 1,
      fill: paint.fill,
      opacity: paint.fillOpacity,
      stroke: paint.stroke,
      strokeWidth: paint.strokeWidth,
      dash: paint.dash,
    });

    return true;
  }

  if (shapeElement instanceof Konva.Line) {
    shapeElement.setAttrs({
      points: getShapeLinePoints(shapeMeta.shape, fieldWidth, fieldHeight),
      scaleX: 1,
      scaleY: 1,
      stroke: paint.stroke,
      strokeWidth: Math.max(paint.strokeWidth, 1),
      dash: paint.dash,
    });

    return true;
  }

  if (shapeElement instanceof Konva.Rect) {
    shapeElement.setAttrs({
      width: fieldWidth,
      height: fieldHeight,
      scaleX: 1,
      scaleY: 1,
      fill: paint.fill,
      opacity: paint.fillOpacity,
      stroke: paint.stroke,
      strokeWidth: paint.strokeWidth,
      dash: paint.dash,
      cornerRadius: Math.max(0, shapeMeta.cornerRadius ?? 0),
    });

    return true;
  }

  return false;
};

/**
 * Determine whether the existing shape element Konva class matches the desired shape type.
 * Returns true when the element can be reused (updated in place), false when it must be
 * destroyed and recreated.
 */
const shapeElementMatchesType = (
  shapeElement: Konva.Node | undefined,
  shape: TShapeFieldMeta['shape'],
): shapeElement is Konva.Ellipse | Konva.Line | Konva.Rect => {
  if (!shapeElement) {
    return false;
  }

  if (shape === 'ellipse') {
    return shapeElement instanceof Konva.Ellipse;
  }

  if (shape === 'line' || shape === 'arrow' || shape === 'triangle') {
    return shapeElement instanceof Konva.Line;
  }

  // rectangle (default)
  return shapeElement instanceof Konva.Rect;
};

export const renderShapeFieldElement = (field: FieldToRender, options: RenderFieldElementOptions) => {
  const { pageWidth, pageHeight, pageLayer } = options;

  const shapeMeta = resolveShapeMeta(field);
  const paint = resolveShapePaint(shapeMeta);

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  const fieldGroup = upsertFieldGroup(field, options);

  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  // Maintain an invisible, zero-opacity bounding rect (`.field-rect`) that exactly
  // covers the field area. This lets `handleResizeOrMove` use the same reliable
  // fieldRect-based measurement path as every other field type, avoiding the
  // `getClientRect()` fallback that breaks for line/arrow shapes (where
  // `skipStroke: true` would report height ≈ 0 for horizontal lines).
  const existingBoundRect = fieldGroup.findOne('.field-rect');
  const boundRect: Konva.Rect =
    existingBoundRect instanceof Konva.Rect
      ? existingBoundRect
      : new Konva.Rect({
          name: 'field-rect',
          fillEnabled: false,
          strokeEnabled: false,
          listening: false,
        });

  boundRect.setAttrs({
    width: fieldWidth,
    height: fieldHeight,
  } satisfies Partial<Konva.RectConfig>);

  if (!(existingBoundRect instanceof Konva.Rect)) {
    fieldGroup.add(boundRect);
    boundRect.moveToBottom();
  }

  // Try to reuse the existing shape element to avoid the destroy/recreate
  // visual blink that occurs on every React re-render (e.g. after a state update
  // triggered by transformend). Only fall back to a full recreate when the
  // shape type changes (e.g. rectangle → ellipse) or on first render.
  const existingShapeElement = fieldGroup.findOne('.shape-element');

  if (shapeElementMatchesType(existingShapeElement, shapeMeta.shape)) {
    updateShapeElementPaint(existingShapeElement, paint, shapeMeta, fieldWidth, fieldHeight);
  } else {
    // Shape type changed or first render — recreate. Only remove the old shape
    // element, not all children (a re-registering transform listener will follow).
    existingShapeElement?.destroy();
    appendShapeElement(fieldGroup, field, fieldWidth, fieldHeight, paint, shapeMeta);
  }

  // Re-register the transform listener so its closure captures the latest
  // fieldWidth / fieldHeight values (updated after each transformend → re-render).
  fieldGroup.off('transform');

  // Keep the shape geometry in sync with the transformer by baking the group
  // scale into the shape and resetting the group scale. Updates happen in place
  // (no destroy / recreate) so resizing stays smooth without flicker.
  fieldGroup.on('transform', () => {
    const liveRect = fieldGroup.findOne('.field-rect');

    // Read the current dimensions from the live rect to accumulate the scale
    const currentWidth = liveRect instanceof Konva.Rect ? liveRect.width() : fieldWidth;
    const currentHeight = liveRect instanceof Konva.Rect ? liveRect.height() : fieldHeight;

    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    const scaledWidth = currentWidth * groupScaleX;
    const scaledHeight = currentHeight * groupScaleY;

    if (liveRect instanceof Konva.Rect) {
      liveRect.setAttrs({ width: scaledWidth, height: scaledHeight });
    }

    const shapeElement = fieldGroup.findOne('.shape-element');

    if (shapeElement instanceof Konva.Ellipse) {
      shapeElement.setAttrs({
        x: scaledWidth / 2,
        y: scaledHeight / 2,
        radiusX: Math.max(scaledWidth / 2, 0),
        radiusY: Math.max(scaledHeight / 2, 0),
        scaleX: 1,
        scaleY: 1,
      });
    } else if (shapeElement instanceof Konva.Line) {
      shapeElement.setAttrs({
        points: getShapeLinePoints(shapeMeta.shape, scaledWidth, scaledHeight),
        scaleX: 1,
        scaleY: 1,
      });
    } else if (shapeElement instanceof Konva.Rect) {
      shapeElement.setAttrs({
        width: scaledWidth,
        height: scaledHeight,
        scaleX: 1,
        scaleY: 1,
      });
    }

    fieldGroup.scale({
      x: 1,
      y: 1,
    });

    pageLayer.batchDraw();
  });

  return {
    fieldGroup,
    isFirstRender,
  };
};

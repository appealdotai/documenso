import Konva from 'konva';

const SNAP_THRESHOLD = 5;

type FieldRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SnapPoint = {
  position: number;
  type: 'edge' | 'center';
  direction: 'horizontal' | 'vertical';
  rect: FieldRect;
};

type GuideLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type SnapResult = {
  x: number;
  y: number;
  horizontalGuide?: GuideLine;
  verticalGuide?: GuideLine;
};

type ResizeSnapResult = {
  x: number;
  y: number;
  width: number;
  height: number;
  horizontalGuides: number[];
  verticalGuides: number[];
};

export function renderRuler(stage: Konva.Stage, width: number, height: number, scale: number): Konva.Layer {
  const existingRulerLayers = stage.find('.ruler-layer');
  existingRulerLayers.forEach((layer) => {
    layer.destroy();
  });

  const rulerLayer = new Konva.Layer({
    name: 'ruler-layer',
    listening: false,
  });

  const rulerSize = 24;

  const topBg = new Konva.Rect({
    x: 0,
    y: 0,
    width: width,
    height: rulerSize / scale,
    fill: 'rgba(240, 240, 240, 0.9)',
    listening: false,
  });

  const leftBg = new Konva.Rect({
    x: 0,
    y: 0,
    width: rulerSize / scale,
    height: height,
    fill: 'rgba(240, 240, 240, 0.9)',
    listening: false,
  });

  rulerLayer.add(topBg, leftBg);

  const majorTickSize = 100;
  const minorTickSize = 10;

  for (let x = 0; x <= width; x += minorTickSize) {
    const isMajor = x % majorTickSize === 0;
    const tickHeight = (isMajor ? rulerSize : rulerSize / 2) / scale;

    rulerLayer.add(
      new Konva.Line({
        points: [x, 0, x, tickHeight],
        stroke: '#aaa',
        strokeWidth: 1 / scale,
        listening: false,
      }),
    );

    if (isMajor && x > 0) {
      rulerLayer.add(
        new Konva.Text({
          x: x + 2 / scale,
          y: 2 / scale,
          text: x.toString(),
          fontSize: 10 / scale,
          fill: '#666',
          listening: false,
        }),
      );
    }
  }

  for (let y = 0; y <= height; y += minorTickSize) {
    const isMajor = y % majorTickSize === 0;
    const tickWidth = (isMajor ? rulerSize : rulerSize / 2) / scale;

    rulerLayer.add(
      new Konva.Line({
        points: [0, y, tickWidth, y],
        stroke: '#aaa',
        strokeWidth: 1 / scale,
        listening: false,
      }),
    );

    if (isMajor && y > 0) {
      rulerLayer.add(
        new Konva.Text({
          x: 2 / scale,
          y: y + 2 / scale,
          text: y.toString(),
          fontSize: 10 / scale,
          fill: '#666',
          listening: false,
        }),
      );
    }
  }

  stage.add(rulerLayer);
  return rulerLayer;
}

export function initializeSnapGuides(stage: Konva.Stage): Konva.Layer {
  // Remove any existing snap guide layers from this stage
  const existingSnapLayers = stage.find('.snap-guide-layer');
  existingSnapLayers.forEach((layer) => {
    layer.destroy();
  });

  const snapGuideLayer = new Konva.Layer({
    name: 'snap-guide-layer',
  });
  stage.add(snapGuideLayer);
  return snapGuideLayer;
}

export function calculateSnapPositions(
  stage: Konva.Stage,
  excludeId?: string,
): { horizontal: SnapPoint[]; vertical: SnapPoint[] } {
  const fieldGroups = stage.find('.field-group').filter((node): node is Konva.Group => node instanceof Konva.Group);
  const horizontal: SnapPoint[] = [];
  const vertical: SnapPoint[] = [];

  fieldGroups.forEach((group) => {
    if (excludeId && group.id() === excludeId) {
      return;
    }

    const rect = group.getClientRect();

    // Vertical snap points (for horizontal alignment)
    horizontal.push(
      { position: rect.y, type: 'edge', direction: 'horizontal', rect },
      { position: rect.y + rect.height / 2, type: 'center', direction: 'horizontal', rect },
      { position: rect.y + rect.height, type: 'edge', direction: 'horizontal', rect },
    );

    // Horizontal snap points (for vertical alignment)
    vertical.push(
      { position: rect.x, type: 'edge', direction: 'vertical', rect },
      { position: rect.x + rect.width / 2, type: 'center', direction: 'vertical', rect },
      { position: rect.x + rect.width, type: 'edge', direction: 'vertical', rect },
    );
  });

  return { horizontal, vertical };
}

export function calculateSnapSizes(stage: Konva.Stage, excludeId?: string): { widths: number[]; heights: number[] } {
  const fieldGroups = stage.find('.field-group').filter((node): node is Konva.Group => node instanceof Konva.Group);
  const widths: number[] = [];
  const heights: number[] = [];

  fieldGroups.forEach((group) => {
    if (excludeId && group.id() === excludeId) {
      return;
    }

    const rect = group.getClientRect();
    widths.push(rect.width);
    heights.push(rect.height);
  });

  return { widths, heights };
}

export function getSnappedPosition(
  stage: Konva.Stage,
  movingGroup: Konva.Group,
  newX: number,
  newY: number,
): SnapResult {
  const { horizontal, vertical } = calculateSnapPositions(stage, movingGroup.id());

  // newX / newY are LOCAL (unscaled) coordinates: fieldGroup.x() / .y()
  // calculateSnapPositions returns positions in CLIENT (scaled) coordinates via getClientRect()
  // We must work in client coords for comparison, then convert back to local at the end.
  //
  // Since the stage has uniform scale and no panning offset:
  //   clientCoord = localCoord * scale
  //   localCoord  = clientCoord / scale
  const scale = stage.scaleX();

  // Current size of the moving field in client coords
  const clientRect = movingGroup.getClientRect();
  const clientWidth = clientRect.width;
  const clientHeight = clientRect.height;

  // Moving field's position in client coords (where it would be after the drag)
  const clientX = newX * scale;
  const clientY = newY * scale;

  let snappedClientX = clientX;
  let snappedClientY = clientY;

  let horizontalGuide: GuideLine | undefined;
  let verticalGuide: GuideLine | undefined;

  let closestHorizontalDistance = SNAP_THRESHOLD + 1;
  let closestVerticalDistance = SNAP_THRESHOLD + 1;

  type BestCandidate = {
    snapPoint: SnapPoint;
    anchorOffset: number;
  };

  let bestHorizontalCandidate: BestCandidate | null = null;
  let bestVerticalCandidate: BestCandidate | null = null;

  // Anchors: top edge, center, bottom edge of moving field in client coords
  const movingVerticalAnchors = [
    { position: clientY, offset: 0 },
    { position: clientY + clientHeight / 2, offset: -clientHeight / 2 },
    { position: clientY + clientHeight, offset: -clientHeight },
  ];

  for (const snapPoint of horizontal) {
    for (const anchor of movingVerticalAnchors) {
      const distance = Math.abs(anchor.position - snapPoint.position);

      if (distance < closestHorizontalDistance) {
        closestHorizontalDistance = distance;
        bestHorizontalCandidate = { snapPoint, anchorOffset: anchor.offset };
      }
    }
  }

  // Anchors: left edge, center, right edge of moving field in client coords
  const movingHorizontalAnchors = [
    { position: clientX, offset: 0 },
    { position: clientX + clientWidth / 2, offset: -clientWidth / 2 },
    { position: clientX + clientWidth, offset: -clientWidth },
  ];

  for (const snapPoint of vertical) {
    for (const anchor of movingHorizontalAnchors) {
      const distance = Math.abs(anchor.position - snapPoint.position);

      if (distance < closestVerticalDistance) {
        closestVerticalDistance = distance;
        bestVerticalCandidate = { snapPoint, anchorOffset: anchor.offset };
      }
    }
  }

  if (bestHorizontalCandidate && closestHorizontalDistance <= SNAP_THRESHOLD) {
    snappedClientY = bestHorizontalCandidate.snapPoint.position + bestHorizontalCandidate.anchorOffset;
  }

  if (bestVerticalCandidate && closestVerticalDistance <= SNAP_THRESHOLD) {
    snappedClientX = bestVerticalCandidate.snapPoint.position + bestVerticalCandidate.anchorOffset;
  }

  if (bestHorizontalCandidate && closestHorizontalDistance <= SNAP_THRESHOLD) {
    const targetRect = bestHorizontalCandidate.snapPoint.rect;
    horizontalGuide = {
      x1: Math.min(targetRect.x, snappedClientX),
      y1: bestHorizontalCandidate.snapPoint.position,
      x2: Math.max(targetRect.x + targetRect.width, snappedClientX + clientWidth),
      y2: bestHorizontalCandidate.snapPoint.position,
    };
  }

  if (bestVerticalCandidate && closestVerticalDistance <= SNAP_THRESHOLD) {
    const targetRect = bestVerticalCandidate.snapPoint.rect;
    verticalGuide = {
      x1: bestVerticalCandidate.snapPoint.position,
      y1: Math.min(targetRect.y, snappedClientY),
      x2: bestVerticalCandidate.snapPoint.position,
      y2: Math.max(targetRect.y + targetRect.height, snappedClientY + clientHeight),
    };
  }

  // Convert snapped client coords back to local coords
  const snappedX = snappedClientX / scale;
  const snappedY = snappedClientY / scale;

  return {
    x: snappedX,
    y: snappedY,
    horizontalGuide,
    verticalGuide,
  };
}
export function getSnappedResize(
  stage: Konva.Stage,
  resizingGroup: Konva.Group,
  oldBox: FieldRect,
  newBox: FieldRect,
): ResizeSnapResult {
  const { horizontal, vertical } = calculateSnapPositions(stage, resizingGroup.id());
  const { widths, heights } = calculateSnapSizes(stage, resizingGroup.id());

  let snappedX = newBox.x;
  let snappedY = newBox.y;
  let snappedWidth = newBox.width;
  let snappedHeight = newBox.height;
  const horizontalGuides: number[] = [];
  const verticalGuides: number[] = [];

  const isLeftMoving = Math.abs(oldBox.x - newBox.x) > 0.001;
  const isRightMoving = Math.abs(oldBox.x + oldBox.width - (newBox.x + newBox.width)) > 0.001;
  const isTopMoving = Math.abs(oldBox.y - newBox.y) > 0.001;
  const isBottomMoving = Math.abs(oldBox.y + oldBox.height - (newBox.y + newBox.height)) > 0.001;

  let closestVerticalSnap: { position: number; offset: number } | null = null;
  let closestVerticalDist = SNAP_THRESHOLD + 1;

  if (isLeftMoving) {
    for (const snap of vertical) {
      const dist = Math.abs(newBox.x - snap.position);
      if (dist < closestVerticalDist) {
        closestVerticalDist = dist;
        closestVerticalSnap = { position: snap.position, offset: snap.position - newBox.x };
      }
    }
  }

  if (isRightMoving) {
    for (const snap of vertical) {
      const dist = Math.abs(newBox.x + newBox.width - snap.position);
      if (dist < closestVerticalDist) {
        closestVerticalDist = dist;
        closestVerticalSnap = { position: snap.position, offset: snap.position - (newBox.x + newBox.width) };
      }
    }
  }

  if (!closestVerticalSnap) {
    for (const width of widths) {
      if (Math.abs(newBox.width - width) < closestVerticalDist) {
        closestVerticalDist = Math.abs(newBox.width - width);
        if (isRightMoving) {
          closestVerticalSnap = { position: newBox.x + width, offset: width - newBox.width };
        } else if (isLeftMoving) {
          closestVerticalSnap = { position: newBox.x + newBox.width - width, offset: -(width - newBox.width) };
        }
      }
    }
  }

  if (closestVerticalSnap && closestVerticalDist <= SNAP_THRESHOLD) {
    if (isLeftMoving) {
      snappedX += closestVerticalSnap.offset;
      snappedWidth -= closestVerticalSnap.offset;
    } else if (isRightMoving) {
      snappedWidth += closestVerticalSnap.offset;
    }
    verticalGuides.push(closestVerticalSnap.position);
  }

  let closestHorizontalSnap: { position: number; offset: number } | null = null;
  let closestHorizontalDist = SNAP_THRESHOLD + 1;

  if (isTopMoving) {
    for (const snap of horizontal) {
      const dist = Math.abs(newBox.y - snap.position);
      if (dist < closestHorizontalDist) {
        closestHorizontalDist = dist;
        closestHorizontalSnap = { position: snap.position, offset: snap.position - newBox.y };
      }
    }
  }

  if (isBottomMoving) {
    for (const snap of horizontal) {
      const dist = Math.abs(newBox.y + newBox.height - snap.position);
      if (dist < closestHorizontalDist) {
        closestHorizontalDist = dist;
        closestHorizontalSnap = { position: snap.position, offset: snap.position - (newBox.y + newBox.height) };
      }
    }
  }

  if (!closestHorizontalSnap) {
    for (const height of heights) {
      if (Math.abs(newBox.height - height) < closestHorizontalDist) {
        closestHorizontalDist = Math.abs(newBox.height - height);
        if (isBottomMoving) {
          closestHorizontalSnap = { position: newBox.y + height, offset: height - newBox.height };
        } else if (isTopMoving) {
          closestHorizontalSnap = { position: newBox.y + newBox.height - height, offset: -(height - newBox.height) };
        }
      }
    }
  }

  if (closestHorizontalSnap && closestHorizontalDist <= SNAP_THRESHOLD) {
    if (isTopMoving) {
      snappedY += closestHorizontalSnap.offset;
      snappedHeight -= closestHorizontalSnap.offset;
    } else if (isBottomMoving) {
      snappedHeight += closestHorizontalSnap.offset;
    }
    horizontalGuides.push(closestHorizontalSnap.position);
  }

  return {
    x: snappedX,
    y: snappedY,
    width: Math.max(0, snappedWidth),
    height: Math.max(0, snappedHeight),
    horizontalGuides,
    verticalGuides,
  };
}

export function showSnapGuides(
  snapGuideLayer: Konva.Layer,
  horizontalGuide?: GuideLine,
  verticalGuide?: GuideLine,
): void {
  if (!snapGuideLayer) {
    return;
  }

  hideSnapGuides(snapGuideLayer);

  const stage = snapGuideLayer.getStage();
  const scale = stage?.scaleX() ?? 1;

  // Guide coordinates are in client (scaled) space from getClientRect().
  // Konva Line points are in local (unscaled) space, so we divide by scale.
  const stageLocalWidth = (stage?.width() ?? 10000) / scale;
  const stageLocalHeight = (stage?.height() ?? 10000) / scale;

  if (horizontalGuide !== undefined) {
    const y = horizontalGuide.y1 / scale;
    const horizontalLine = new Konva.Line({
      name: 'snap-guide-horizontal',
      points: [0, y, stageLocalWidth, y],
      stroke: 'rgb(0, 161, 255)',
      strokeWidth: 1 / scale,
      dash: [5 / scale, 5 / scale],
      listening: false,
    });
    snapGuideLayer.add(horizontalLine);
  }

  if (verticalGuide !== undefined) {
    const x = verticalGuide.x1 / scale;
    const verticalLine = new Konva.Line({
      name: 'snap-guide-vertical',
      points: [x, 0, x, stageLocalHeight],
      stroke: 'rgb(0, 161, 255)',
      strokeWidth: 1 / scale,
      dash: [5 / scale, 5 / scale],
      listening: false,
    });
    snapGuideLayer.add(verticalLine);
  }

  snapGuideLayer.batchDraw();
}

export function showMultipleSnapGuides(
  snapGuideLayer: Konva.Layer,
  horizontalGuides: number[],
  verticalGuides: number[],
  stageWidth: number,
  stageHeight: number,
): void {
  if (!snapGuideLayer) {
    return;
  }

  hideSnapGuides(snapGuideLayer);

  const stage = snapGuideLayer.getStage();
  const scale = stage?.scaleX() ?? 1;

  // Guide coordinates are in client (scaled) space from getClientRect().
  // Konva Line points are in local (unscaled) space, so we divide by scale.
  const localWidth = stageWidth / scale;
  const localHeight = stageHeight / scale;

  // Show horizontal guides
  horizontalGuides.forEach((guide) => {
    const y = guide / scale;
    const horizontalLine = new Konva.Line({
      name: 'snap-guide-horizontal',
      points: [0, y, localWidth, y],
      stroke: 'rgb(0, 161, 255)',
      strokeWidth: 1 / scale,
      dash: [5 / scale, 5 / scale],
      listening: false,
    });
    snapGuideLayer.add(horizontalLine);
  });

  // Show vertical guides
  verticalGuides.forEach((guide) => {
    const x = guide / scale;
    const verticalLine = new Konva.Line({
      name: 'snap-guide-vertical',
      points: [x, 0, x, localHeight],
      stroke: 'rgb(0, 161, 255)',
      strokeWidth: 1 / scale,
      dash: [5 / scale, 5 / scale],
      listening: false,
    });
    snapGuideLayer.add(verticalLine);
  });

  snapGuideLayer.batchDraw();
}

export function hideSnapGuides(snapGuideLayer: Konva.Layer): void {
  if (!snapGuideLayer) {
    return;
  }

  const guides = snapGuideLayer.find('.snap-guide-horizontal, .snap-guide-vertical');
  guides.forEach((guide: Konva.Node) => {
    guide.destroy();
  });
  snapGuideLayer.batchDraw();
}

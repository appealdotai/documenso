import { PDF_VIEWER_RULER_SIZE } from '@documenso/lib/constants/pdf-viewer';

type PdfViewerPageRulerProps = {
  scaledWidth: number;
  scaledHeight: number;
  unscaledWidth: number;
  unscaledHeight: number;
};

const MAJOR_TICK = 100;
const MINOR_TICK = 10;

export const PdfViewerPageRuler = ({
  scaledWidth,
  scaledHeight,
  unscaledWidth,
  unscaledHeight,
}: PdfViewerPageRulerProps) => {
  const scaleX = scaledWidth / unscaledWidth;
  const scaleY = scaledHeight / unscaledHeight;

  const topTicks = buildTicks(unscaledWidth, scaleX);
  const leftTicks = buildTicks(unscaledHeight, scaleY);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 z-20 border-border border-r border-b bg-muted/90"
        style={{ width: PDF_VIEWER_RULER_SIZE, height: PDF_VIEWER_RULER_SIZE }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute top-0 z-20 overflow-hidden border-border border-b bg-muted/90"
        style={{ left: PDF_VIEWER_RULER_SIZE, width: scaledWidth, height: PDF_VIEWER_RULER_SIZE }}
      >
        {topTicks.map((tick) => (
          <div
            key={`top-${tick.value}`}
            className="absolute bottom-0 border-border border-l"
            style={{
              left: tick.offset,
              height: tick.isMajor ? PDF_VIEWER_RULER_SIZE : PDF_VIEWER_RULER_SIZE / 2,
            }}
          >
            {tick.isMajor && tick.value > 0 && (
              <span className="absolute top-0.5 left-0.5 text-[9px] text-muted-foreground leading-none">
                {tick.value}
              </span>
            )}
          </div>
        ))}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute left-0 z-20 overflow-hidden border-border border-r bg-muted/90"
        style={{ top: PDF_VIEWER_RULER_SIZE, width: PDF_VIEWER_RULER_SIZE, height: scaledHeight }}
      >
        {leftTicks.map((tick) => (
          <div
            key={`left-${tick.value}`}
            className="absolute right-0 border-border border-t"
            style={{
              top: tick.offset,
              width: tick.isMajor ? PDF_VIEWER_RULER_SIZE : PDF_VIEWER_RULER_SIZE / 2,
            }}
          >
            {tick.isMajor && tick.value > 0 && (
              <span className="absolute top-0.5 left-0.5 text-[9px] text-muted-foreground leading-none">
                {tick.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
};

const buildTicks = (unscaledSize: number, scale: number) => {
  const ticks: Array<{ value: number; offset: number; isMajor: boolean }> = [];

  for (let value = 0; value <= unscaledSize; value += MINOR_TICK) {
    ticks.push({
      value,
      offset: value * scale,
      isMajor: value % MAJOR_TICK === 0,
    });
  }

  return ticks;
};

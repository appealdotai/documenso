import {
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DEFAULT_GENERIC_ALIGN,
  FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
  FIELD_DEFAULT_LETTER_SPACING,
  FIELD_DEFAULT_LINE_HEIGHT,
  resolveFieldOverflowMode,
  type TTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { calculateOverflowLayout } from '@documenso/lib/universal/field-renderer/calculate-overflow-layout';
import { konvaTextFontFamily } from '@documenso/lib/universal/field-renderer/field-generic-items';
import { cn } from '@documenso/ui/lib/utils';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';

const PREVIEW_PAGE_WIDTH = 360;
const PREVIEW_PAGE_HEIGHT = 120;
const PREVIEW_FIELD_X = 12;
const PREVIEW_FIELD_Y = 16;
const PREVIEW_TEXT_X_PADDING = 6;

type SignFieldTextPreviewProps = {
  text: string;
  fieldMeta?: TTextFieldMeta;
  fieldWidth: number;
  fieldHeight: number;
};

export const SignFieldTextPreview = ({ text, fieldMeta, fieldWidth, fieldHeight }: SignFieldTextPreviewProps) => {
  const previewLayout = useMemo(() => {
    if (!text) {
      return null;
    }

    const fieldPixelWidth = (fieldWidth / 100) * PREVIEW_PAGE_WIDTH;
    const fieldPixelHeight = (fieldHeight / 100) * PREVIEW_PAGE_HEIGHT;
    const fontSize = fieldMeta?.fontSize ?? DEFAULT_FIELD_FONT_SIZE;
    const textAlign = fieldMeta?.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN;
    const verticalAlign = fieldMeta?.verticalAlign ?? FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN;
    const lineHeight = fieldMeta?.lineHeight ?? FIELD_DEFAULT_LINE_HEIGHT;
    const letterSpacing = fieldMeta?.letterSpacing ?? FIELD_DEFAULT_LETTER_SPACING;
    const baseWidth = fieldPixelWidth - PREVIEW_TEXT_X_PADDING * 2;
    const baseHeight = fieldPixelHeight;

    const layout = calculateOverflowLayout({
      overflowMode: resolveFieldOverflowMode(fieldMeta),
      isLabel: false,
      textToRender: text,
      fontSize,
      fontFamily: konvaTextFontFamily,
      lineHeight,
      letterSpacing,
      textAlign,
      verticalAlign,
      baseX: PREVIEW_TEXT_X_PADDING,
      baseY: 0,
      baseWidth,
      baseHeight,
      groupX: PREVIEW_FIELD_X,
      groupY: PREVIEW_FIELD_Y,
      pageWidth: PREVIEW_PAGE_WIDTH,
      pageHeight: PREVIEW_PAGE_HEIGHT,
    });

    return {
      fieldPixelWidth,
      fieldPixelHeight,
      fontSize,
      textAlign: layout.textAlign,
      verticalAlign: layout.verticalAlign,
      wrap: layout.wrap,
      textX: PREVIEW_FIELD_X + layout.x,
      textY: PREVIEW_FIELD_Y + layout.y,
      textWidth: layout.width,
      textHeight: layout.height,
    };
  }, [text, fieldMeta, fieldWidth, fieldHeight]);

  if (!text || !previewLayout) {
    return null;
  }

  const overflowMode = resolveFieldOverflowMode(fieldMeta);
  const isCropMode = overflowMode === 'crop';

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">
        <Trans>Preview</Trans>
      </p>

      <div
        className="relative overflow-hidden rounded-md border border-border bg-muted/40"
        style={{ width: PREVIEW_PAGE_WIDTH, height: PREVIEW_PAGE_HEIGHT }}
      >
        <div
          className="absolute rounded-[2px] border-2 border-primary/60 border-dashed bg-white/80"
          style={{
            left: PREVIEW_FIELD_X,
            top: PREVIEW_FIELD_Y,
            width: previewLayout.fieldPixelWidth,
            height: previewLayout.fieldPixelHeight,
          }}
        />

        <p
          className={cn('absolute text-foreground leading-none', {
            'overflow-hidden': isCropMode,
            'whitespace-nowrap': previewLayout.wrap === 'none',
            'whitespace-pre-wrap break-words': previewLayout.wrap === 'word',
            'text-left': previewLayout.textAlign === 'left',
            'text-center': previewLayout.textAlign === 'center',
            'text-right': previewLayout.textAlign === 'right',
          })}
          style={{
            left: previewLayout.textX,
            top: previewLayout.textY,
            width: previewLayout.textWidth,
            height: isCropMode ? previewLayout.textHeight : undefined,
            fontSize: previewLayout.fontSize,
            lineHeight: fieldMeta?.lineHeight ?? FIELD_DEFAULT_LINE_HEIGHT,
            letterSpacing: fieldMeta?.letterSpacing ?? FIELD_DEFAULT_LETTER_SPACING,
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
};

import { DEFAULT_STANDARD_FONT_SIZE } from '@documenso/lib/constants/pdf';
import type { TFieldOverflowMode, TFieldTextAlignSchema } from '@documenso/lib/types/field-meta';
import { resolveFieldOverflowMode } from '@documenso/lib/types/field-meta';
import { konvaTextFontFamily } from '@documenso/lib/universal/field-renderer/field-generic-items';
import { cn } from '@documenso/ui/lib/utils';
import { type CSSProperties, type KeyboardEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';

export const INLINE_FIELD_TEXT_PADDING_PX = 6;

/** iOS zooms focused inputs under 16px, which shifts the caret vs the field overlay. */
const MOBILE_MIN_FONT_SIZE_PX = 16;

export type InlineFieldInputProps = {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder?: string;
  textAlign?: TFieldTextAlignSchema;
  overflow?: TFieldOverflowMode;
  fontSize?: number;
  /**
   * When set, scales `fontSize` for zoomed Konva pages (V2).
   * Defaults to 1 for V1 DOM overlays.
   */
  scale?: number;
  characterLimit?: number;
  hasError?: boolean;
  disabled?: boolean;
  /**
   * `text` uses a textarea (Shift+Enter for newline).
   * `number` uses a single-line input with decimal inputMode.
   */
  variant: 'text' | 'number';
  autoFocus?: boolean;
  className?: string;
  'aria-label'?: string;
};

const usePrefersCoarsePointer = () => {
  const [prefersCoarsePointer, setPrefersCoarsePointer] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => {
      setPrefersCoarsePointer(mediaQuery.matches);
    };

    update();
    mediaQuery.addEventListener('change', update);

    return () => {
      mediaQuery.removeEventListener('change', update);
    };
  }, []);

  return prefersCoarsePointer;
};

export const InlineFieldInput = ({
  value,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  textAlign = 'left',
  overflow,
  fontSize = DEFAULT_STANDARD_FONT_SIZE,
  scale = 1,
  characterLimit,
  hasError = false,
  disabled = false,
  variant,
  autoFocus = true,
  className,
  'aria-label': ariaLabel,
}: InlineFieldInputProps) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const skipCommitOnBlurRef = useRef(false);
  // Ignore blur that fires immediately after open (same click that focused the input).
  const canCommitOnBlurRef = useRef(false);
  const prefersCoarsePointer = usePrefersCoarsePointer();

  const overflowMode = resolveFieldOverflowMode({ overflow });
  const isHorizontalOverflow = overflowMode === 'horizontal';
  const isMultilineText = variant === 'text' && (overflowMode === 'vertical' || overflowMode === 'auto');

  const scaledFontSize = useMemo(() => {
    const baseSize = fontSize * scale;

    // Prevent iOS focus-zoom which misaligns the caret relative to the field box.
    if (prefersCoarsePointer) {
      return Math.max(baseSize, MOBILE_MIN_FONT_SIZE_PX);
    }

    return baseSize;
  }, [fontSize, prefersCoarsePointer, scale]);

  const scaledPadding = INLINE_FIELD_TEXT_PADDING_PX * scale;

  useEffect(() => {
    canCommitOnBlurRef.current = false;

    const enableBlurCommit = window.setTimeout(() => {
      canCommitOnBlurRef.current = true;
    }, 200);

    return () => {
      window.clearTimeout(enableBlurCommit);
    };
  }, []);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const node = inputRef.current;

    if (!node) {
      return;
    }

    node.focus();

    if (typeof node.setSelectionRange === 'function') {
      const length = node.value.length;
      node.setSelectionRange(length, length);
    }
  }, [autoFocus]);

  const handleBlur = () => {
    if (skipCommitOnBlurRef.current) {
      skipCommitOnBlurRef.current = false;
      return;
    }

    // Re-focus instead of closing when the opening click steals focus back.
    if (!canCommitOnBlurRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return;
    }

    onCommit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      skipCommitOnBlurRef.current = true;
      onCancel();
      return;
    }

    if (event.key !== 'Enter') {
      return;
    }

    if (variant === 'text' && event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    // Enter already commits; skip the blur that follows so we don't double-commit.
    skipCommitOnBlurRef.current = true;
    onCommit();
  };

  const sharedClassName = cn(
    'box-border w-full resize-none border-0 bg-transparent shadow-none outline-none',
    'focus-visible:ring-0 focus-visible:ring-offset-0',
    {
      'h-full': isMultilineText,
      'h-auto max-h-full': !isMultilineText,
      'text-left': textAlign === 'left',
      'text-center': textAlign === 'center',
      'text-right': textAlign === 'right',
      'overflow-hidden whitespace-nowrap': isHorizontalOverflow || variant === 'number',
      'overflow-hidden whitespace-pre-wrap break-words': !isHorizontalOverflow && variant === 'text',
      'text-destructive': hasError,
    },
    className,
  );

  const sharedStyle: CSSProperties = {
    fontFamily: konvaTextFontFamily,
    fontSize: `${scaledFontSize}px`,
    lineHeight: 1.2,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: `${scaledPadding}px`,
    paddingRight: `${scaledPadding}px`,
    margin: 0,
    color: 'black',
    // Kill iOS / WebKit intrinsic textarea padding that pushes the caret down.
    WebkitAppearance: 'none',
  };

  return (
    <div
      className={cn('flex h-full w-full', {
        'items-center': !isMultilineText,
        'items-stretch': isMultilineText,
      })}
    >
      {variant === 'number' ? (
        <input
          ref={inputRef as RefObject<HTMLInputElement>}
          id="custom-number"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={hasError}
          aria-label={ariaLabel}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          maxLength={characterLimit && characterLimit > 0 ? characterLimit : undefined}
          className={sharedClassName}
          style={sharedStyle}
          onChange={(event) => onChange(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : (
        <textarea
          ref={inputRef as RefObject<HTMLTextAreaElement>}
          id="custom-text"
          rows={isMultilineText ? undefined : 1}
          aria-invalid={hasError}
          aria-label={ariaLabel}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          maxLength={characterLimit && characterLimit > 0 ? characterLimit : undefined}
          className={sharedClassName}
          style={sharedStyle}
          onChange={(event) => onChange(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      )}
    </div>
  );
};

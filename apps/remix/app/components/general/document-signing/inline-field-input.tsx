import { DEFAULT_STANDARD_FONT_SIZE } from '@documenso/lib/constants/pdf';
import type { TFieldOverflowMode, TFieldTextAlignSchema } from '@documenso/lib/types/field-meta';
import { resolveFieldOverflowMode } from '@documenso/lib/types/field-meta';
import { konvaTextFontFamily } from '@documenso/lib/universal/field-renderer/field-generic-items';
import { cn } from '@documenso/ui/lib/utils';
import { type CSSProperties, type KeyboardEvent, type RefObject, useEffect, useRef } from 'react';

export const INLINE_FIELD_TEXT_PADDING_PX = 6;

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

  const overflowMode = resolveFieldOverflowMode({ overflow });
  const isHorizontalOverflow = overflowMode === 'horizontal';
  const scaledFontSize = fontSize * scale;
  const scaledPadding = INLINE_FIELD_TEXT_PADDING_PX * scale;

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
    'box-border h-full w-full resize-none border-0 bg-transparent p-0 shadow-none outline-none',
    'focus-visible:ring-0 focus-visible:ring-offset-0',
    {
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
    paddingLeft: `${scaledPadding}px`,
    paddingRight: `${scaledPadding}px`,
    color: 'black',
  };

  if (variant === 'number') {
    return (
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
    );
  }

  return (
    <textarea
      ref={inputRef as RefObject<HTMLTextAreaElement>}
      id="custom-text"
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
  );
};

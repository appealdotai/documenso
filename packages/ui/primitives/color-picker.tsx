import { colord } from 'colord';
import type { HTMLAttributes } from 'react';
import { useEffect, useState } from 'react';
import { HexAlphaColorPicker, HexColorInput, HexColorPicker, setNonce } from 'react-colorful';

import { cn } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export type ColorPickerProps = {
  disabled?: boolean;
  value: string;
  defaultValue?: string;
  onChange: (color: string) => void;
  nonce?: string;
  /**
   * When true, shows an alpha slider and persists `#rrggbbaa` (including `ff`
   * when fully opaque) so intentional opacity can be distinguished from
   * legacy 6-digit hex values.
   */
  enableAlpha?: boolean;
} & HTMLAttributes<HTMLDivElement>;

const toHex2 = (value: number) => Math.round(value).toString(16).padStart(2, '0');

/**
 * Persist colours with an explicit alpha channel (`#rrggbbaa`).
 * `colord().toHex()` omits the alpha byte when a === 1, which would make
 * "user set 100%" look identical to a legacy opaque hex.
 */
export const toHexWithAlpha = (color: string): string => {
  const parsed = colord(color);

  if (!parsed.isValid()) {
    return color;
  }

  const { r, g, b, a } = parsed.toRgb();

  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}${toHex2(a * 255)}`;
};

export const ColorPicker = ({
  className,
  disabled = false,
  value,
  defaultValue = '#000000',
  onChange,
  nonce,
  enableAlpha = false,
  ...props
}: ColorPickerProps) => {
  const initialValue = value || defaultValue;
  const [color, setColor] = useState(initialValue);
  const [inputColor, setInputColor] = useState(initialValue);

  const emitChange = (newColor: string) => {
    const nextColor = enableAlpha ? toHexWithAlpha(newColor) : newColor;

    setColor(nextColor);
    setInputColor(nextColor);
    onChange(nextColor);
  };

  const onColorChange = (newColor: string) => {
    emitChange(newColor);
  };

  const onInputChange = (newColor: string) => {
    setInputColor(newColor);
  };

  const onInputBlur = () => {
    emitChange(inputColor);
  };

  useEffect(() => {
    if (nonce) {
      setNonce(nonce);
    }
  }, [nonce]);

  const Picker = enableAlpha ? HexAlphaColorPicker : HexColorPicker;

  return (
    <Popover>
      <PopoverTrigger>
        <button
          type="button"
          disabled={disabled}
          className="h-12 w-12 rounded-md border bg-background p-1 disabled:pointer-events-none disabled:opacity-50"
        >
          <div
            className="h-full w-full rounded-sm"
            style={
              enableAlpha
                ? {
                    backgroundImage:
                      'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                    backgroundSize: '8px 8px',
                    backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
                  }
                : undefined
            }
          >
            <div className="h-full w-full rounded-sm" style={{ backgroundColor: color }} />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto">
        <Picker
          className={cn(className, 'w-full aria-disabled:pointer-events-none aria-disabled:opacity-50')}
          color={color}
          onChange={onColorChange}
          aria-disabled={disabled}
          nonce={nonce}
          {...props}
        />

        <HexColorInput
          className="mt-4 h-10 rounded-md border bg-transparent px-3 py-2 text-sm disabled:pointer-events-none disabled:opacity-50"
          color={inputColor}
          onChange={onInputChange}
          onBlur={onInputBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onInputBlur();
            }
          }}
          disabled={disabled}
          nonce={nonce}
          alpha={enableAlpha}
        />
      </PopoverContent>
    </Popover>
  );
};

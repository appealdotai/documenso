import {
  MAX_SHAPE_BORDER_WIDTH,
  MAX_SHAPE_CORNER_RADIUS,
  SHAPE_FILL_PRESETS,
  type TShapeFieldMeta as ShapeFieldMeta,
  ZShapeFieldMeta,
} from '@documenso/lib/types/field-meta';
import { cn } from '@documenso/ui/lib/utils';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Slider } from '@documenso/ui/primitives/slider';
import { Switch } from '@documenso/ui/primitives/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

const ZShapeFieldFormSchema = ZShapeFieldMeta.pick({
  shape: true,
  fillColor: true,
  fillOpacity: true,
  borderColor: true,
  borderWidth: true,
  borderStyle: true,
  cornerRadius: true,
  backgroundVisible: true,
});

type TShapeFieldFormSchema = z.infer<typeof ZShapeFieldFormSchema>;

type EditorFieldShapeFormProps = {
  value: ShapeFieldMeta | undefined;
  onValueChange: (value: ShapeFieldMeta) => void;
};

const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;

/**
 * Hex text input with local draft state. Valid input commits through
 * `onCommit` on blur (and Enter); invalid input reverts to the last
 * committed `value`. Draft keystrokes never touch form state.
 */
const ShapeHexInput = ({
  id,
  value,
  shown,
  disabled,
  onCommit,
}: {
  id: string;
  value: string | null;
  shown: string;
  disabled?: boolean;
  onCommit: (hex: string | null) => void;
}) => {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const commit = () => {
    if (HEX_PATTERN.test(draft)) {
      onCommit(draft.toUpperCase());
    } else {
      setDraft(value ?? '');
    }
  };

  return (
    <Input
      id={id}
      value={draft}
      placeholder={shown}
      disabled={disabled}
      maxLength={7}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
      }}
      className="font-mono text-xs uppercase"
    />
  );
};

type ShapeColorFieldProps = {
  id: string;
  label: React.ReactNode;
  value: string | null;
  onCommit: (hex: string | null) => void;
  allowNone?: boolean;
  disabled?: boolean;
  hexInput: React.ReactNode;
};

/**
 * Spectrum swatch + hex input + preset swatches on the surface.
 * `value === null` means "no color" (only valid when `allowNone` is set, i.e. Fill).
 * Commits only valid hex values.
 */
const ShapeColorField = ({
  id,
  label,
  value,
  onCommit,
  allowNone = false,
  disabled,
  hexInput,
}: ShapeColorFieldProps) => {
  const shown = value ?? '#FFFFFF'; // what the picker and hex input display when null

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${id} color picker`}
          value={shown}
          disabled={disabled}
          onChange={(event) => onCommit(event.target.value.toUpperCase())}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {hexInput}
      </div>

      {/* Preset swatches live on the surface; the spectrum picker above is the fallback */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${id} presets`}>
        {allowNone && (
          <button
            type="button"
            aria-label="No fill"
            aria-pressed={value === null}
            disabled={disabled && value !== null}
            onClick={() => onCommit(null)}
            className={cn(
              'relative h-5 w-5 overflow-hidden rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              value === null && 'ring-2 ring-primary ring-offset-1',
            )}
            style={{
              backgroundImage: 'repeating-conic-gradient(#d4d4d4 0% 25%, #fff 0% 50%)',
              backgroundSize: '8px 8px',
            }}
          >
            <span className="absolute inset-0 -rotate-45 border-red-500 border-t" />
          </button>
        )}
        {SHAPE_FILL_PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={`Use ${hex} for ${id}`}
            aria-pressed={value?.toUpperCase() === hex}
            disabled={disabled}
            onClick={() => onCommit(hex)}
            className={cn(
              'h-5 w-5 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50',
              value?.toUpperCase() === hex && 'ring-2 ring-primary ring-offset-1',
            )}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  );
};

export const EditorFieldShapeForm = ({ value, onValueChange }: EditorFieldShapeFormProps) => {
  const form = useForm<TShapeFieldFormSchema>({
    resolver: zodResolver(ZShapeFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      shape: value?.shape ?? 'rectangle',
      fillColor: value?.fillColor ?? null,
      fillOpacity: value?.fillOpacity ?? 1,
      borderColor: value?.borderColor ?? '#000000',
      borderWidth: value?.borderWidth ?? 2,
      borderStyle: value?.borderStyle ?? 'solid',
      cornerRadius: value?.cornerRadius ?? 0,
      backgroundVisible: value?.backgroundVisible ?? true,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZShapeFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'shape',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  const shape = formValues.shape ?? 'rectangle';
  const noFill = formValues.fillColor == null;
  const noBorder = formValues.borderStyle === 'none';
  const isLineLike = shape === 'line' || shape === 'arrow';

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="shape"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Shape</Trans>
                </FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rectangle">
                        <Trans>Rectangle</Trans>
                      </SelectItem>
                      <SelectItem value="ellipse">
                        <Trans>Ellipse</Trans>
                      </SelectItem>
                      <SelectItem value="triangle">
                        <Trans>Triangle</Trans>
                      </SelectItem>
                      <SelectItem value="line">
                        <Trans>Line</Trans>
                      </SelectItem>
                      <SelectItem value="arrow">
                        <Trans>Arrow</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isLineLike && (
            <div className="grid grid-cols-2 gap-3">
              <ShapeColorField
                id="shape-fill"
                label={<Trans>Fill</Trans>}
                value={formValues.fillColor ?? null}
                allowNone
                onCommit={(fillColor) => form.setValue('fillColor', fillColor, { shouldValidate: true })}
                hexInput={
                  <ShapeHexInput
                    id="shape-fill"
                    value={formValues.fillColor ?? null}
                    shown={formValues.fillColor ?? '#FFFFFF'}
                    onCommit={(fillColor) => form.setValue('fillColor', fillColor, { shouldValidate: true })}
                  />
                }
              />
              <ShapeColorField
                id="shape-border"
                label={<Trans>Border</Trans>}
                value={formValues.borderColor ?? '#000000'}
                disabled={noBorder}
                onCommit={(borderColor) => {
                  if (borderColor) {
                    form.setValue('borderColor', borderColor, { shouldValidate: true });
                  }
                }}
                hexInput={
                  <ShapeHexInput
                    id="shape-border"
                    value={formValues.borderColor ?? '#000000'}
                    shown={formValues.borderColor ?? '#000000'}
                    disabled={noBorder}
                    onCommit={(borderColor) => {
                      if (borderColor) {
                        form.setValue('borderColor', borderColor, { shouldValidate: true });
                      }
                    }}
                  />
                }
              />
            </div>
          )}

          {isLineLike && (
            <ShapeColorField
              id="shape-border"
              label={<Trans>Border</Trans>}
              value={formValues.borderColor ?? '#000000'}
              disabled={noBorder}
              onCommit={(borderColor) => {
                if (borderColor) {
                  form.setValue('borderColor', borderColor, { shouldValidate: true });
                }
              }}
              hexInput={
                <ShapeHexInput
                  id="shape-border"
                  value={formValues.borderColor ?? '#000000'}
                  shown={formValues.borderColor ?? '#000000'}
                  disabled={noBorder}
                  onCommit={(borderColor) => {
                    if (borderColor) {
                      form.setValue('borderColor', borderColor, { shouldValidate: true });
                    }
                  }}
                />
              }
            />
          )}

          {!isLineLike && (
            <div className="flex items-center justify-between">
              <Label htmlFor="shape-no-fill">
                <Trans>No fill</Trans>
              </Label>
              <Switch
                id="shape-no-fill"
                checked={noFill}
                onCheckedChange={(checked) =>
                  form.setValue('fillColor', checked ? null : '#FFFFFF', { shouldValidate: true })
                }
              />
            </div>
          )}

          {!isLineLike && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  <Trans>Opacity</Trans>
                </Label>
                <span className="text-muted-foreground text-xs">
                  {Math.round((formValues.fillOpacity ?? 1) * 100)}%
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                disabled={noFill}
                value={[Math.round((formValues.fillOpacity ?? 1) * 100)]}
                onValueChange={([opacity]) =>
                  form.setValue('fillOpacity', (opacity ?? 100) / 100, { shouldValidate: true })
                }
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="borderWidth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="shape-border-width">
                    <Trans>Border width</Trans>
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        {...field}
                        id="shape-border-width"
                        type="number"
                        min={0}
                        max={MAX_SHAPE_BORDER_WIDTH}
                        step={1}
                        disabled={noBorder}
                        value={field.value ?? ''}
                        onChange={(event) => {
                          const width = event.target.value === '' ? 0 : Number(event.target.value);
                          field.onChange(Math.min(MAX_SHAPE_BORDER_WIDTH, Math.max(0, width || 0)));
                        }}
                        className="pr-8"
                      />
                    </FormControl>
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground text-xs">
                      px
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="borderStyle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Border style</Trans>
                  </FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">
                          <Trans>Solid</Trans>
                        </SelectItem>
                        <SelectItem value="dashed">
                          <Trans>Dashed</Trans>
                        </SelectItem>
                        <SelectItem value="none">
                          <Trans>None</Trans>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {shape === 'rectangle' && (
            <FormField
              control={form.control}
              name="cornerRadius"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="shape-radius">
                    <Trans>Corner radius</Trans>
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        {...field}
                        id="shape-radius"
                        type="number"
                        min={0}
                        max={MAX_SHAPE_CORNER_RADIUS}
                        value={field.value ?? ''}
                        onChange={(event) => {
                          const radius = event.target.value === '' ? 0 : Number(event.target.value);
                          field.onChange(Math.min(MAX_SHAPE_CORNER_RADIUS, Math.max(0, radius || 0)));
                        }}
                        className="pr-8"
                      />
                    </FormControl>
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground text-xs">
                      px
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </fieldset>
      </form>
    </Form>
  );
};

import {
  type TDateFieldMeta as DateFieldMeta,
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DATE_META_DEFAULT_VALUES,
  FIELD_DEFAULT_GENERIC_ALIGN,
  ZDateFieldMeta,
} from '@documenso/lib/types/field-meta';
import {
  autoFormatDateInput,
  formatIsoDateForDisplay,
  getDateFormatPlaceholder,
  getDateFormatStructure,
  parseFormattedDateInput,
} from '@documenso/lib/utils/date-input-format';
import { Button } from '@documenso/ui/primitives/button';
import { Calendar } from '@documenso/ui/primitives/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { CalendarIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  EditorGenericBackgroundField,
  EditorGenericFontSizeField,
  EditorGenericLabelField,
  EditorGenericReadOnlyField,
  EditorGenericRequiredField,
  EditorGenericTextAlignField,
} from './editor-field-generic-field-forms';

const ZDateFieldFormSchema = ZDateFieldMeta.pick({
  fontSize: true,
  textAlign: true,
  overflow: true,
  label: true,
  value: true,
  required: true,
  readOnly: true,
  backgroundVisible: true,
}).refine(
  (data) => {
    return !data.readOnly || (data.value && data.value.length > 0);
  },
  {
    message: 'A read-only field must have a date value',
    path: ['value'],
  },
);

type TDateFieldFormSchema = z.infer<typeof ZDateFieldFormSchema>;

type EditorFieldDateFormProps = {
  value: z.input<typeof ZDateFieldMeta> | undefined;
  onValueChange: (value: DateFieldMeta) => void;
  dateFormat?: string | null;
};

export const EditorFieldDateForm = ({
  value = {
    type: 'date',
  },
  onValueChange,
  dateFormat,
}: EditorFieldDateFormProps) => {
  const { t } = useLingui();

  const dateStructure = useMemo(() => getDateFormatStructure(dateFormat), [dateFormat]);

  const form = useForm<TDateFieldFormSchema>({
    resolver: zodResolver(ZDateFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
      overflow: value.overflow || FIELD_DATE_META_DEFAULT_VALUES.overflow,
      label: value.label || '',
      value: value.value || '',
      required: value.required || false,
      readOnly: value.readOnly || false,
      backgroundVisible: value.backgroundVisible ?? true,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  useEffect(() => {
    const validatedFormValues = ZDateFieldFormSchema.safeParse(formValues);

    if (formValues.readOnly && !formValues.value) {
      void form.trigger('value');
    }

    if (validatedFormValues.success) {
      onValueChange({
        type: 'date',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const isoDate = DateTime.fromJSDate(date).toISODate() ?? '';
      form.setValue('value', isoDate);
      form.clearErrors('value');
      setDateDraft(formatIsoDateForDisplay(isoDate, dateFormat));
    } else {
      form.setValue('value', '');
      form.clearErrors('value');
      setDateDraft('');
    }
    setIsCalendarOpen(false);
  };

  const committedIsoValue = formValues.value ?? '';
  const [dateDraft, setDateDraft] = useState(() => formatIsoDateForDisplay(value.value, dateFormat));

  // Keep the display in sync when the committed value changes elsewhere
  // (calendar picks, undo, field switches). Keystrokes only touch the draft.
  useEffect(() => {
    setDateDraft(formatIsoDateForDisplay(committedIsoValue, dateFormat));
  }, [committedIsoValue, dateFormat]);

  const commitDateDraft = (draft: string) => {
    if (!draft.trim()) {
      form.setValue('value', '');
      form.clearErrors('value');
      setDateDraft('');
      return;
    }

    const iso = parseFormattedDateInput(draft, dateFormat);

    if (!iso) {
      form.setError('value', {
        message: t`Enter a valid date like ${getDateFormatPlaceholder(dateFormat)}`,
      });
      setDateDraft(formatIsoDateForDisplay(committedIsoValue, dateFormat));
      return;
    }

    form.clearErrors('value');
    form.setValue('value', iso);
    setDateDraft(formatIsoDateForDisplay(iso, dateFormat));
  };

  const selectedDate = committedIsoValue ? DateTime.fromISO(committedIsoValue).toJSDate() : undefined;

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericFontSizeField formControl={form.control} />

          <EditorGenericTextAlignField formControl={form.control} />

          <EditorGenericLabelField formControl={form.control} />

          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Date Value</Trans>
                </FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      data-testid="field-form-date-value"
                      placeholder={getDateFormatPlaceholder(dateFormat)}
                      value={dateDraft}
                      maxLength={10}
                      onChange={(event) => setDateDraft(autoFormatDateInput(event.target.value, dateStructure))}
                      onBlur={() => commitDateDraft(dateDraft)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitDateDraft(dateDraft);
                        }
                      }}
                    />
                  </FormControl>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-9 w-9 shrink-0 p-0" type="button">
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} />
                    </PopoverContent>
                  </Popover>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="mt-1">
            <EditorGenericRequiredField formControl={form.control} />
          </div>

          <EditorGenericReadOnlyField formControl={form.control} />

          <EditorGenericBackgroundField formControl={form.control} />
        </fieldset>
      </form>
    </Form>
  );
};

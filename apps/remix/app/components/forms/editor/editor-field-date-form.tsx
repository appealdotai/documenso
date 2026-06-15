import {
  type TDateFieldMeta as DateFieldMeta,
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DATE_META_DEFAULT_VALUES,
  FIELD_DEFAULT_GENERIC_ALIGN,
  ZDateFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Button } from '@documenso/ui/primitives/button';
import { Calendar } from '@documenso/ui/primitives/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { CalendarIcon } from 'lucide-react';
import { DateTime } from 'luxon';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  EditorGenericFontSizeField,
  EditorGenericLabelField,
  EditorGenericReadOnlyField,
  EditorGenericTextAlignField,
} from './editor-field-generic-field-forms';

const ZDateFieldFormSchema = ZDateFieldMeta.pick({
  fontSize: true,
  textAlign: true,
  overflow: true,
  label: true,
  value: true,
  readOnly: true,
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
};

export const EditorFieldDateForm = ({
  value = {
    type: 'date',
  },
  onValueChange,
}: EditorFieldDateFormProps) => {
  const { t } = useLingui();

  const form = useForm<TDateFieldFormSchema>({
    resolver: zodResolver(ZDateFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
      overflow: value.overflow || FIELD_DATE_META_DEFAULT_VALUES.overflow,
      label: value.label || '',
      value: value.value || '',
      readOnly: value.readOnly || false,
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

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const isoDate = DateTime.fromJSDate(date).toISODate() ?? '';
      form.setValue('value', isoDate);
    } else {
      form.setValue('value', '');
    }
  };

  const selectedDate = formValues.value ? DateTime.fromISO(formValues.value).toJSDate() : undefined;

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
                      placeholder={t`YYYY-MM-DD`}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-9 w-9 shrink-0 p-0" type="button">
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="mt-1">
            <EditorGenericReadOnlyField formControl={form.control} />
          </div>
        </fieldset>
      </form>
    </Form>
  );
};

import type { TDateFieldMeta } from '@documenso/lib/types/field-meta';
import { Button } from '@documenso/ui/primitives/button';
import { Calendar } from '@documenso/ui/primitives/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Trans, useLingui } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import { useState } from 'react';
import { createCallable } from 'react-call';

export type SignFieldDateDialogProps = {
  fieldMeta?: TDateFieldMeta;
  defaultValue?: string;
  dateFormat?: string;
};

export const SignFieldDateDialog = createCallable<SignFieldDateDialogProps, string | null>(
  ({ call, fieldMeta, defaultValue = '', dateFormat }) => {
    const { t } = useLingui();

    const initialDate = defaultValue
      ? DateTime.fromISO(defaultValue).isValid
        ? DateTime.fromISO(defaultValue).toJSDate()
        : DateTime.fromFormat(defaultValue, dateFormat || 'yyyy-MM-dd').isValid
          ? DateTime.fromFormat(defaultValue, dateFormat || 'yyyy-MM-dd').toJSDate()
          : undefined
      : undefined;

    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);

    const handleSubmit = () => {
      if (selectedDate) {
        call.end(DateTime.fromJSDate(selectedDate).toISODate() ?? null);
      } else {
        call.end(null);
      }
    };

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fieldMeta?.label || <Trans>Select Date</Trans>}</DialogTitle>

            <DialogDescription className="mt-4">
              {fieldMeta?.placeholder || <Trans>Please select a date</Trans>}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-4">
            <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => call.end(null)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button type="button" onClick={handleSubmit} disabled={!selectedDate}>
              <Trans>Confirm</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);

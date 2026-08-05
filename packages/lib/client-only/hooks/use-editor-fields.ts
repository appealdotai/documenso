import { getPdfPagesCount } from '@documenso/lib/constants/pdf-viewer';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

/** Maximum number of undo steps to keep in memory. */
const MAX_HISTORY_SIZE = 50;

export const ZLocalFieldSchema = z.object({
  // This is the actual ID of the field if created.
  id: z.number().optional(),
  // This is the local client side ID of the field.
  formId: z.string().min(1),
  // This is the ID of the envelope item to put the field on.
  envelopeItemId: z.string(),
  type: z.nativeEnum(FieldType),
  recipientId: z.number(),
  page: z.number().min(1),
  positionX: z.number().min(0),
  positionY: z.number().min(0),
  width: z.number().min(0),
  height: z.number().min(0),
  fieldMeta: ZFieldMetaSchema,
});

export type TLocalField = z.infer<typeof ZLocalFieldSchema>;

const ZEditorFieldsFormSchema = z.object({
  fields: z.array(ZLocalFieldSchema),
});

export type TEditorFieldsFormSchema = z.infer<typeof ZEditorFieldsFormSchema>;

type EditorFieldsProps = {
  envelope: TEditorEnvelope;
  handleFieldsUpdate: (fields: TLocalField[]) => unknown;
  /**
   * Optional callback called after undo/redo to flush the queued save
   * immediately, bypassing the normal debounce delay.
   */
  handleFieldsFlush?: () => Promise<void>;
};

type UseEditorFieldsResponse = {
  localFields: TLocalField[];

  // Selected field
  selectedField: TLocalField | undefined;
  setSelectedField: (formId: string | null) => void;

  // Field operations
  addField: (field: Omit<TLocalField, 'formId'>) => TLocalField;
  setFieldId: (formId: string, id: number) => void;
  removeFieldsByFormId: (formIds: string[]) => void;
  updateFieldByFormId: (formId: string, updates: Partial<TLocalField>) => void;
  duplicateField: (field: TLocalField, recipientId?: number) => TLocalField;
  duplicateFieldToAllPages: (field: TLocalField, recipientId?: number) => TLocalField[];

  // Field utilities
  getFieldByFormId: (formId: string) => TLocalField | undefined;
  getFieldsByRecipient: (recipientId: number) => TLocalField[];

  // Selected recipient
  selectedRecipient: TEditorEnvelope['recipients'][number] | null;
  setSelectedRecipient: (recipientId: number | null) => void;

  // History (undo / redo)
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  resetForm: (fields?: Field[]) => void;
};

export const useEditorFields = ({
  envelope,
  handleFieldsUpdate,
  handleFieldsFlush,
}: EditorFieldsProps): UseEditorFieldsResponse => {
  const [selectedFieldFormId, setSelectedFieldFormId] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);

  /**
   * Undo / redo history stacks.
   *
   * Each entry is a deep-cloned snapshot of `localFields` at a commit point
   * (add, remove, update-meta, duplicate).  We do NOT snapshot during drag/resize
   * because `updateFieldByFormId` is called on every pointer-move tick; instead
   * callers pass `skipHistory: true` for intermediate moves and omit the flag
   * (or explicitly pass `false`) for the final committed position.
   */
  const historyPastRef = useRef<TLocalField[][]>([]);
  const historyFutureRef = useRef<TLocalField[][]>([]);
  // Re-render trigger so canUndo/canRedo stay reactive without storing stacks in useState.
  const [historyVersion, setHistoryVersion] = useState(0);
  const bumpHistory = () => setHistoryVersion((v) => v + 1);

  const generateDefaultValues = (fields?: Field[]) => {
    const formFields = (fields || envelope.fields).map(
      (field): TLocalField => ({
        id: field.id,
        formId: nanoid(),
        envelopeItemId: field.envelopeItemId,
        page: field.page,
        type: field.type,
        positionX: Number(field.positionX),
        positionY: Number(field.positionY),
        width: Number(field.width),
        height: Number(field.height),
        recipientId: field.recipientId,
        fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
      }),
    );

    return {
      fields: formFields,
    };
  };

  const form = useForm<TEditorFieldsFormSchema>({
    defaultValues: generateDefaultValues(),
    resolver: zodResolver(ZEditorFieldsFormSchema),
  });

  const {
    append,
    remove,
    update,
    fields: localFields,
  } = useFieldArray({
    control: form.control,
    name: 'fields',
    keyName: 'react-hook-form-id',
  });

  const triggerFieldsUpdate = () => {
    void handleFieldsUpdate(form.getValues().fields);
  };

  /**
   * Push a snapshot of the current fields onto the undo stack and clear the redo
   * stack (a new action breaks the forward history).
   */
  const snapshotHistory = useCallback(() => {
    const snapshot = structuredClone(form.getValues().fields) as TLocalField[];

    historyPastRef.current = [...historyPastRef.current.slice(-(MAX_HISTORY_SIZE - 1)), snapshot];
    historyFutureRef.current = [];
    bumpHistory();
  }, [form]);

  const setSelectedField = (formId: string | null, bypassCheck = false) => {
    if (!formId) {
      setSelectedFieldFormId(null);
      return;
    }

    const foundField = localFields.find((field) => field.formId === formId);
    const recipient = envelope.recipients.find((recipient) => recipient.id === foundField?.recipientId);

    if (recipient) {
      setSelectedRecipient(recipient.id);
    }

    if (bypassCheck) {
      setSelectedFieldFormId(formId);
      return;
    }

    setSelectedFieldFormId(foundField?.formId ?? null);
  };

  const addField = useCallback(
    (fieldData: Omit<TLocalField, 'formId'>): TLocalField => {
      snapshotHistory();

      const field: TLocalField = {
        ...fieldData,
        formId: nanoid(12),
        ...restrictFieldPosValues(fieldData),
      };

      append(field);
      triggerFieldsUpdate();
      setSelectedField(field.formId, true);
      return field;
    },
    [append, triggerFieldsUpdate, setSelectedField, snapshotHistory],
  );

  const removeFieldsByFormId = useCallback(
    (formIds: string[]) => {
      const indexes = formIds
        .map((formId) => localFields.findIndex((field) => field.formId === formId))
        .filter((index) => index !== -1);

      if (indexes.length > 0) {
        snapshotHistory();
        remove(indexes);
        triggerFieldsUpdate();
      }
    },
    [localFields, remove, triggerFieldsUpdate, snapshotHistory],
  );

  const setFieldId = (formId: string, id: number) => {
    const { fields } = form.getValues();

    const index = fields.findIndex((field) => field.formId === formId);

    if (index !== -1) {
      update(index, {
        ...fields[index],
        id,
      });
    }
  };

  const updateFieldByFormId = useCallback(
    (formId: string, updates: Partial<TLocalField>, skipHistory = false) => {
      const index = localFields.findIndex((field) => field.formId === formId);

      if (index !== -1) {
        if (!skipHistory) {
          snapshotHistory();
        }

        const updatedField = {
          ...localFields[index],
          ...updates,
        };

        update(index, {
          ...updatedField,
          ...restrictFieldPosValues(updatedField),
        });
        triggerFieldsUpdate();
      }
    },
    [localFields, update, triggerFieldsUpdate, snapshotHistory],
  );

  const duplicateField = useCallback(
    (field: TLocalField): TLocalField => {
      snapshotHistory();

      const newField: TLocalField = {
        ...structuredClone(field),
        id: undefined,
        formId: nanoid(12),
        recipientId: field.recipientId,
        positionX: field.positionX + 3,
        positionY: field.positionY + 3,
      };

      append(newField);
      triggerFieldsUpdate();
      return newField;
    },
    [append, triggerFieldsUpdate, snapshotHistory],
  );

  const duplicateFieldToAllPages = useCallback(
    (field: TLocalField): TLocalField[] => {
      const totalPages = getPdfPagesCount();
      const newFields: TLocalField[] = [];

      if (totalPages < 1) {
        return newFields;
      }

      snapshotHistory();

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        if (pageNumber === field.page) {
          continue;
        }

        const newField: TLocalField = {
          ...structuredClone(field),
          id: undefined,
          formId: nanoid(12),
          page: pageNumber,
        };

        append(newField);
        newFields.push(newField);
      }

      triggerFieldsUpdate();
      return newFields;
    },
    [append, triggerFieldsUpdate, snapshotHistory],
  );

  const getFieldByFormId = useCallback(
    (formId: string): TLocalField | undefined => {
      return localFields.find((field) => field.formId === formId) as TLocalField | undefined;
    },
    [localFields],
  );

  const getFieldsByRecipient = useCallback(
    (recipientId: number): TLocalField[] => {
      return localFields.filter((field) => field.recipientId === recipientId);
    },
    [localFields],
  );

  const selectedRecipient = useMemo(() => {
    return envelope.recipients.find((recipient) => recipient.id === selectedRecipientId) || null;
  }, [selectedRecipientId, envelope.recipients]);

  const selectedField = useMemo(() => {
    return localFields.find((field) => field.formId === selectedFieldFormId);
  }, [selectedFieldFormId, localFields]);

  /**
   * Keep the selected field form ID in sync with the local fields.
   */
  useEffect(() => {
    const foundField = localFields.find((field) => field.formId === selectedFieldFormId);
    setSelectedFieldFormId(foundField?.formId ?? null);
  }, [selectedFieldFormId, localFields]);

  const setSelectedRecipient = (recipientId: number | null) => {
    const foundRecipient = envelope.recipients.find((recipient) => recipient.id === recipientId);

    setSelectedRecipientId(foundRecipient?.id ?? null);
  };

  const resetForm = (fields?: Field[]) => {
    historyPastRef.current = [];
    historyFutureRef.current = [];
    bumpHistory();
    form.reset(generateDefaultValues(fields));
  };

  /**
   * Restore the previous snapshot.
   *
   * The *current* state is pushed onto the redo stack so the user can go forward
   * again.  We call `form.reset` with the snapshot to atomically replace all
   * fields, then immediately flush to the server via `handleFieldsFlush` (bypassing
   * the normal debounce delay) so the canvas reflects the change without waiting.
   */
  const undo = useCallback(() => {
    if (historyPastRef.current.length === 0) {
      return;
    }

    const snapshot = historyPastRef.current[historyPastRef.current.length - 1];
    historyPastRef.current = historyPastRef.current.slice(0, -1);

    // Push current state onto redo stack.
    const currentSnapshot = structuredClone(form.getValues().fields) as TLocalField[];
    historyFutureRef.current = [...historyFutureRef.current, currentSnapshot];

    bumpHistory();

    form.reset({ fields: snapshot });
    void handleFieldsUpdate(snapshot);
    // Bypass the debounce — flush immediately so the save doesn't lag 2s.
    void handleFieldsFlush?.();
  }, [form, handleFieldsUpdate, handleFieldsFlush]);

  /**
   * Re-apply the next snapshot after an undo.
   */
  const redo = useCallback(() => {
    if (historyFutureRef.current.length === 0) {
      return;
    }

    const snapshot = historyFutureRef.current[historyFutureRef.current.length - 1];
    historyFutureRef.current = historyFutureRef.current.slice(0, -1);

    // Push current state onto undo stack.
    const currentSnapshot = structuredClone(form.getValues().fields) as TLocalField[];
    historyPastRef.current = [...historyPastRef.current.slice(-(MAX_HISTORY_SIZE - 1)), currentSnapshot];

    bumpHistory();

    form.reset({ fields: snapshot });
    void handleFieldsUpdate(snapshot);
    // Bypass the debounce — flush immediately so the save doesn't lag 2s.
    void handleFieldsFlush?.();
  }, [form, handleFieldsUpdate, handleFieldsFlush]);

  // Derive canUndo/canRedo reactively via historyVersion.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _historyVersion = historyVersion;
  const canUndo = historyPastRef.current.length > 0;
  const canRedo = historyFutureRef.current.length > 0;

  return {
    // Core state
    localFields,

    // Field operations
    addField,
    setFieldId,
    removeFieldsByFormId,
    updateFieldByFormId,
    duplicateField,
    duplicateFieldToAllPages,

    // Field utilities
    getFieldByFormId,
    getFieldsByRecipient,

    // Selected field
    selectedField,
    setSelectedField,

    // Selected recipient
    selectedRecipient,
    setSelectedRecipient,

    // History (undo / redo)
    undo,
    redo,
    canUndo,
    canRedo,

    resetForm,
  };
};

const restrictFieldPosValues = (field: Pick<TLocalField, 'positionX' | 'positionY' | 'width' | 'height'>) => {
  return {
    positionX: Math.max(0, Math.min(100, field.positionX)),
    positionY: Math.max(0, Math.min(100, field.positionY)),
    width: Math.max(0, Math.min(100, field.width)),
    height: Math.max(0, Math.min(100, field.height)),
  };
};

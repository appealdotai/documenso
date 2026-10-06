import { FieldType } from '@prisma/client';
import { z } from 'zod';

import { DEFAULT_SIGNATURE_TEXT_FONT_SIZE } from '../constants/pdf';

export const FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN = 'middle';
export const FIELD_DEFAULT_GENERIC_ALIGN = 'left';
export const FIELD_DEFAULT_LINE_HEIGHT = 1;
export const FIELD_DEFAULT_LETTER_SPACING = 0;

export const FIELD_MIN_LINE_HEIGHT = 1;
export const FIELD_MAX_LINE_HEIGHT = 10;

export const FIELD_MIN_LETTER_SPACING = 0;
export const FIELD_MAX_LETTER_SPACING = 100;

export const DEFAULT_FIELD_FONT_SIZE = 12;

export const DEFAULT_SIGNATURE_OVERFLOW_MODE = 'auto';
export const DEFAULT_DATE_OVERFLOW_MODE = 'auto';
export const DEFAULT_EMAIL_OVERFLOW_MODE = 'auto';
export const DEFAULT_TEXT_OVERFLOW_MODE = 'vertical';
export const DEFAULT_TEXT_VERTICAL_ALIGN = 'top';

/**
 * The overflow mode for a field.
 *
 * - 'auto': Will overflow horizontally if no room to wrap vertically.
 * - 'horizontal': Overflow horizontally, will not wrap at all.
 * - 'vertical': Overflow vertically, will wrap at the field width.
 * - 'crop': Crop the text to the field bounds, will not overflow at all.
 *
 * @default 'crop'
 */
export const ZFieldOverflowMode = z.enum(['auto', 'horizontal', 'vertical', 'crop']);
export type TFieldOverflowMode = z.infer<typeof ZFieldOverflowMode>;

/**
 * Resolves the overflow mode for a field.
 *
 * Returns 'crop' when undefined (the default for most fields).
 */
export const resolveFieldOverflowMode = (fieldMeta?: { overflow?: TFieldOverflowMode } | null): TFieldOverflowMode => {
  return fieldMeta?.overflow ?? 'crop';
};

/**
 * Grouped field types that use the same generic text rendering function.
 */
export type GenericTextFieldTypeMetas =
  | TInitialsFieldMeta
  | TNameFieldMeta
  | TEmailFieldMeta
  | TDateFieldMeta
  | TTextFieldMeta
  | TNumberFieldMeta;

const ZFieldMetaLineHeight = z.coerce
  .number()
  .min(FIELD_MIN_LINE_HEIGHT)
  .max(FIELD_MAX_LINE_HEIGHT)
  .describe('The line height of the text');
const ZFieldMetaLetterSpacing = z.coerce
  .number()
  .min(FIELD_MIN_LETTER_SPACING)
  .max(FIELD_MAX_LETTER_SPACING)
  .describe('The spacing between each character');
const ZFieldMetaVerticalAlign = z.enum(['top', 'middle', 'bottom']).describe('The vertical alignment of the text');

export const ZBaseFieldMeta = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  backgroundVisible: z
    .boolean()
    .optional()
    .describe('Whether the field background box is painted. Defaults to visible.'),
  fontSize: z.number().min(8).max(96).default(DEFAULT_FIELD_FONT_SIZE).optional(),
  overflow: ZFieldOverflowMode.optional(),
});

export type TBaseFieldMeta = z.infer<typeof ZBaseFieldMeta>;

export const ZFieldTextAlignSchema = z.enum(['left', 'center', 'right']);

export type TFieldTextAlignSchema = z.infer<typeof ZFieldTextAlignSchema>;

export const ZInitialsFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('initials'),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TInitialsFieldMeta = z.infer<typeof ZInitialsFieldMeta>;

export const ZNameFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('name'),
  textAlign: ZFieldTextAlignSchema.optional(),
});

export type TNameFieldMeta = z.infer<typeof ZNameFieldMeta>;

export const ZEmailFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('email'),
  textAlign: ZFieldTextAlignSchema.optional(),
  overflow: ZFieldOverflowMode.optional().default(DEFAULT_EMAIL_OVERFLOW_MODE),
});

export type TEmailFieldMeta = z.infer<typeof ZEmailFieldMeta>;

export const ZDateFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('date'),
  value: z.string().optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
  overflow: ZFieldOverflowMode.optional().default(DEFAULT_DATE_OVERFLOW_MODE),
});

export type TDateFieldMeta = z.infer<typeof ZDateFieldMeta>;

export const ZTextFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('text'),
  text: z.string().optional(),
  characterLimit: z.coerce.number({ invalid_type_error: 'Value must be a number' }).min(0).optional(),
  textAlign: ZFieldTextAlignSchema.optional(),
  lineHeight: ZFieldMetaLineHeight.nullish(),
  letterSpacing: ZFieldMetaLetterSpacing.nullish(),
  verticalAlign: ZFieldMetaVerticalAlign.nullish(),
  overflow: ZFieldOverflowMode.optional(),
});

export type TTextFieldMeta = z.infer<typeof ZTextFieldMeta>;

export const ZNumberFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('number'),
  numberFormat: z.string().nullish(),
  value: z.string().optional(),
  minValue: z.coerce.number().nullish(),
  maxValue: z.coerce.number().nullish(),
  textAlign: ZFieldTextAlignSchema.optional(),
  lineHeight: ZFieldMetaLineHeight.nullish(),
  letterSpacing: ZFieldMetaLetterSpacing.nullish(),
  verticalAlign: ZFieldMetaVerticalAlign.nullish(),
});

export type TNumberFieldMeta = z.infer<typeof ZNumberFieldMeta>;

export const ZRadioFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('radio'),
  values: z
    .array(
      z.object({
        id: z.number(),
        checked: z.boolean(),
        value: z.string(),
      }),
    )
    .optional(),
  direction: z.enum(['vertical', 'horizontal']).optional().default('vertical'),
});

export type TRadioFieldMeta = z.infer<typeof ZRadioFieldMeta>;

export const ZCheckboxFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('checkbox'),
  values: z
    .array(
      z.object({
        id: z.number(),
        checked: z.boolean(),
        value: z.string(),
      }),
    )
    .optional(),
  validationRule: z.string().optional(),
  validationLength: z.number().optional(),
  direction: z.enum(['vertical', 'horizontal']).optional().default('vertical'),
});

export type TCheckboxFieldMeta = z.infer<typeof ZCheckboxFieldMeta>;

export const ZDropdownFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('dropdown'),
  values: z.array(z.object({ value: z.string() })).optional(),
  defaultValue: z.string().optional(),
});

export type TDropdownFieldMeta = z.infer<typeof ZDropdownFieldMeta>;

export const ZSignatureFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('signature'),
  overflow: ZFieldOverflowMode.optional().default(DEFAULT_SIGNATURE_OVERFLOW_MODE),
});

export type TSignatureFieldMeta = z.infer<typeof ZSignatureFieldMeta>;

export const ZShapeType = z.enum(['rectangle', 'ellipse', 'triangle', 'line', 'arrow']);

export type TShapeType = z.infer<typeof ZShapeType>;

export const ZBorderStyle = z.enum(['solid', 'dashed', 'none']);

export type TBorderStyle = z.infer<typeof ZBorderStyle>;

export const SHAPE_FILL_PRESETS = ['#000000', '#EF4444', '#FACC15', '#22C55E', '#3B82F6'] as const;

export const DEFAULT_SHAPE_BORDER_COLOR = '#000000';
export const DEFAULT_SHAPE_BORDER_WIDTH = 2;
export const MAX_SHAPE_BORDER_WIDTH = 20;
export const MAX_SHAPE_CORNER_RADIUS = 100;

const ZShapeHexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Must be a hex color (#RRGGBB)')
  .describe('A hex color (#RRGGBB)');

/**
 * Normalizes shape meta written by the previous iteration of the feature
 * (`shapeKind`, `transparent` / 8-digit fill, wider border widths) to the
 * current schema so already-saved shapes keep loading with sensible values.
 */
const normalizeLegacyShapeMeta = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }

  const meta = { ...(value as Record<string, unknown>) };

  if (meta.shape === undefined && typeof meta.shapeKind === 'string') {
    meta.shape = meta.shapeKind;
  }

  delete meta.shapeKind;

  if (meta.fillColor === 'transparent') {
    meta.fillColor = null;
  }

  if (typeof meta.fillColor === 'string' && /^#[0-9a-fA-F]{8}$/.test(meta.fillColor)) {
    meta.fillColor = meta.fillColor.slice(0, 7);
  }

  if (typeof meta.borderColor === 'string' && /^#[0-9a-fA-F]{8}$/.test(meta.borderColor)) {
    meta.borderColor = meta.borderColor.slice(0, 7);
  }

  return meta;
};

export const ZShapeFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal('shape'),
  shape: ZShapeType.default('rectangle'),
  fillColor: ZShapeHexColorSchema.nullable().default(null),
  fillOpacity: z.number().min(0).max(1).default(1),
  borderColor: ZShapeHexColorSchema.default(DEFAULT_SHAPE_BORDER_COLOR),
  borderWidth: z.number().int().min(0).max(MAX_SHAPE_BORDER_WIDTH).default(DEFAULT_SHAPE_BORDER_WIDTH),
  borderStyle: ZBorderStyle.default('solid'),
  cornerRadius: z.number().int().min(0).max(MAX_SHAPE_CORNER_RADIUS).default(0),
});

export type TShapeFieldMeta = z.infer<typeof ZShapeFieldMeta>;

/**
 * Lenient shape parser for persisted data. Normalizes meta written by the
 * previous iteration (`shapeKind`, `transparent` / 8-digit colors) before
 * validating so already-saved shapes keep loading with sensible values.
 */
export const ZShapeFieldMetaLenientSchema = z.preprocess(normalizeLegacyShapeMeta, ZShapeFieldMeta);

/**
 * Whether the field background box should be painted. Defaults to visible
 * when the flag is absent so existing fields keep their appearance.
 */
export const isFieldBackgroundVisible = (meta: unknown): boolean => {
  if (!meta || typeof meta !== 'object' || !('backgroundVisible' in meta)) {
    return true;
  }

  return meta.backgroundVisible !== false;
};

/**
 * Read the optional `readOnly` flag from any field meta. Shape meta does not
 * carry the flag, so plain property access does not typecheck on the union.
 */
export const getFieldMetaReadOnly = (meta: unknown): boolean => {
  return !!meta && typeof meta === 'object' && 'readOnly' in meta && meta.readOnly === true;
};

/**
 * Read the optional `required` flag from any field meta. Returns undefined
 * when the meta type does not carry the flag (e.g. shapes).
 */
export const getFieldMetaRequired = (meta: unknown): boolean | undefined => {
  if (!meta || typeof meta !== 'object' || !('required' in meta)) {
    return undefined;
  }

  return meta.required === true ? true : meta.required === false ? false : undefined;
};

export const ZFieldMetaNotOptionalSchema = z.discriminatedUnion('type', [
  ZSignatureFieldMeta,
  ZInitialsFieldMeta,
  ZNameFieldMeta,
  ZEmailFieldMeta,
  ZDateFieldMeta,
  ZTextFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZShapeFieldMeta,
]);

export type TFieldMetaNotOptionalSchema = z.infer<typeof ZFieldMetaNotOptionalSchema>;

export const ZFieldMetaPrefillFieldsSchema = z
  .object({
    id: z.number(),
  })
  .and(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('text'),
        label: z.string().optional(),
        placeholder: z.string().optional(),
        value: z.string().optional(),
      }),
      z.object({
        type: z.literal('number'),
        label: z.string().optional(),
        placeholder: z.string().optional(),
        value: z.string().optional(),
      }),
      z.object({
        type: z.literal('radio'),
        label: z.string().optional(),
        value: z.string().optional(),
      }),
      z.object({
        type: z.literal('checkbox'),
        label: z.string().optional(),
        value: z.array(z.string()).optional(),
      }),
      z.object({
        type: z.literal('dropdown'),
        label: z.string().optional(),
        value: z.string().optional(),
      }),
      z.object({
        type: z.literal('date'),
        value: z.string().optional(),
      }),
    ]),
  );

export type TFieldMetaPrefillFieldsSchema = z.infer<typeof ZFieldMetaPrefillFieldsSchema>;

export const ZFieldMetaSchema = z.preprocess(
  normalizeLegacyShapeMeta,
  z
    .union([
      // Handles an empty object being provided as fieldMeta.
      z
        .object({})
        .strict()
        .transform(() => undefined),
      ZFieldMetaNotOptionalSchema,
    ])
    .optional(),
);

export type TFieldMetaSchema = z.infer<typeof ZFieldMetaSchema>;

/**
 * Normalizes a `{ type, fieldMeta }` wrapper's legacy shape meta, if any.
 */
export const normalizeLegacyShapeFieldWrapper = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }

  const wrapper = value as Record<string, unknown>;

  if (wrapper.fieldMeta === undefined) {
    return value;
  }

  return {
    ...wrapper,
    fieldMeta: normalizeLegacyShapeMeta(wrapper.fieldMeta),
  };
};

export const ZFieldAndMetaSchema = z.preprocess(
  normalizeLegacyShapeFieldWrapper,
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal(FieldType.SIGNATURE),
      fieldMeta: ZSignatureFieldMeta.optional(),
    }),
    z.object({
      type: z.literal(FieldType.FREE_SIGNATURE),
      fieldMeta: z.undefined(),
    }),
    z.object({
      type: z.literal(FieldType.INITIALS),
      fieldMeta: ZInitialsFieldMeta.optional(),
    }),
    z.object({
      type: z.literal(FieldType.NAME),
      fieldMeta: ZNameFieldMeta.optional(),
    }),
    z.object({
      type: z.literal(FieldType.EMAIL),
      fieldMeta: ZEmailFieldMeta.optional(),
    }),
    z.object({
      type: z.literal(FieldType.DATE),
      fieldMeta: ZDateFieldMeta.optional(),
    }),
    z.object({
      type: z.literal(FieldType.TEXT),
      fieldMeta: ZTextFieldMeta.optional(),
    }),
    z.object({
      type: z.literal(FieldType.NUMBER),
      fieldMeta: ZNumberFieldMeta.optional(),
    }),
    z.object({
      type: z.literal(FieldType.RADIO),
      fieldMeta: ZRadioFieldMeta.optional(),
    }),
    z.object({
      type: z.literal(FieldType.CHECKBOX),
      fieldMeta: ZCheckboxFieldMeta.optional(),
    }),
    z.object({
      type: z.literal(FieldType.DROPDOWN),
      fieldMeta: ZDropdownFieldMeta.optional(),
    }),
    z.object({
      type: z.literal(FieldType.SHAPE),
      fieldMeta: ZShapeFieldMeta.optional(),
    }),
  ]),
);

export type TFieldAndMeta = z.infer<typeof ZFieldAndMetaSchema>;

export const FIELD_DATE_META_DEFAULT_VALUES: TDateFieldMeta = {
  type: 'date',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
  overflow: DEFAULT_DATE_OVERFLOW_MODE,
  value: '',
  readOnly: false,
};

export const FIELD_TEXT_META_DEFAULT_VALUES: TTextFieldMeta = {
  type: 'text',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
  overflow: DEFAULT_TEXT_OVERFLOW_MODE,
  verticalAlign: DEFAULT_TEXT_VERTICAL_ALIGN,
  label: '',
  placeholder: '',
  text: '',
  required: false,
  readOnly: false,
};

export const FIELD_NUMBER_META_DEFAULT_VALUES: TNumberFieldMeta = {
  type: 'number',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
  label: '',
  placeholder: '',
  required: false,
  readOnly: false,
};

export const FIELD_INITIALS_META_DEFAULT_VALUES: TInitialsFieldMeta = {
  type: 'initials',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
};

export const FIELD_NAME_META_DEFAULT_VALUES: TNameFieldMeta = {
  type: 'name',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
};

export const FIELD_EMAIL_META_DEFAULT_VALUES: TEmailFieldMeta = {
  type: 'email',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
  overflow: DEFAULT_EMAIL_OVERFLOW_MODE,
};

export const FIELD_RADIO_META_DEFAULT_VALUES: TRadioFieldMeta = {
  type: 'radio',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  values: [{ id: 1, checked: false, value: '' }],
  required: false,
  readOnly: false,
  direction: 'vertical',
};

export const FIELD_CHECKBOX_META_DEFAULT_VALUES: TCheckboxFieldMeta = {
  type: 'checkbox',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  values: [{ id: 1, checked: false, value: '' }],
  validationRule: '',
  validationLength: 0,
  required: false,
  readOnly: false,
  direction: 'vertical',
};

export const FIELD_DROPDOWN_META_DEFAULT_VALUES: TDropdownFieldMeta = {
  type: 'dropdown',
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  values: [{ value: 'Option 1' }],
  defaultValue: '',
  required: false,
  readOnly: false,
};

export const FIELD_SIGNATURE_META_DEFAULT_VALUES: TSignatureFieldMeta = {
  type: 'signature',
  fontSize: DEFAULT_SIGNATURE_TEXT_FONT_SIZE,
  overflow: DEFAULT_SIGNATURE_OVERFLOW_MODE,
};

export const FIELD_SHAPE_META_DEFAULT_VALUES: TShapeFieldMeta = {
  type: 'shape',
  shape: 'rectangle',
  fillColor: null,
  fillOpacity: 1,
  borderColor: DEFAULT_SHAPE_BORDER_COLOR,
  borderWidth: DEFAULT_SHAPE_BORDER_WIDTH,
  borderStyle: 'solid',
  cornerRadius: 0,
};

export const FIELD_META_DEFAULT_VALUES: Record<FieldType, TFieldMetaSchema> = {
  [FieldType.SIGNATURE]: FIELD_SIGNATURE_META_DEFAULT_VALUES,
  [FieldType.FREE_SIGNATURE]: undefined,
  [FieldType.INITIALS]: FIELD_INITIALS_META_DEFAULT_VALUES,
  [FieldType.NAME]: FIELD_NAME_META_DEFAULT_VALUES,
  [FieldType.EMAIL]: FIELD_EMAIL_META_DEFAULT_VALUES,
  [FieldType.DATE]: FIELD_DATE_META_DEFAULT_VALUES,
  [FieldType.TEXT]: FIELD_TEXT_META_DEFAULT_VALUES,
  [FieldType.NUMBER]: FIELD_NUMBER_META_DEFAULT_VALUES,
  [FieldType.RADIO]: FIELD_RADIO_META_DEFAULT_VALUES,
  [FieldType.CHECKBOX]: FIELD_CHECKBOX_META_DEFAULT_VALUES,
  [FieldType.DROPDOWN]: FIELD_DROPDOWN_META_DEFAULT_VALUES,
  [FieldType.SHAPE]: FIELD_SHAPE_META_DEFAULT_VALUES,
} as const;

export const ZEnvelopeFieldAndMetaSchema = z.preprocess(
  normalizeLegacyShapeFieldWrapper,
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal(FieldType.SIGNATURE),
      fieldMeta: ZSignatureFieldMeta.optional().default(FIELD_SIGNATURE_META_DEFAULT_VALUES),
    }),
    z.object({
      type: z.literal(FieldType.FREE_SIGNATURE),
      fieldMeta: z.undefined(),
    }),
    z.object({
      type: z.literal(FieldType.INITIALS),
      fieldMeta: ZInitialsFieldMeta.optional().default(FIELD_INITIALS_META_DEFAULT_VALUES),
    }),
    z.object({
      type: z.literal(FieldType.NAME),
      fieldMeta: ZNameFieldMeta.optional().default(FIELD_NAME_META_DEFAULT_VALUES),
    }),
    z.object({
      type: z.literal(FieldType.EMAIL),
      fieldMeta: ZEmailFieldMeta.optional().default(FIELD_EMAIL_META_DEFAULT_VALUES),
    }),
    z.object({
      type: z.literal(FieldType.DATE),
      fieldMeta: ZDateFieldMeta.optional().default(FIELD_DATE_META_DEFAULT_VALUES),
    }),
    z.object({
      type: z.literal(FieldType.TEXT),
      fieldMeta: ZTextFieldMeta.optional().default(FIELD_TEXT_META_DEFAULT_VALUES),
    }),
    z.object({
      type: z.literal(FieldType.NUMBER),
      fieldMeta: ZNumberFieldMeta.optional().default(FIELD_NUMBER_META_DEFAULT_VALUES),
    }),
    z.object({
      type: z.literal(FieldType.RADIO),
      fieldMeta: ZRadioFieldMeta.optional().default(FIELD_RADIO_META_DEFAULT_VALUES),
    }),
    z.object({
      type: z.literal(FieldType.CHECKBOX),
      fieldMeta: ZCheckboxFieldMeta.optional().default(FIELD_CHECKBOX_META_DEFAULT_VALUES),
    }),
    z.object({
      type: z.literal(FieldType.DROPDOWN),
      fieldMeta: ZDropdownFieldMeta.optional().default(FIELD_DROPDOWN_META_DEFAULT_VALUES),
    }),
    z.object({
      type: z.literal(FieldType.SHAPE),
      fieldMeta: ZShapeFieldMeta.optional().default(FIELD_SHAPE_META_DEFAULT_VALUES),
    }),
  ]),
);

export type TEnvelopeFieldAndMeta = z.infer<typeof ZEnvelopeFieldAndMetaSchema>;

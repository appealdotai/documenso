import { type Field, FieldType } from '@prisma/client';

import { getFieldMetaRequired, ZFieldMetaSchema } from '../types/field-meta';

// Currently it seems that the majority of fields have advanced fields for font reasons.
// This array should only contain fields that have an optional setting in the fieldMeta.
export const ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING: FieldType[] = [
  FieldType.SIGNATURE,
  FieldType.NUMBER,
  FieldType.TEXT,
  FieldType.DATE,
  FieldType.DROPDOWN,
  FieldType.RADIO,
  FieldType.CHECKBOX,
  // Decorative shapes are never required: they are sealed as-is and need no
  // recipient interaction. Listing here makes `isRequiredField` resolve them
  // as optional so progress bars and completion gates ignore them.
  FieldType.SHAPE,
];

/**
 * Whether a field is required to be inserted.
 */
export const isRequiredField = (field: Field) => {
  // Decorative shapes are never required: they are sealed as-is and need no
  // recipient interaction.
  if (field.type === FieldType.SHAPE) {
    return false;
  }

  // All fields without the optional metadata are assumed to be required.
  if (!ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING.includes(field.type)) {
    return true;
  }

  // Not sure why fieldMeta can be optional for advanced fields, but it is.
  // Therefore we must assume if there is no fieldMeta, then the field is optional.
  if (!field.fieldMeta) {
    return field.type === FieldType.SIGNATURE;
  }

  const parsedData = ZFieldMetaSchema.safeParse(field.fieldMeta);

  // If it fails, assume the field is optional.
  // This needs to be logged somewhere.
  if (!parsedData.success) {
    return field.type === FieldType.SIGNATURE;
  }

  if (field.type === FieldType.SIGNATURE) {
    return getFieldMetaRequired(parsedData.data) !== false;
  }

  return getFieldMetaRequired(parsedData.data) === true;
};

/**
 * Whether the provided field is required and not inserted.
 */
export const isFieldUnsignedAndRequired = (field: Field) => isRequiredField(field) && !field.inserted;

/**
 * Whether the provided fields contains a field that is required to be inserted.
 */
export const fieldsContainUnsignedRequiredField = (fields: Field[]) => fields.some(isFieldUnsignedAndRequired);

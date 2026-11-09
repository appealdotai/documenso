import '../../server-only/konva/skia-backend';

import { FieldType } from '@prisma/client';
import Konva from 'konva';
import { describe, expect, it } from 'vitest';

import { konvaTextFontFamily, resolveFieldFontFamily } from './field-generic-items';
import type { FieldToRender } from './field-renderer';
import { renderGenericTextFieldElement } from './render-generic-text-field';

const createTestField = (overrides: Partial<FieldToRender> = {}): FieldToRender => ({
  renderId: '1',
  envelopeItemId: 'item-1',
  recipientId: 1,
  type: FieldType.TEXT,
  page: 1,
  customText: '',
  inserted: false,
  width: 20,
  height: 10,
  positionX: 10,
  positionY: 10,
  fieldMeta: {
    type: 'text',
    text: 'Hello',
    fontFamily: 'caveat',
    lineHeight: 1.5,
    letterSpacing: 2,
  },
  ...overrides,
});

const renderTextField = (field: FieldToRender): Konva.Text => {
  const layer = new Konva.Layer();

  renderGenericTextFieldElement(field, {
    pageLayer: layer,
    pageWidth: 1000,
    pageHeight: 1000,
    mode: 'edit',
    scale: 1,
    translations: null,
  });

  return layer.findOne('#1-text') as Konva.Text;
};

describe('renderGenericTextFieldElement', () => {
  it('renders text with the selected font family, line height, and letter spacing', () => {
    const textNode = renderTextField(createTestField());

    expect(textNode.fontFamily()).toBe(resolveFieldFontFamily('caveat'));
    expect(textNode.lineHeight()).toBe(1.5);
    expect(textNode.letterSpacing()).toBe(2);
  });

  it('falls back to the default font family when none is selected', () => {
    const textNode = renderTextField(
      createTestField({
        fieldMeta: {
          type: 'text',
          text: 'Hello',
        },
      }),
    );

    expect(textNode.fontFamily()).toBe(konvaTextFontFamily);
  });

  it('renders bold, italic, and underline styles', () => {
    const textNode = renderTextField(
      createTestField({
        fieldMeta: {
          type: 'text',
          text: 'Hello',
          fontFamily: 'montserrat',
          bold: true,
          italic: true,
          underline: true,
        },
      }),
    );

    expect(textNode.fontFamily()).toBe(resolveFieldFontFamily('montserrat'));
    expect(textNode.fontStyle()).toBe('bold italic');
    expect(textNode.textDecoration()).toBe('underline');
  });
});

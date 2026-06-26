import '../../server-only/konva/skia-backend';

import { FieldType } from '@prisma/client';
import Konva from 'konva';
import { describe, expect, it } from 'vitest';

import type { FieldToRender } from './field-renderer';
import { renderSignatureFieldElement } from './render-signature-field';

const createTestField = (overrides: Partial<FieldToRender> = {}): FieldToRender => ({
  renderId: '1',
  envelopeItemId: 'item-1',
  recipientId: 1,
  type: FieldType.SIGNATURE,
  page: 1,
  customText: '',
  inserted: false,
  width: 20,
  height: 10,
  positionX: 10,
  positionY: 10,
  ...overrides,
});

const renderSignatureField = (field: FieldToRender, mode: 'sign' | 'export') => {
  const layer = new Konva.Layer();

  renderSignatureFieldElement(field, {
    pageLayer: layer,
    pageWidth: 1000,
    pageHeight: 1000,
    mode,
    scale: 1,
    translations: null,
  });

  return layer.findOne('#1-text') as Konva.Text | undefined;
};

describe('renderSignatureFieldElement', () => {
  it('renders blank text for non-inserted signature fields in export mode', () => {
    const textNode = renderSignatureField(createTestField({ inserted: false }), 'export');

    expect(textNode?.text()).toBe('');
  });

  it('renders typed signature for inserted fields in export mode', () => {
    const textNode = renderSignatureField(
      createTestField({
        inserted: true,
        signature: {
          typedSignature: 'Jane Doe',
          signatureImageAsBase64: null,
        },
      }),
      'export',
    );

    expect(textNode?.text()).toBe('Jane Doe');
  });

  it('renders the field type placeholder in sign mode for non-inserted fields', () => {
    const textNode = renderSignatureField(createTestField({ inserted: false }), 'sign');

    expect(textNode?.text()).toBe(FieldType.SIGNATURE);
  });
});

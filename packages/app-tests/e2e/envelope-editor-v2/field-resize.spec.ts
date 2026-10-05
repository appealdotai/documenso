import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { expect, type Page, test } from '@playwright/test';
import { FieldType } from '@prisma/client';
import type Konva from 'konva';

import {
  clickAddMyselfButton,
  clickEnvelopeEditorStep,
  getEnvelopeEditorSettingsTrigger,
  openDocumentEnvelopeEditor,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';
import { getKonvaTransformerNodeCountForPage } from '../fixtures/konva';

const LONG_TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua';

const updateExternalId = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await getEnvelopeEditorSettingsTrigger(surface.root).click();
  await expect(surface.root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
  await surface.root.locator('input[name="externalId"]').fill(externalId);
  await surface.root.getByRole('button', { name: 'Update' }).click();
  await expectToastTextToBeVisible(surface.root, 'Envelope updated');
  await surface.root.getByTestId('toast-close').click();
};

const placeFieldOnPdf = async (root: Page, fieldName: string, position: { x: number; y: number }) => {
  await root.getByRole('button', { name: fieldName, exact: true }).click();

  const canvas = root.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible();
  // Use force:true to bypass stacked Konva layer canvases that may intercept
  // pointer events at the click position.
  await canvas.click({ position, force: true });
};

/**
 * Returns the CSS-pixel rect of the attached Konva transformer box. This is
 * where the resize anchors actually live, which for text fields with overflow
 * content can extend well beyond the field bounds.
 */
const getTransformerCssRect = async (root: Page, pageNumber: number) => {
  await root.locator('.konva-container canvas').first().waitFor({ state: 'visible' });

  return await root.evaluate(
    ({ pageNumber }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva = (window as unknown as { Konva: typeof Konva }).Konva;
      const canvas = document.querySelector('.konva-container canvas');

      if (!canvas) {
        throw new Error('Canvas element not found.');
      }

      const stage = konva.stages.find((s) => s.attrs.id === `page-${pageNumber}`);

      if (!stage) {
        throw new Error(`Stage for page ${pageNumber} not found.`);
      }

      const transformer = stage.find('Transformer')[0];

      if (!transformer) {
        throw new Error('No transformer attached.');
      }

      const box = canvas.getBoundingClientRect();
      const nodeRect = transformer.getClientRect({ skipStroke: true, skipShadow: true });

      // Map stage coordinates to CSS pixels via the canvas element size.
      const factorX = box.width / stage.width();
      const factorY = box.height / stage.height();

      return {
        x: box.x + nodeRect.x * factorX,
        y: box.y + nodeRect.y * factorY,
        width: nodeRect.width * factorX,
        height: nodeRect.height * factorY,
      };
    },
    { pageNumber },
  );
};

const dragBottomRightHandle = async (
  root: Page,
  rect: { x: number; y: number; width: number; height: number },
  deltaX: number,
  deltaY: number,
) => {
  // Bottom-right transformer anchor sits at the rect corner. Alt disables
  // snap guides so the drag distance is deterministic.
  await root.keyboard.down('Alt');
  await root.mouse.move(rect.x + rect.width - 2, rect.y + rect.height - 2);
  await root.mouse.down();
  await root.mouse.move(rect.x + rect.width - 2 + deltaX / 2, rect.y + rect.height - 2 + deltaY / 2, { steps: 5 });
  await root.mouse.move(rect.x + rect.width - 2 + deltaX, rect.y + rect.height - 2 + deltaY, { steps: 5 });
  await root.mouse.up();
  await root.keyboard.up('Alt');
};

const pollFieldFromDb = async (envelopeId: string, type: FieldType) => {
  let field = null as null | Awaited<ReturnType<typeof readFieldFromDb>>;

  await expect
    .poll(
      async () => {
        const count = await prisma.field.count({ where: { envelopeId, type } });

        if (count === 0) {
          return 0;
        }

        field = await readFieldFromDb(envelopeId, type);

        return count;
      },
      { timeout: 20000 },
    )
    .toBeGreaterThan(0);

  if (!field) {
    throw new Error('Field was not persisted.');
  }

  return field;
};

const readFieldFromDb = async (envelopeId: string, type: FieldType) => {
  const field = await prisma.field.findFirstOrThrow({
    where: {
      envelopeId,
      type,
    },
    orderBy: {
      id: 'desc',
    },
  });

  return {
    width: Number(field.width),
    height: Number(field.height),
    positionX: Number(field.positionX),
    positionY: Number(field.positionY),
  };
};

test('resizing a text field with horizontal overflow commits the dragged size, not the page size', async ({ page }) => {
  const surface: TEnvelopeEditorSurface = await openDocumentEnvelopeEditor(page);
  const externalId = `e2e-resize-text-${nanoid()}`;
  await updateExternalId(surface, externalId);

  if (!surface.envelopeId) {
    throw new Error('Expected a document envelope id.');
  }

  const envelopeId = surface.envelopeId;

  await clickAddMyselfButton(page);
  await clickEnvelopeEditorStep(page, 'addFields');

  const root = surface.root;
  await placeFieldOnPdf(root, 'Text', { x: 150, y: 150 });

  // Give the field content + horizontal overflow so the text node extends to
  // the page edge. Regression: the resize commit used to adopt that size.
  await root.getByTestId('field-form-text').fill(LONG_TEXT);
  await root.getByTestId('field-form-overflow').click();
  await root.getByRole('option', { name: 'Horizontal', exact: true }).click();

  const before = await pollFieldFromDb(envelopeId, FieldType.TEXT);

  // The placed field must be selected with the transformer attached.
  await expect.poll(() => getKonvaTransformerNodeCountForPage(root, 1), { timeout: 10000 }).toBe(1);

  // Drag from the transformer box corner, where the anchors actually live.
  // With horizontal overflow content the box extends toward the page edge.
  const transformerBox = await getTransformerCssRect(root, 1);
  await dragBottomRightHandle(root, transformerBox, 300, 0);

  // Poll until autosave persists the field, then the resize.
  await expect
    .poll(async () => prisma.field.count({ where: { envelopeId, type: FieldType.TEXT } }), {
      timeout: 20000,
    })
    .toBeGreaterThan(0);

  const initialWidth = Number((await readFieldFromDb(envelopeId, FieldType.TEXT)).width);

  await expect
    .poll(async () => Number((await readFieldFromDb(envelopeId, FieldType.TEXT)).width), {
      timeout: 20000,
    })
    .toBeGreaterThan(initialWidth + 3);

  const dbField = await readFieldFromDb(envelopeId, FieldType.TEXT);

  // Dragged ~120css px on a ~800css px page ≈ +15 percentage points.
  expect(dbField.width).toBeGreaterThan(10);
  expect(dbField.width).toBeLessThan(70);

  // Height must be untouched by a horizontal drag.
  const dbHeight = dbField.height;
  expect(dbHeight).toBeGreaterThan(0);
  expect(dbHeight).toBeLessThan(40);
});

test('resizing a shape commits the dragged size', async ({ page }) => {
  const surface: TEnvelopeEditorSurface = await openDocumentEnvelopeEditor(page);
  const externalId = `e2e-resize-shape-${nanoid()}`;
  await updateExternalId(surface, externalId);

  if (!surface.envelopeId) {
    throw new Error('Expected a document envelope id.');
  }

  const envelopeId = surface.envelopeId;

  await clickAddMyselfButton(page);
  await clickEnvelopeEditorStep(page, 'addFields');

  const root = surface.root;
  await placeFieldOnPdf(root, 'Shape', { x: 400, y: 400 });

  const initial = await pollFieldFromDb(envelopeId, FieldType.SHAPE);

  // The placed shape must be selected with the transformer attached.
  await expect.poll(() => getKonvaTransformerNodeCountForPage(root, 1), { timeout: 10000 }).toBe(1);

  // Drag from the transformer box corner, where the anchors actually live.
  const shapeBox = await getTransformerCssRect(root, 1);
  await dragBottomRightHandle(root, shapeBox, 100, 60);

  await expect
    .poll(async () => Number((await readFieldFromDb(envelopeId, FieldType.SHAPE)).width), {
      timeout: 20000,
    })
    .toBeGreaterThan(initial.width + 3);

  const dbField = await readFieldFromDb(envelopeId, FieldType.SHAPE);

  // Dragged wider and taller — must track the drag, not jump or stall.
  expect(dbField.width).toBeGreaterThan(initial.width + 3);
  expect(dbField.width).toBeLessThan(70);
  expect(dbField.height).toBeGreaterThan(initial.height + 1);
  expect(dbField.height).toBeLessThan(70);
});

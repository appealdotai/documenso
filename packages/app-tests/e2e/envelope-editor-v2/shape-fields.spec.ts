import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { getEnvelopeItemPdfUrl } from '@documenso/lib/utils/envelope-download';
import { prisma } from '@documenso/prisma';
import { createCanvas } from '@napi-rs/canvas';
import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType } from '@prisma/client';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import { apiSeedDraftDocument, apiSeedPendingDocument, apiSeedTemplate } from '../fixtures/api-seeds';
import { apiSignin } from '../fixtures/authentication';
import { clickEnvelopeEditorStep } from '../fixtures/envelope-editor';
import { getKonvaFieldGroupsForPage } from '../fixtures/konva';

const PDF_PAGE_SELECTOR = 'img[data-page-number]';

const requestMetadata: ApiRequestMetadata = {
  requestMetadata: {},
  source: 'app',
  auth: null,
};

const SHAPE_FIELD_META = {
  type: 'shape',
  shape: 'rectangle',
  fillColor: '#FF0000',
  fillOpacity: 1,
  borderColor: '#FF0000',
  borderWidth: 0,
  borderStyle: 'none',
  cornerRadius: 0,
};

const TEXT_FIELD_META = {
  type: 'text',
  label: 'Overlapping text',
  text: 'Visible text',
  readOnly: false,
  required: false,
  fontSize: 18,
  textAlign: 'left',
  fontFamily: 'noto-sans',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  lineHeight: 1.2,
  letterSpacing: 0,
};

const getPdfPixel = async ({
  pdfBytes,
  pageNumber,
  relativeX,
  relativeY,
}: {
  pdfBytes: Uint8Array;
  pageNumber: number;
  relativeX: number;
  relativeY: number;
}) => {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;

  try {
    const pdfPage = await pdf.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const canvasContext = canvas.getContext('2d');

    if (!canvasContext) {
      throw new Error('Unable to create PDF canvas context');
    }

    await pdfPage.render({
      canvas: canvas as never,
      canvasContext: canvasContext as never,
      viewport,
    }).promise;

    const { data } = canvasContext.getImageData(
      Math.floor(viewport.width * relativeX),
      Math.floor(viewport.height * relativeY),
      1,
      1,
    );

    return Array.from(data);
  } finally {
    await pdf.destroy();
  }
};

test('template conversion marks decorative shapes as inserted and preserves stacking order', async ({ request }) => {
  const {
    envelope: template,
    user,
    team,
  } = await apiSeedTemplate(request, {
    title: `[TEST] Shape template ${Date.now()}`,
    recipients: [{ email: `shape-template-${Date.now()}@test.documenso.com`, name: 'Shape Template Recipient' }],
    fieldsPerRecipient: [
      [
        {
          type: FieldType.SHAPE,
          page: 1,
          positionX: 20,
          positionY: 20,
          width: 30,
          height: 20,
          fieldMeta: SHAPE_FIELD_META,
        },
        {
          type: FieldType.TEXT,
          page: 1,
          positionX: 20,
          positionY: 20,
          width: 30,
          height: 10,
          fieldMeta: TEXT_FIELD_META,
        },
      ],
    ],
  });

  const templateRecord = await prisma.envelope.findUniqueOrThrow({ where: { id: template.id } });
  const templateFields = await prisma.field.findMany({ where: { envelopeId: template.id } });

  const templateShape = templateFields.find((field) => field.type === FieldType.SHAPE);
  const templateText = templateFields.find((field) => field.type === FieldType.TEXT);

  expect(templateShape).toBeDefined();
  expect(templateText).toBeDefined();

  if (!templateShape || !templateText) {
    throw new Error('Template fields were not created');
  }

  await prisma.field.updateMany({
    where: { envelopeId: template.id },
    data: { inserted: false },
  });

  await prisma.field.update({ where: { id: templateShape.id }, data: { order: 7 } });
  await prisma.field.update({ where: { id: templateText.id }, data: { order: 2 } });

  const createdDocument = await createDocumentFromTemplate({
    id: {
      type: 'templateId',
      id: mapSecondaryIdToTemplateId(templateRecord.secondaryId),
    },
    userId: user.id,
    teamId: team.id,
    recipients: template.recipients.map((recipient) => ({
      id: recipient.id,
      name: recipient.name ?? undefined,
      email: recipient.email,
    })),
    requestMetadata,
  });

  const copiedFields = await prisma.field.findMany({ where: { envelopeId: createdDocument.id } });

  const copiedShape = copiedFields.find((field) => field.type === FieldType.SHAPE);
  const copiedText = copiedFields.find((field) => field.type === FieldType.TEXT);

  expect(copiedShape?.inserted).toBe(true);
  expect(copiedShape?.order).toBe(7);
  expect(copiedText?.inserted).toBe(false);
  expect(copiedText?.order).toBe(2);
});

test('preview paints overlapping fields in persisted stacking order', async ({ page, request }) => {
  const { envelope, user, team } = await apiSeedDraftDocument(request, {
    title: `[TEST] Shape stacking ${Date.now()}`,
    recipients: [{ email: `shape-stack-${Date.now()}@test.documenso.com`, name: 'Shape Stack Recipient' }],
    fieldsPerRecipient: [
      [
        {
          type: FieldType.SHAPE,
          page: 1,
          positionX: 20,
          positionY: 20,
          width: 40,
          height: 30,
          fieldMeta: SHAPE_FIELD_META,
        },
        {
          type: FieldType.TEXT,
          page: 1,
          positionX: 20,
          positionY: 20,
          width: 40,
          height: 30,
          fieldMeta: TEXT_FIELD_META,
        },
      ],
    ],
  });

  const fields = await prisma.field.findMany({ where: { envelopeId: envelope.id } });

  const shapeField = fields.find((field) => field.type === FieldType.SHAPE);
  const textField = fields.find((field) => field.type === FieldType.TEXT);

  if (!shapeField || !textField) {
    throw new Error('Seeded fields are missing');
  }

  await prisma.field.update({ where: { id: textField.id }, data: { order: 0 } });
  await prisma.field.update({ where: { id: shapeField.id }, data: { order: 1 } });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${envelope.id}/edit?step=preview`,
  });

  await clickEnvelopeEditorStep(page, 'preview');

  await expect
    .poll(async () => (await getKonvaFieldGroupsForPage(page, 1)).map((group) => group.id))
    .toEqual([textField.id.toString(), shapeField.id.toString()]);

  const groups = await getKonvaFieldGroupsForPage(page, 1);
  const shapeGroup = groups.find((group) => group.id === shapeField.id.toString());

  expect(shapeGroup).toBeDefined();
  expect(shapeGroup?.listening).toBe(false);
  expect(shapeGroup?.visible).toBe(true);
});

test('completed PDF retains a decorative shape that was not marked as inserted', async ({ page, request }) => {
  const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
    title: `[TEST] Completed shape ${Date.now()}`,
    recipients: [{ email: `shape-complete-${Date.now()}@test.documenso.com`, name: 'Shape Completion Signer' }],
    fieldsPerRecipient: [
      [
        {
          type: FieldType.SHAPE,
          page: 1,
          positionX: 35,
          positionY: 35,
          width: 30,
          height: 30,
          fieldMeta: SHAPE_FIELD_META,
        },
        {
          type: FieldType.SIGNATURE,
          page: 1,
          positionX: 5,
          positionY: 5,
          width: 15,
          height: 5,
        },
      ],
    ],
  });

  const shapeField = await prisma.field.findFirstOrThrow({
    where: {
      envelopeId: envelope.id,
      type: FieldType.SHAPE,
    },
  });

  await prisma.field.update({
    where: { id: shapeField.id },
    data: { inserted: false },
  });

  const { token } = distributeResult.recipients[0];

  await page.goto(`/sign/${token}`);

  await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: 30_000 });

  const canvas = page.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText('1 Field Remaining').first()).toBeVisible();

  await page.getByTestId('signature-pad-dialog-button').click();
  await page.getByRole('tab', { name: 'Type' }).click();
  await page.getByTestId('signature-pad-type-input').fill('Shape Signer');
  await page.getByRole('button', { name: 'Next' }).click();

  const canvasBox = await canvas.boundingBox();

  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  const signatureField = envelope.fields.find((field) => field.type === FieldType.SIGNATURE);

  if (!signatureField) {
    throw new Error('Signature field not found');
  }

  const x =
    (Number(signatureField.positionX) / 100) * canvasBox.width +
    ((Number(signatureField.width) / 100) * canvasBox.width) / 2;
  const y =
    (Number(signatureField.positionY) / 100) * canvasBox.height +
    ((Number(signatureField.height) / 100) * canvasBox.height) / 2;

  await canvas.click({ position: { x, y } });
  await expect(page.getByText('0 Fields Remaining').first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('heading', { name: 'Are you sure?' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign' }).click();

  await page.waitForURL(`/sign/${token}/complete`);
  await expect(page.getByText('Document Signed')).toBeVisible();

  await expect
    .poll(async () => {
      const completedEnvelope = await prisma.envelope.findUniqueOrThrow({ where: { id: envelope.id } });

      return completedEnvelope.status;
    })
    .toBe(DocumentStatus.COMPLETED);

  const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  const documentUrl = getEnvelopeItemPdfUrl({
    type: 'download',
    envelopeItem,
    token,
    version: 'signed',
  });

  const response = await fetch(documentUrl);

  if (!response.ok) {
    throw new Error(`Unable to download signed PDF: ${response.status} ${await response.text()}`);
  }

  const pdfBytes = new Uint8Array(await response.arrayBuffer());
  const pixel = await getPdfPixel({
    pdfBytes,
    pageNumber: 1,
    relativeX: 0.5,
    relativeY: 0.5,
  });

  expect(pixel[0]).toBeGreaterThan(200);
  expect(pixel[1]).toBeLessThan(80);
  expect(pixel[2]).toBeLessThan(80);
});

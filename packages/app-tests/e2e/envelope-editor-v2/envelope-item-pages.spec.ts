import { FIELD_TEXT_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';
import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { PDF, StandardFonts } from '@libpdf/core';
import { expect, type Page, test } from '@playwright/test';
import { DocumentDataType, FieldType } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import {
  addEnvelopeItemPdf,
  clickEnvelopeEditorStep,
  getEnvelopeItemTitleInputs,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

const getPageManagerButton = (root: Page) =>
  root.locator('[data-testid^="envelope-item-page-manager-button-"]').first();

const getPageCards = (root: Page) => root.locator('[data-testid^="page-manager-page-"]');

const createPdfBuffer = async (pageLabels: string[]) => {
  const pdf = PDF.create();

  for (const label of pageLabels) {
    const page = pdf.addPage({ size: 'letter' });

    page.drawText(label, {
      x: 72,
      y: 700,
      size: 32,
      font: StandardFonts.Helvetica,
    });
  }

  return Buffer.from(await pdf.save());
};

const setEnvelopeItemPdf = async (envelopeId: string, pdfBuffer: Buffer) => {
  const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
    where: {
      envelopeId,
    },
    orderBy: {
      order: 'asc',
    },
  });

  const data = pdfBuffer.toString('base64');

  const documentData = await prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data,
      initialData: data,
    },
  });

  await prisma.envelopeItem.update({
    where: {
      id: envelopeItem.id,
    },
    data: {
      documentDataId: documentData.id,
    },
  });
};

const getPdfPageTexts = async (envelopeId: string) => {
  const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
    where: {
      envelopeId,
    },
    orderBy: {
      order: 'asc',
    },
    include: {
      documentData: true,
    },
  });

  const bytes = await getFileServerSide({
    type: envelopeItem.documentData.type,
    data: envelopeItem.documentData.data,
  });

  const pdf = await PDF.load(new Uint8Array(bytes));

  return pdf.extractText().map((page) => page.text.trim().replace(/\s+/g, ' '));
};

const reloadEditor = async (root: Page) => {
  await root.reload();
  await expect(root.getByRole('heading', { name: 'Documents' })).toBeVisible();
};

const openPageManager = async (root: Page, expectedPageCount: number) => {
  await getPageManagerButton(root).click();
  await expect(root.getByRole('heading', { name: 'Manage pages' })).toBeVisible();
  await expect(getPageCards(root)).toHaveCount(expectedPageCount);
};

const applyPageChanges = async (root: Page) => {
  await root.getByTestId('page-manager-apply-button').click();
  await expectToastTextToBeVisible(root, 'Pages updated');
  await expect(root.getByTestId('page-manager-dialog')).not.toBeVisible();
};

const runPageOperationsFlow = async (surface: TEnvelopeEditorSurface) => {
  const { root, envelopeId } = surface;

  if (!envelopeId) {
    throw new Error('Expected an envelope ID for this editor surface');
  }

  await setEnvelopeItemPdf(envelopeId, await createPdfBuffer(['PAGE 1', 'PAGE 2', 'PAGE 3']));
  await reloadEditor(root);

  await openPageManager(root, 3);
  await root.getByTestId('page-manager-duplicate-0').click();
  await expect(getPageCards(root)).toHaveCount(4);
  await applyPageChanges(root);

  expect(await getPdfPageTexts(envelopeId)).toEqual(['PAGE 1', 'PAGE 1', 'PAGE 2', 'PAGE 3']);

  await openPageManager(root, 4);
  await root.getByTestId('page-manager-delete-1').click();
  await expect(getPageCards(root)).toHaveCount(3);
  await applyPageChanges(root);

  expect(await getPdfPageTexts(envelopeId)).toEqual(['PAGE 1', 'PAGE 2', 'PAGE 3']);

  await openPageManager(root, 3);
  await root.getByTestId('page-manager-move-left-2').click();
  await applyPageChanges(root);

  expect(await getPdfPageTexts(envelopeId)).toEqual(['PAGE 1', 'PAGE 3', 'PAGE 2']);

  const importPdf = await createPdfBuffer(['IMPORT 1', 'IMPORT 2']);

  await openPageManager(root, 3);
  await root.getByTestId('page-manager-import-file-input').setInputFiles({
    name: 'import.pdf',
    mimeType: 'application/pdf',
    buffer: importPdf,
  });

  await expect(root.getByTestId('page-manager-import-panel')).toBeVisible();
  await expect(root.locator('[data-testid^="page-manager-import-page-"]')).toHaveCount(2);

  await root.getByTestId('page-manager-import-page-0').click();
  await root.getByTestId('page-manager-import-page-1').click();
  await root.getByTestId('page-manager-add-imported-pages').click();

  await expect(getPageCards(root)).toHaveCount(5);
  await applyPageChanges(root);

  expect(await getPdfPageTexts(envelopeId)).toEqual(['PAGE 1', 'PAGE 3', 'PAGE 2', 'IMPORT 1', 'IMPORT 2']);

  await openPageManager(root, 5);
  await root.getByTestId('page-manager-select-3').click();
  await root.getByTestId('page-manager-select-4').click();
  await root.getByTestId('page-manager-delete-selected').click();
  await expect(getPageCards(root)).toHaveCount(3);
  await applyPageChanges(root);

  expect(await getPdfPageTexts(envelopeId)).toEqual(['PAGE 1', 'PAGE 3', 'PAGE 2']);

  await openPageManager(root, 3);
  await root.getByTestId('page-manager-select-0').click();
  await root.getByTestId('page-manager-select-1').click();
  await root.getByTestId('page-manager-delete-selected').click();
  await expect(getPageCards(root)).toHaveCount(1);
  await applyPageChanges(root);

  expect(await getPdfPageTexts(envelopeId)).toEqual(['PAGE 2']);

  await openPageManager(root, 1);
  await expect(root.getByTestId('page-manager-delete-0')).toBeDisabled();
  await root.getByTestId('page-manager-select-0').click();
  await expect(root.getByTestId('page-manager-delete-selected')).toBeDisabled();
  await root.getByTestId('btn-dialog-close').click();

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: {
      id: envelopeId,
    },
    include: {
      auditLogs: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  const pageAuditLog = envelope.auditLogs.find((log) => log.type === 'ENVELOPE_ITEM_PAGES_UPDATED');

  expect(pageAuditLog).toMatchObject({ data: { toPageCount: 1 } });
};

const runFieldBlockedDeletionFlow = async (surface: TEnvelopeEditorSurface) => {
  const { root, envelopeId } = surface;

  if (!envelopeId) {
    throw new Error('Expected an envelope ID for this editor surface');
  }

  await setEnvelopeItemPdf(envelopeId, await createPdfBuffer(['PAGE 1', 'PAGE 2', 'PAGE 3']));

  const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
    where: {
      envelopeId,
    },
  });

  const recipient = await prisma.recipient.create({
    data: {
      envelopeId,
      email: `page-field-${nanoid()}@test.documenso.com`,
      name: 'Page Field Recipient',
      token: nanoid(),
    },
  });

  await prisma.field.create({
    data: {
      envelopeId,
      envelopeItemId: envelopeItem.id,
      recipientId: recipient.id,
      type: FieldType.TEXT,
      page: 2,
      positionX: 10,
      positionY: 10,
      width: 10,
      height: 10,
      customText: '',
      inserted: false,
      fieldMeta: FIELD_TEXT_META_DEFAULT_VALUES,
    },
  });

  await reloadEditor(root);
  await openPageManager(root, 3);

  await expect(root.getByTestId('page-manager-field-count-1')).toBeVisible();
  await expect(root.getByTestId('page-manager-delete-1')).toBeDisabled();

  await root.getByTestId('page-manager-select-1').click();
  await expect(root.getByTestId('page-manager-delete-selected')).toBeDisabled();

  await root.getByTestId('btn-dialog-close').click();
  await expect(root.getByTestId('page-manager-dialog')).not.toBeVisible();
};

test.describe('document editor', () => {
  test('duplicate, reorder, delete and import pages', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    await runPageOperationsFlow(surface);
  });

  test('blocks deleting a page containing fields', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);

    await runFieldBlockedDeletionFlow(surface);
  });

  test('opens the page manager from the fields step', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const { envelopeId } = surface;

    if (!envelopeId) {
      throw new Error('Expected an envelope ID for this editor surface');
    }

    await setEnvelopeItemPdf(envelopeId, await createPdfBuffer(['PAGE 1', 'PAGE 2']));
    await reloadEditor(page);
    await clickEnvelopeEditorStep(page, 'addFields');

    const pageManagerButton = page.locator('[data-testid^="envelope-item-page-manager-button-"]');

    await expect(pageManagerButton).toHaveCount(1);
    await pageManagerButton.click();

    await expect(page.getByRole('heading', { name: 'Manage pages' })).toBeVisible();
    await expect(getPageCards(page)).toHaveCount(2);
  });
});

test.describe('template editor', () => {
  test('duplicate, reorder, delete and import pages', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);

    await runPageOperationsFlow(surface);
  });
});

test.describe('pending document', () => {
  test('page manager is unavailable', async ({ page }) => {
    const { user, team } = await seedUser();

    const pendingDocument = await seedPendingDocument(user, team.id, [`pending-pages-${nanoid()}@test.documenso.com`], {
      internalVersion: 2,
    });

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents/${pendingDocument.id}/edit`,
    });

    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await expect(getEnvelopeItemTitleInputs(page)).toHaveCount(1);
    await expect(page.locator('[data-testid^="envelope-item-page-manager-button-"]')).toHaveCount(0);
  });
});

test.describe('embedded create', () => {
  test('page manager is unavailable', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-pages',
    });

    await addEnvelopeItemPdf(page);
    await expect(getEnvelopeItemTitleInputs(page)).toHaveCount(1);

    await expect(surface.root.locator('[data-testid^="envelope-item-page-manager-button-"]')).toHaveCount(0);
  });
});

test.describe('embedded edit', () => {
  test('page manager is unavailable', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-pages',
    });

    await expect(getEnvelopeItemTitleInputs(page)).toHaveCount(1);
    await expect(surface.root.locator('[data-testid^="envelope-item-page-manager-button-"]')).toHaveCount(0);
  });
});

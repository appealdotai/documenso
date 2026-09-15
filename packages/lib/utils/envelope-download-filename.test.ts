import { describe, expect, it } from 'vitest';

import {
  buildEnvelopeItemDownloadFilename,
  buildEnvelopeItemEmailAttachmentFilename,
  getEnvelopeItemDownloadBaseTitle,
} from './envelope-download-filename';

describe('envelope-download-filename', () => {
  const baseOptions = {
    envelopeTitle: 'Envelope Title',
    envelopeItemTitle: 'Item Title',
    envelopeItemCount: 1,
    useEnvelopeTitleForDownload: false,
  };

  it('uses envelope item title by default', () => {
    expect(getEnvelopeItemDownloadBaseTitle(baseOptions)).toBe('Item Title');
    expect(buildEnvelopeItemDownloadFilename(baseOptions)).toBe('Item Title_signed.pdf');
  });

  it('uses envelope title for single-item envelopes when setting is enabled', () => {
    expect(
      getEnvelopeItemDownloadBaseTitle({
        ...baseOptions,
        useEnvelopeTitleForDownload: true,
      }),
    ).toBe('Envelope Title');
  });

  it('keeps envelope item title for multi-item envelopes even when setting is enabled', () => {
    expect(
      getEnvelopeItemDownloadBaseTitle({
        ...baseOptions,
        envelopeItemCount: 2,
        useEnvelopeTitleForDownload: true,
      }),
    ).toBe('Item Title');
  });

  it('strips a trailing .pdf from the base title', () => {
    expect(
      getEnvelopeItemDownloadBaseTitle({
        ...baseOptions,
        envelopeItemTitle: 'Contract.pdf',
      }),
    ).toBe('Contract');
  });

  it('builds email attachment filenames without the signed suffix', () => {
    expect(
      buildEnvelopeItemEmailAttachmentFilename({
        ...baseOptions,
        useEnvelopeTitleForDownload: true,
      }),
    ).toBe('Envelope Title.pdf');
  });
});

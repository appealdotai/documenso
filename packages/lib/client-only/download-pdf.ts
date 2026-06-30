import type { EnvelopeItem } from '@prisma/client';

import { getEnvelopeItemPdfUrl } from '../utils/envelope-download';
import { downloadFile } from './download-file';

type DocumentVersion = 'original' | 'signed' | 'pending';

type DownloadPDFProps = {
  envelopeItem: Pick<EnvelopeItem, 'id' | 'envelopeId'>;
  token: string | undefined;

  fileName?: string;
  /**
   * Specifies which version of the document to download.
   * 'signed': Downloads the signed version (default).
   * 'original': Downloads the original version.
   * 'pending': Downloads the original document with currently-inserted fields burned in.
   *            Only valid while the envelope is in PENDING status. Not supported via
   *            recipient token.
   */
  version?: DocumentVersion;
};

const versionToFilenameSuffix = (version: DocumentVersion): string => {
  switch (version) {
    case 'signed':
      return '_signed.pdf';
    case 'pending':
      return '_pending.pdf';
    case 'original':
      return '.pdf';
  }
};

const parseFilenameFromContentDisposition = (header: string | null): string | null => {
  if (!header) {
    return null;
  }

  const filenameStar = header.match(/filename\*=UTF-8''([^;]+)/i);

  if (filenameStar?.[1]) {
    return decodeURIComponent(filenameStar[1]);
  }

  const filename = header.match(/filename="([^"]+)"/i) ?? header.match(/filename=([^;]+)/i);

  return filename?.[1]?.trim() ?? null;
};

export const downloadPDF = async ({ envelopeItem, token, fileName, version = 'signed' }: DownloadPDFProps) => {
  const downloadUrl = getEnvelopeItemPdfUrl({
    type: 'download',
    envelopeItem: envelopeItem,
    token,
    version,
  });

  const response = await fetch(downloadUrl);
  const blob = await response.blob();

  const filenameFromHeader = parseFilenameFromContentDisposition(response.headers.get('Content-Disposition'));

  if (filenameFromHeader) {
    downloadFile({
      filename: filenameFromHeader,
      data: blob,
    });

    return;
  }

  const baseTitle = (fileName ?? 'document').replace(/\.pdf$/i, '');

  downloadFile({
    filename: `${baseTitle}${versionToFilenameSuffix(version)}`,
    data: blob,
  });
};

export type GetEnvelopeItemDownloadBaseTitleOptions = {
  envelopeTitle: string;
  envelopeItemTitle: string;
  envelopeItemCount: number;
  useEnvelopeTitleForDownload: boolean;
};

/**
 * Resolves the base filename (without version suffix) for an envelope item download.
 *
 * When `useEnvelopeTitleForDownload` is enabled and the envelope has a single item,
 * the envelope title is used (e.g. API `override.title` on template/use). Multi-file
 * envelopes always use per-item titles to avoid filename collisions.
 */
export const getEnvelopeItemDownloadBaseTitle = ({
  envelopeTitle,
  envelopeItemTitle,
  envelopeItemCount,
  useEnvelopeTitleForDownload,
}: GetEnvelopeItemDownloadBaseTitleOptions): string => {
  const rawTitle = useEnvelopeTitleForDownload && envelopeItemCount === 1 ? envelopeTitle : envelopeItemTitle;

  return rawTitle.replace(/\.pdf$/i, '');
};

export type DocumentDownloadVersion = 'original' | 'signed' | 'pending';

const versionToFilenameSuffix = (version: DocumentDownloadVersion): string => {
  switch (version) {
    case 'signed':
      return '_signed.pdf';
    case 'pending':
      return '_pending.pdf';
    case 'original':
      return '.pdf';
  }
};

export const buildEnvelopeItemDownloadFilename = (
  options: GetEnvelopeItemDownloadBaseTitleOptions & {
    version?: DocumentDownloadVersion;
  },
): string => {
  const { version = 'signed', ...baseTitleOptions } = options;
  const baseTitle = getEnvelopeItemDownloadBaseTitle(baseTitleOptions);

  return `${baseTitle}${versionToFilenameSuffix(version)}`;
};

/**
 * Attachment filename for completed-document emails (signed PDF, no `_signed` suffix).
 */
export const buildEnvelopeItemEmailAttachmentFilename = (options: GetEnvelopeItemDownloadBaseTitleOptions): string => {
  const baseTitle = getEnvelopeItemDownloadBaseTitle(options);

  return baseTitle.endsWith('.pdf') ? baseTitle : `${baseTitle}.pdf`;
};

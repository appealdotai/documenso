import {
  buildEnvelopeItemDownloadFilename,
  buildEnvelopeItemEmailAttachmentFilename,
  type DocumentDownloadVersion,
  type GetEnvelopeItemDownloadBaseTitleOptions,
  getEnvelopeItemDownloadBaseTitle,
} from '../../utils/envelope-download-filename';
import { getTeamSettings } from '../team/get-team-settings';

export type ResolveEnvelopeItemDownloadTitleOptions = Omit<
  GetEnvelopeItemDownloadBaseTitleOptions,
  'useEnvelopeTitleForDownload'
> & {
  teamId: number;
};

export const resolveEnvelopeItemDownloadBaseTitle = async ({
  teamId,
  ...options
}: ResolveEnvelopeItemDownloadTitleOptions) => {
  const settings = await getTeamSettings({ teamId });

  return getEnvelopeItemDownloadBaseTitle({
    ...options,
    useEnvelopeTitleForDownload: settings.useEnvelopeTitleForDownload,
  });
};

export const resolveEnvelopeItemDownloadFilename = async (
  options: ResolveEnvelopeItemDownloadTitleOptions & {
    version?: DocumentDownloadVersion;
  },
) => {
  const { teamId, version, ...titleOptions } = options;
  const settings = await getTeamSettings({ teamId });

  return buildEnvelopeItemDownloadFilename({
    ...titleOptions,
    version,
    useEnvelopeTitleForDownload: settings.useEnvelopeTitleForDownload,
  });
};

export const resolveEnvelopeItemEmailAttachmentFilename = async (options: ResolveEnvelopeItemDownloadTitleOptions) => {
  const settings = await getTeamSettings({ teamId: options.teamId });

  return buildEnvelopeItemEmailAttachmentFilename({
    ...options,
    useEnvelopeTitleForDownload: settings.useEnvelopeTitleForDownload,
  });
};

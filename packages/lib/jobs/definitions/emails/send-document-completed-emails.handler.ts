import { DocumentCompletedEmailTemplate } from '@documenso/email/templates/document-completed';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import { DocumentSource, EnvelopeType, RecipientRole } from '@prisma/client';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { assertOrganisationRatesAndLimits } from '../../../server-only/rate-limit/assert-organisation-rates-and-limits';
import { DOCUMENT_AUDIT_LOG_TYPE, DOCUMENT_EMAIL_TYPE } from '../../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { getFileServerSide } from '../../../universal/upload/get-file.server';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { unsafeBuildEnvelopeIdQuery } from '../../../utils/envelope';
import { buildEnvelopeItemEmailAttachmentFilename } from '../../../utils/envelope-download-filename';
import { isRecipientEmailValidForSending } from '../../../utils/recipients';
import { renderCustomEmailTemplate } from '../../../utils/render-custom-email-template';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { formatDocumentsPath } from '../../../utils/teams';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendDocumentCompletedEmailsJobDefinition } from './send-document-completed-emails';

const getCompletionEmailKey = (recipientRole: string, recipientId: number) => `${recipientRole}:${recipientId}`;

const getErrorMessage = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

const getSentCompletionEmailKeys = async (envelopeId: string) => {
  const existingCompletionEmailLogs = await prisma.documentAuditLog.findMany({
    where: {
      envelopeId,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
      data: {
        path: ['emailType'],
        equals: DOCUMENT_EMAIL_TYPE.DOCUMENT_COMPLETED,
      },
    },
    select: {
      data: true,
    },
  });

  return new Set(
    existingCompletionEmailLogs.map((log) => {
      const data = log.data as { recipientRole: string; recipientId: number };

      return getCompletionEmailKey(data.recipientRole, data.recipientId);
    }),
  );
};

export const run = async ({ payload, io }: { payload: TSendDocumentCompletedEmailsJobDefinition; io: JobRunIO }) => {
  const { envelopeId, requestMetadata } = payload;

  const envelope = await prisma.envelope.findUnique({
    where: unsafeBuildEnvelopeIdQuery({ type: 'envelopeId', id: envelopeId }, EnvelopeType.DOCUMENT),
    include: {
      envelopeItems: {
        include: {
          documentData: {
            select: {
              type: true,
              id: true,
              data: true,
            },
          },
        },
      },
      documentMeta: true,
      recipients: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          disabled: true,
        },
      },
      team: {
        select: {
          id: true,
          url: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new Error('Document not found');
  }

  const isDirectTemplate = envelope?.source === DocumentSource.TEMPLATE_DIRECT_LINK;

  if (envelope.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  const {
    branding,
    emailLanguage,
    senderEmail,
    replyToEmail,
    organisationId,
    claims,
    emailsDisabled,
    emailTransport,
    settings,
  } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  // Don't send completion emails if the organisation has email sending disabled or the owner is disabled (e.g. banned).
  if (envelope.user.disabled || emailsDisabled) {
    return;
  }

  const { user: owner } = envelope;

  const completedDocumentEmailAttachments = await Promise.all(
    envelope.envelopeItems.map(async (envelopeItem) => {
      const file = await getFileServerSide(envelopeItem.documentData);

      const filename = buildEnvelopeItemEmailAttachmentFilename({
        envelopeTitle: envelope.title,
        envelopeItemTitle: envelopeItem.title,
        envelopeItemCount: envelope.envelopeItems.length,
        useEnvelopeTitleForDownload: settings.useEnvelopeTitleForDownload,
      });

      return {
        filename,
        content: Buffer.from(file),
        contentType: 'application/pdf',
      };
    }),
  );

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  let documentOwnerDownloadLink = `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(
    envelope.team?.url,
  )}/${envelope.id}`;

  if (envelope.team?.url) {
    documentOwnerDownloadLink = `${NEXT_PUBLIC_WEBAPP_URL()}/t/${envelope.team.url}/documents/${envelope.id}`;
  }

  const emailSettings = extractDerivedDocumentEmailSettings(envelope.documentMeta);
  const isDocumentCompletedEmailEnabled = emailSettings.documentCompleted;
  const isOwnerDocumentCompletedEmailEnabled = emailSettings.ownerDocumentCompleted;

  const sentCompletionEmailKeys = await getSentCompletionEmailKeys(envelope.id);

  // Send email to document owner if:
  // 1. Owner document completed emails are enabled AND
  // 2. Either:
  //    - The owner is not a recipient, OR
  //    - Recipient emails are disabled
  if (
    isOwnerDocumentCompletedEmailEnabled &&
    (!envelope.recipients.find((recipient) => recipient.email === owner.email) || !isDocumentCompletedEmailEnabled) &&
    !sentCompletionEmailKeys.has(getCompletionEmailKey('OWNER', owner.id))
  ) {
    const template = createElement(DocumentCompletedEmailTemplate, {
      documentName: envelope.title,
      assetBaseUrl,
      downloadLink: documentOwnerDownloadLink,
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(template, { lang: emailLanguage, branding }),
      renderEmailWithI18N(template, {
        lang: emailLanguage,
        branding,
        plainText: true,
      }),
    ]);

    const i18n = await getI18nInstance(emailLanguage);

    try {
      await emailTransport.sendMail({
        to: [
          {
            name: owner.name || '',
            address: owner.email,
          },
        ],
        from: senderEmail,
        replyTo: replyToEmail,
        subject: i18n._(msg`Signing Complete!`),
        html,
        text,
        attachments: completedDocumentEmailAttachments,
      });

      await prisma.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
          envelopeId: envelope.id,
          user: null,
          requestMetadata,
          data: {
            emailType: DOCUMENT_EMAIL_TYPE.DOCUMENT_COMPLETED,
            recipientEmail: owner.email,
            recipientName: owner.name ?? '',
            recipientId: owner.id,
            recipientRole: 'OWNER',
            isResending: false,
          },
        }),
      });

      sentCompletionEmailKeys.add(getCompletionEmailKey('OWNER', owner.id));
    } catch (error) {
      io.logger.error({
        msg: 'Failed to send document completed email to document owner',
        envelopeId: envelope.id,
        failedEmails: [owner.email],
        failedRecipients: [
          {
            email: owner.email,
            name: owner.name ?? '',
            recipientId: owner.id,
            role: 'OWNER',
            error: getErrorMessage(error),
          },
        ],
      });

      throw error;
    }
  }

  if (!isDocumentCompletedEmailEnabled) {
    return;
  }

  const recipientsToNotify = envelope.recipients.filter((recipient) => isRecipientEmailValidForSending(recipient));

  const recipientEmailResults = await Promise.allSettled(
    recipientsToNotify.map(async (recipient) => {
      if (sentCompletionEmailKeys.has(getCompletionEmailKey(recipient.role, recipient.id))) {
        return;
      }
      // A CC recipient never asked to be part of this document, so their completion
      // email is effectively unsolicited. Meter it against the organisation email
      // quota/stats so it is correctly logged.
      if (recipient.role === RecipientRole.CC) {
        try {
          await assertOrganisationRatesAndLimits({
            organisationId,
            organisationClaim: claims,
            type: 'email',
            count: 1,
          });
        } catch (_err) {
          io.logger.warn({
            msg: 'CC completion email dropped: org email limit exceeded',
            organisationId,
            recipientId: recipient.id,
            envelopeId: envelope.id,
          });

          // On rate/quota exceeded, early return to allow other recipients to be processed.
          return;
        }
      }

      const customEmailTemplate = {
        'signer.name': recipient.name,
        'signer.email': recipient.email,
        'document.name': envelope.title,
      };

      const downloadLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}/complete`;
      const reportUrl =
        recipient.role === RecipientRole.CC ? `${NEXT_PUBLIC_WEBAPP_URL()}/report/${recipient.token}` : undefined;

      const template = createElement(DocumentCompletedEmailTemplate, {
        documentName: envelope.title,
        assetBaseUrl,
        downloadLink: recipient.email === owner.email ? documentOwnerDownloadLink : downloadLink,
        customBody:
          isDirectTemplate && envelope.documentMeta?.message
            ? renderCustomEmailTemplate(envelope.documentMeta.message, customEmailTemplate)
            : undefined,
        reportUrl,
      });

      const [html, text] = await Promise.all([
        renderEmailWithI18N(template, { lang: emailLanguage, branding }),
        renderEmailWithI18N(template, {
          lang: emailLanguage,
          branding,
          plainText: true,
        }),
      ]);

      const i18n = await getI18nInstance(emailLanguage);

      await emailTransport.sendMail({
        to: [
          {
            name: recipient.name,
            address: recipient.email,
          },
        ],
        from: senderEmail,
        replyTo: replyToEmail,
        subject:
          isDirectTemplate && envelope.documentMeta?.subject
            ? renderCustomEmailTemplate(envelope.documentMeta.subject, customEmailTemplate)
            : i18n._(msg`Signing Complete!`),
        html,
        text,
        attachments: completedDocumentEmailAttachments,
      });

      await prisma.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
          envelopeId: envelope.id,
          user: null,
          requestMetadata,
          data: {
            emailType: DOCUMENT_EMAIL_TYPE.DOCUMENT_COMPLETED,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            recipientId: recipient.id,
            recipientRole: recipient.role,
            isResending: false,
          },
        }),
      });

      sentCompletionEmailKeys.add(getCompletionEmailKey(recipient.role, recipient.id));
    }),
  );

  const failedRecipients = recipientEmailResults.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return [];
    }

    const recipient = recipientsToNotify[index];

    return [
      {
        email: recipient.email,
        name: recipient.name,
        recipientId: recipient.id,
        role: recipient.role,
        error: getErrorMessage(result.reason),
        reason: result.reason,
      },
    ];
  });

  if (failedRecipients.length > 0) {
    io.logger.error({
      msg: 'Failed to send document completed email to one or more recipients',
      envelopeId: envelope.id,
      failedCount: failedRecipients.length,
      failedEmails: failedRecipients.map((recipient) => recipient.email),
      failedRecipients: failedRecipients.map(({ reason: _reason, ...recipient }) => recipient),
    });

    throw failedRecipients[0].reason;
  }
};

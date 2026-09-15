import type { TEmailTransportConfig } from '@documenso/lib/server-only/email/email-transport-config';
import { ResendTransport } from '@documenso/nodemailer-resend';
import type { Transporter } from 'nodemailer';
import { createTransport } from 'nodemailer';

import { MailChannelsTransport } from './mailchannels';
import { wrapTransportWithRateLimit } from './wrap-transport-with-rate-limit';

export const buildTransport = (config: TEmailTransportConfig): Transporter => {
  switch (config.type) {
    case 'MAILCHANNELS':
      return createTransport(
        MailChannelsTransport.makeTransport({
          apiKey: config.apiKey,
          endpoint: config.endpoint,
        }),
      );

    case 'RESEND':
      return wrapTransportWithRateLimit(
        createTransport(
          ResendTransport.makeTransport({
            apiKey: config.apiKey,
          }),
        ),
      );

    case 'SMTP_API':
      return createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.apiKeyUser ?? 'apikey',
          pass: config.apiKey,
        },
      });

    case 'SMTP_AUTH':
      return createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        ignoreTLS: config.ignoreTLS,
        auth: config.username
          ? {
              user: config.username,
              pass: config.password ?? '',
            }
          : undefined,
        ...(config.service ? { service: config.service } : {}),
      });
  }
};

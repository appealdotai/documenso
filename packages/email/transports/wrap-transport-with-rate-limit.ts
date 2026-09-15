import type { SentMessageInfo, Transporter } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('[429]') || error.message.includes('rate_limit_exceeded');
};

// Resend allows 2 requests per second; stay slightly under to avoid boundary bursts.
const RATE_LIMIT_MIN_INTERVAL_MS = 550;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 500;

let sendChain: Promise<unknown> = Promise.resolve();
let lastSendAt = 0;

const waitForRateLimit = async (): Promise<void> => {
  const now = Date.now();
  const waitMs = Math.max(0, RATE_LIMIT_MIN_INTERVAL_MS - (now - lastSendAt));

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastSendAt = Date.now();
};

const enqueueRateLimitedSend = <T>(fn: () => Promise<T>): Promise<T> => {
  const result = sendChain.then(async () => {
    await waitForRateLimit();
    return fn();
  });

  sendChain = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
};

const sendWithRetry = async (
  sendOnce: (mailOptions: Mail.Options) => Promise<SentMessageInfo>,
  mailOptions: Mail.Options,
): Promise<SentMessageInfo> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await enqueueRateLimitedSend(() => sendOnce(mailOptions));
    } catch (error) {
      lastError = error;

      if (!isRateLimitError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      await sleep(INITIAL_BACKOFF_MS * 2 ** attempt);
    }
  }

  throw lastError;
};

/**
 * Serializes outbound sends and retries Resend 429 rate-limit errors with backoff.
 * Apply to Resend transports to avoid losing emails when many jobs fire at once.
 */
export const wrapTransportWithRateLimit = (transport: Transporter): Transporter => {
  const originalSendMail = transport.sendMail.bind(transport);

  const sendOnce = (mailOptions: Mail.Options): Promise<SentMessageInfo> =>
    originalSendMail(mailOptions) as Promise<SentMessageInfo>;

  transport.sendMail = ((mailOptions: Mail.Options) => sendWithRetry(sendOnce, mailOptions)) as Transporter['sendMail'];

  return transport;
};

import { wrapTransportWithRateLimit } from '@documenso/email/transports/wrap-transport-with-rate-limit';
import type { SentMessageInfo, Transporter } from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';

const createMockTransport = (sendImpl: () => Promise<SentMessageInfo>): Transporter => {
  return {
    sendMail: vi.fn(sendImpl),
  } as unknown as Transporter;
};

describe('wrapTransportWithRateLimit', () => {
  it('retries sendMail when Resend returns a 429 rate limit error', async () => {
    let attempts = 0;

    const transport = wrapTransportWithRateLimit(
      createMockTransport(async () => {
        attempts += 1;

        if (attempts < 3) {
          throw new Error('[429]: rate_limit_exceeded Too many requests.');
        }

        return { messageId: 'ok' } as SentMessageInfo;
      }),
    );

    const result = await transport.sendMail({ to: 'test@example.com', from: 'from@example.com', subject: 'Hi' });

    expect(result).toEqual({ messageId: 'ok' });
    expect(attempts).toBe(3);
  });

  it('serializes concurrent sendMail calls to stay under the rate limit', async () => {
    const sendTimes: number[] = [];

    const transport = wrapTransportWithRateLimit(
      createMockTransport(async () => {
        sendTimes.push(Date.now());
        return { messageId: 'ok' } as SentMessageInfo;
      }),
    );

    await Promise.all([
      transport.sendMail({ to: 'a@example.com', from: 'from@example.com', subject: 'A' }),
      transport.sendMail({ to: 'b@example.com', from: 'from@example.com', subject: 'B' }),
      transport.sendMail({ to: 'c@example.com', from: 'from@example.com', subject: 'C' }),
    ]);

    expect(sendTimes).toHaveLength(3);

    const gap1 = sendTimes[1] - sendTimes[0];
    const gap2 = sendTimes[2] - sendTimes[1];

    expect(gap1).toBeGreaterThanOrEqual(500);
    expect(gap2).toBeGreaterThanOrEqual(500);
  });

  it('does not retry non-rate-limit errors', async () => {
    let attempts = 0;

    const transport = wrapTransportWithRateLimit(
      createMockTransport(async () => {
        attempts += 1;
        throw new Error('[403]: invalid_from_address');
      }),
    );

    await expect(
      transport.sendMail({ to: 'test@example.com', from: 'from@example.com', subject: 'Hi' }),
    ).rejects.toThrow('[403]: invalid_from_address');

    expect(attempts).toBe(1);
  });
});

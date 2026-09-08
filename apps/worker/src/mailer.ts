import nodemailer, { Transporter } from 'nodemailer';
import { getEnv } from './config/env';

/**
 * Notification abstraction. Phase 1 ships:
 *  - SMTP transport when SMTP_HOST is configured
 *  - structured console transport otherwise (dev)
 * Adding providers (SES, SendGrid, WhatsApp, push) means adding transports
 * here — order/domain code never changes and the order never fails because
 * a notification fails (all sends run in the worker with retries).
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const env = getEnv();
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ deliveredVia: 'smtp' | 'console' }> {
  const env = getEnv();
  const t = getTransporter();
  if (t) {
    await t.sendMail({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    return { deliveredVia: 'smtp' };
  }
  // Dev console transport — structured so it can be replaced.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      event: 'email.sent',
      deliveredVia: 'console',
      to: input.to,
      subject: input.subject,
      body: input.body,
    }),
  );
  return { deliveredVia: 'console' };
}

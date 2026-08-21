import nodemailer from 'nodemailer';
import { prisma } from './prisma';

interface SendEmailParams {
  senderId: string;
  to: string;
  subject: string;
  body: string;
}

interface SendResult {
  messageId: string;
  previewUrl: string | false;
}

// Cache transporters per sender to avoid re-creating for each email
const transporterCache = new Map<string, nodemailer.Transporter>();

/**
 * Get or create a Nodemailer transporter for a specific sender.
 */
async function getTransporter(senderId: string): Promise<nodemailer.Transporter> {
  const cached = transporterCache.get(senderId);
  if (cached) return cached;

  const sender = await prisma.sender.findUniqueOrThrow({
    where: { id: senderId },
  });

  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: false, // Ethereal uses STARTTLS on port 587
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass,
    },
  });

  transporterCache.set(senderId, transporter);
  return transporter;
}

/**
 * Send a single email via the sender's Ethereal SMTP.
 * Returns the messageId and an Ethereal preview URL.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const transporter = await getTransporter(params.senderId);

  const sender = await prisma.sender.findUniqueOrThrow({
    where: { id: params.senderId },
  });

  const info = await transporter.sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to: params.to,
    subject: params.subject,
    html: params.body,
    text: params.body.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  console.log(
    `[EmailSender] Sent to=${params.to} messageId=${info.messageId} preview=${previewUrl || 'N/A'}`
  );

  return {
    messageId: info.messageId,
    previewUrl: previewUrl,
  };
}

/**
 * Create an Ethereal test account programmatically.
 * Returns credentials that can be stored in the senders table.
 */
export async function createEtherealAccount(): Promise<{
  email: string;
  smtpUser: string;
  smtpPass: string;
  smtpHost: string;
  smtpPort: number;
}> {
  const testAccount = await nodemailer.createTestAccount();

  return {
    email: testAccount.user,
    smtpUser: testAccount.user,
    smtpPass: testAccount.pass,
    smtpHost: testAccount.smtp.host,
    smtpPort: testAccount.smtp.port,
  };
}

/**
 * Clear the transporter cache (useful for tests or sender credential updates).
 */
export function clearTransporterCache(): void {
  transporterCache.clear();
}

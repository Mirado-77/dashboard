import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const host = config.get('SMTP_HOST', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
    this.transport = host
      ? createTransport({
          host,
          port: config.get('SMTP_PORT', { infer: true }),
        })
      : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transport) {
      // No SMTP configured: development fallback, the mail goes to the logs.
      this.logger.warn(
        `SMTP_HOST not set, mail to ${message.to}:\n${message.text}`,
      );
      return;
    }
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

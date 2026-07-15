import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private mailerService: MailerService) {}

  async sendEmail(email: string, subject: string, html: string) {
    try {
      const result = await this.mailerService.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject,
        html,
      });

      console.log('Email sent:', result);
      return result;
    } catch (error) {
      console.error('Email error:', error);
      throw error;
    }
  }
}

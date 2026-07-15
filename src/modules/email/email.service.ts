import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private mailerService: MailerService) {}

  async sendEmail(email: string, subject: string, html: string) {
    console.log({ email, subject, html, from: process.env.SMTP_FROM });
    await this.mailerService.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject,
      html,
    });
  }
}

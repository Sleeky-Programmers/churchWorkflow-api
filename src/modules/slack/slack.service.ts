import { lastValueFrom } from 'rxjs';

import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SignupMethod = 'email' | 'google' | 'invite';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async notifySignup(data: {
    name?: string;
    email: string;
    method: SignupMethod;
  }) {
    const webhookUrl = this.configService.get<string>('slack.signupWebhookUrl');
    if (!webhookUrl) {
      return;
    }

    const methodLabel =
      data.method === 'google'
        ? 'Google'
        : data.method === 'invite'
          ? 'Invite'
          : 'Email';

    const namePart = data.name ? `${data.name} ` : '';
    const text = `🎉 New signup: ${namePart}(${data.email}) — via ${methodLabel}`;

    try {
      await lastValueFrom(this.httpService.post(webhookUrl, { text }));
    } catch (err) {
      this.logger.error(
        `Failed to send Slack signup notification for ${data.email}`,
        err as any,
      );
    }
  }
}

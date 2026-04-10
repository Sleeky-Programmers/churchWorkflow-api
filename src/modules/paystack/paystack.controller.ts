import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { SubscriptionService } from '../subscription/subscription.service';

@Controller('paystack')
export class PaystackController {
  constructor(
    private readonly paystackService: PaystackService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing Paystack signature');
    }

    const isValid = this.paystackService.verifyWebhookSignature(
      payload,
      signature,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid Paystack signature');
    }

    return this.paystackService.handleWebhook(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  async cancel(@AuthUser() authUser: Admin) {
    const churchId = authUser.churchId;
    const subscription =
      await this.subscriptionService.getSubscription(churchId);

    if (!subscription) {
      throw new BadRequestException('No subscription found for this church');
    }

    return await this.paystackService.cancelSubscriptionByCode(
      subscription.provider.subscriptionCode,
      subscription.provider.emailToken,
    );
  }
}

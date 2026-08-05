import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { FlutterwaveService } from './flutterwave.service';

@Controller('flutterwave')
export class FlutterwaveController {
  constructor(private readonly flutterwaveService: FlutterwaveService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Headers('verif-hash') signature: string,
  ) {
    return this.flutterwaveService.handleWebhook(payload, signature);
  }

  @Post('verify')
  async verify(@Body() payload: { reference: string; transactionId: string }) {
    return this.flutterwaveService.verifyTransaction(
      payload.reference,
      payload.transactionId,
    );
  }
}

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FlutterwaveService } from './flutterwave.service';

@Controller('flutterwave')
export class FlutterwaveController {
  constructor(private readonly flutterwaveService: FlutterwaveService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
  ) {
    return this.flutterwaveService.handleWebhook(payload);
  }

  @Post('verify')
  async verify(@Body('reference') reference: string) {
    return this.flutterwaveService.verifyTransaction(reference);
  }
}

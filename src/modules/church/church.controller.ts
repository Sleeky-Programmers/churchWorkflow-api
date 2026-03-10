import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChurchService } from './church.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { ChurchIdentityDto } from './dto/church-identity.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@Controller('church')
export class ChurchController {
  constructor(private readonly churchService: ChurchService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyChurch(@AuthUser() authUser: Admin) {
    return this.churchService.findCurrentChurch(authUser);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  createChurch(
    @AuthUser() authUser: Admin,
    @Body() churchIdentityDto: ChurchIdentityDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.churchService.create(authUser, churchIdentityDto, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyChurch(@AuthUser() authUser: Admin) {
    return this.churchService.getMyChurch(authUser.churchId);
  }
}

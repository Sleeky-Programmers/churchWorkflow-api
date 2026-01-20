import {
  Body,
  Controller,
  Put,
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
  @Put()
  @UseInterceptors(FileInterceptor('file'))
  updateChurch(
    @AuthUser() authUser: Admin,
    @Body() churchIdentityDto: ChurchIdentityDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.churchService.update(authUser, churchIdentityDto, file);
  }
}

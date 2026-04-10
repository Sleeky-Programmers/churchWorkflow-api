import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChurchService } from './church.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { ChurchIdentityDto } from './dto/church-identity.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationBaseDto } from '../../common/helpers/pagination.helper';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('church')
export class ChurchController {
  constructor(private readonly churchService: ChurchService) {}

  @Get('me')
  @Roles('Super Admin')
  getMyChurch(@AuthUser() authUser: Admin) {
    return this.churchService.findCurrentChurch(authUser);
  }

  @Get()
  @Roles('Super Admin')
  getAllChurches(@Query() paginationBaseDto: PaginationBaseDto) {
    return this.churchService.findAll(paginationBaseDto);
  }

  @Get(':id')
  @Roles('Super Admin')
  getChurchById(@Param('id') id: string) {
    return this.churchService.findDetailsById(id);
  }

  @Post()
  @Roles('Super Admin')
  @UseInterceptors(FileInterceptor('file'))
  createChurch(
    @AuthUser() authUser: Admin,
    @Body() churchIdentityDto: ChurchIdentityDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.churchService.create(authUser, churchIdentityDto, file);
  }
}

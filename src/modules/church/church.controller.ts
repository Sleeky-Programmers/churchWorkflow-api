import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChurchService } from './church.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { ChurchIdentityDto } from './dto/church-identity.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ChurchFilterDto } from './dto/church-filter.dto';
import { Types } from 'mongoose';
import { UserRole} from '../../common/utils/enums.utils';

 import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';

@Controller('church')
export class ChurchController {
  constructor(private readonly churchService: ChurchService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyChurch(@AuthUser() authUser: Admin) {
    return this.churchService.findCurrentChurch(authUser);
  }

   @UseGuards(ProductAdminJwtAuthGuard)
  @Get()
  getAllChurches(@Query() filter: ChurchFilterDto) {
    return this.churchService.findAll(filter);
  }

   @UseGuards(ProductAdminJwtAuthGuard)
  @Get(':id')
  getChurchById(@Param('id') id: string) {
    return this.churchService.findDetailsById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  createChurch(
    @AuthUser() authUser: Admin,
    @Body() churchIdentityDto: ChurchIdentityDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.churchService.create(authUser, churchIdentityDto, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('me')
  @Roles('Super Admin')
  @UseInterceptors(FileInterceptor('file'))
  async updateChurch(
    @AuthUser() user: Admin,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const church = await this.churchService.findCurrentChurch(user);

    return this.churchService.update(church._id, body, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/block')
  @Roles('Super Admin')
  blockChurch(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid church ID');
    }
    return this.churchService.blockChurch(new Types.ObjectId(id));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/unblock')
  @Roles('Super Admin')
  unblockChurch(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid church ID');
    }
    return this.churchService.unblockChurch(new Types.ObjectId(id));
  }
}

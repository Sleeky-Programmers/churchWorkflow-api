import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CreateMemberDto } from './dto/create-member.dto';
import { PaginationBaseDto, MembersFilterDto } from '../../common/helpers/pagination.helper';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';

@UseGuards(JwtAuthGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post('csv/create')
  @UseInterceptors(FileInterceptor('file'))
  createMembersByCsv(
    @AuthUser() authUser: Admin,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    return this.membersService.createMembersByCsv(authUser, file.buffer);
  }

  @Post('add')
  addMember(
    @AuthUser() authUser: Admin,
    @Body() createMemberDto: CreateMemberDto,
  ) {
    return this.membersService.addMember(authUser, createMemberDto);
  }

  @Get('stats')
  getMemberStats(@AuthUser() authUser: Admin) {
    return this.membersService.getMemberStats(authUser);
  }

  @Get()
  getAllMembers(
    @AuthUser() authUser: Admin,
    @Query() paginationBaseDto: MembersFilterDto,
  ) {
    return this.membersService.getAllMembers(authUser, paginationBaseDto);
  }

  @Get('/:id')
  getMemberById(@Param('id') id: string) {
    return this.membersService.getMemberById(id);
  }

  @Put('/:id')
  updateMember(
    @Param('id') id: string,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    return this.membersService.updateMember(id, updateMemberDto);
  }

  @Delete('/:id')
  deleteMember(@Param('id') id: string) {
    return this.membersService.deleteMember(id);
  }
}

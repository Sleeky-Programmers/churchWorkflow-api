import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { ActivateOrDisableRoleDto, UpdateRoleDto } from './dto/update-role.dto';
import { Admin } from '../../schemas/admin.schema';
import { AuthUser } from '../../common/decorators/auth-user.decorator';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  fetchRoles(@AuthUser() authUser: Admin) {
    return this.rolesService.fetchRoles(authUser);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@AuthUser() authUser: Admin, @Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(authUser, createRoleDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/:id')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/:id')
  disableOrActivate(
    @Param('id') id: string,
    @Body() activateOrDisableRoleDto: ActivateOrDisableRoleDto,
  ) {
    return this.rolesService.disableOrActivate(
      id,
      activateOrDisableRoleDto.status,
    );
  }
}

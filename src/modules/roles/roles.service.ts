import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRoleDto } from './dto/create-role.dto';
import { Role } from '../../schemas/role.schema';
import { Admin } from '../../schemas/admin.schema';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleStatus, RoleType } from '../../common/utils/enums.utils';

@Injectable()
export class RolesService {
  constructor(@InjectModel(Role.name) private roleModel: Model<Role>) {}

  async fetchRoles(authUser: Admin) {
    return await this.roleModel.find({ churchId: authUser.churchId });
  }

  async getRoleById(id: Types.ObjectId) {
    return await this.roleModel.findById(id);
  }

  async create(authUser: Admin, createRoleDto: CreateRoleDto) {
    return await this.roleModel.create({
      churchId: authUser.churchId,
      ...createRoleDto,
    });
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const role = await this.roleModel.findById(id);

    if (role.type === RoleType.SYSTEM) {
      throw new BadRequestException('You cannot update a system role');
    }

    return await this.roleModel.findByIdAndUpdate(id, updateRoleDto, {
      new: true,
    });
  }

  async disableOrActivate(id: string, status: RoleStatus) {
    const role = await this.roleModel.findById(id);

    if (role.type === RoleType.SYSTEM) {
      throw new BadRequestException('You cannot update a system role');
    }

    return await this.roleModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
  }
}

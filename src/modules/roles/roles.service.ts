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

  async findOne(roleName: string) {
    return await this.roleModel.findOne({ roleName });
  }

  async ensureSystemRole(roleName: string, description?: string) {
    const existing = await this.findOne(roleName);
    if (existing) {
      return existing;
    }

    return await this.roleModel.create({
      roleName,
      description: description || null,
      type: RoleType.SYSTEM,
      status: RoleStatus.ACTIVE,
      churchId: null,
      permissions: [],
    });
  }

  async fetchRoles(authUser: Admin) {
    const [systemRoles, customRoles] = await Promise.all([
      this.roleModel.find({ type: RoleType.SYSTEM }),
      this.roleModel.find({ churchId: authUser.churchId }),
    ]);

    const roles = [...systemRoles, ...customRoles];
    return roles;
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

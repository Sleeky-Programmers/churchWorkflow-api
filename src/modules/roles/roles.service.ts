import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRoleDto } from './dto/create-role.dto';
import { Role } from '../../schemas/role.schema';
import { SectionPermission } from '../../schemas/permission.schema';
import { Admin } from '../../schemas/admin.schema';
import { UpdateRoleDto } from './dto/update-role.dto';
import {
  AccessLevel,
  ModuleSections,
  RoleStatus,
  RoleType,
} from '../../common/utils/enums.utils';

export const SMALL_TEAMS_ROLE_NAME = 'Small Teams';
export const DEPARTMENT_HEAD_ROLE_NAME = 'Department Head';

/**
 * Service Timer roles (Product Plan, section 5.2). Admin does everything,
 * Operator runs the timer and edits programs, Viewer can only watch.
 */
export const TIMER_ROLES = [
  {
    roleName: 'Timer Admin',
    description:
      'Runs the service timer and manages its settings, PIN and display links.',
    accessLevel: AccessLevel.FULL_ACCESS,
  },
  {
    roleName: 'Timer Operator',
    description: 'Runs the service timer and edits programs and templates.',
    accessLevel: AccessLevel.MANAGE,
  },
  {
    roleName: 'Timer Viewer',
    description: 'Can view the service timer but not change it.',
    accessLevel: AccessLevel.VIEW,
  },
];

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(@InjectModel(Role.name) private roleModel: Model<Role>) {}

  // System roles are shared across every church (churchId: null), so
  // Ensuring this one document exists here covers both "auto-created for
  // New churches" and "backfilled for existing churches" in one step - there
  // Is nothing per-church to migrate.
  async onModuleInit() {
    try {
      await this.ensureSystemRole(
        SMALL_TEAMS_ROLE_NAME,
        'Can mark attendance and manage only the small team(s) they lead.',
        [
          {
            moduleSection: ModuleSections.SMALL_TEAMS,
            accessLevel: AccessLevel.MANAGE,
          },
          {
            moduleSection: ModuleSections.ATTENDANCE,
            accessLevel: AccessLevel.MANAGE,
          },
        ] as SectionPermission[],
      );

      await this.ensureSystemRole(
        DEPARTMENT_HEAD_ROLE_NAME,
        'Can manage only the department(s) they head or assist.',
        [
          {
            moduleSection: ModuleSections.DEPARTMENTS,
            accessLevel: AccessLevel.MANAGE,
          },
          {
            moduleSection: ModuleSections.REQUESTS,
            accessLevel: AccessLevel.MANAGE,
          },
        ] as SectionPermission[],
      );

      for (const role of TIMER_ROLES) {
        await this.ensureSystemRole(role.roleName, role.description, [
          {
            moduleSection: ModuleSections.SERVICE_TIMER,
            accessLevel: role.accessLevel,
          },
        ] as SectionPermission[]);
      }
    } catch (err) {
      this.logger.error('Failed to seed Small Teams system role', err as any);
    }
  }

  async findOne(roleName: string) {
    return await this.roleModel.findOne({ roleName });
  }

  async ensureSystemRole(
    roleName: string,
    description?: string,
    permissions: SectionPermission[] = [],
  ) {
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
      permissions,
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

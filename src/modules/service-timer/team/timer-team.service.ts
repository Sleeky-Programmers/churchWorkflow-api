import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  AdminInviteStatus,
  ChurchProduct,
} from '../../../common/utils/enums.utils';
import { isSuperAdminRole } from '../../../common/utils/permissions.util';
import { Admin } from '../../../schemas/admin.schema';
import { Invite } from '../../../schemas/invite.schema';
import { Role } from '../../../schemas/role.schema';
import { AdminInviteService } from '../../admin-invite/admin-invite.service';
import { RolesService, TIMER_ROLES } from '../../roles/roles.service';

/** The three Timer roles by their short names (Product Plan, section 5.2). */
export const TIMER_ROLE_KEYS = ['admin', 'operator', 'viewer'] as const;
export type TimerRoleKey = (typeof TIMER_ROLE_KEYS)[number];

const ROLE_NAME: Record<TimerRoleKey, string> = {
  admin: TIMER_ROLES[0].roleName,
  operator: TIMER_ROLES[1].roleName,
  viewer: TIMER_ROLES[2].roleName,
};

const keyForRoleName = (name?: string | null): TimerRoleKey | null =>
  TIMER_ROLE_KEYS.find((k) => ROLE_NAME[k] === name) ?? null;

/**
 * The timer's view of the church's team. It reuses Church Workflow's invite
 * system (emails, seat limits, accepting through /auth/admin-register) but
 * only ever assigns the three Timer roles, and only changes people whose
 * role is a Timer role: the owner, yourself, and anyone managed in Church
 * Workflow are shown but left alone.
 */
@Injectable()
export class TimerTeamService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    @InjectModel(Invite.name) private inviteModel: Model<Invite>,
    private rolesService: RolesService,
    private adminInviteService: AdminInviteService,
  ) {}

  private async roleFor(key: TimerRoleKey) {
    const role = await this.rolesService.findOne(ROLE_NAME[key]);
    if (!role) {
      throw new NotFoundException('Timer roles are not set up yet.');
    }
    return role;
  }

  async list(authUser: Admin) {
    const [admins, invites, seats] = await Promise.all([
      this.adminModel
        .find({ churchId: authUser.churchId })
        .populate('churchRole')
        .sort({ createdAt: 1 })
        .lean(),
      this.inviteModel
        .find({ churchId: authUser.churchId })
        .populate('churchRole')
        .lean(),
      this.adminInviteService.getUserLimitStatus(authUser),
    ]);
    const inviteByEmail = new Map(
      invites.map((i) => [i.email?.toLowerCase(), i]),
    );

    const members = admins.map((a) => {
      const role = a.churchRole as unknown as Role | null;
      const timerRole = keyForRoleName(role?.roleName);
      const isYou = String(a._id) === String(authUser._id);
      const isOwner = isSuperAdminRole(role);
      const invite = inviteByEmail.get(a.email?.toLowerCase());
      return {
        id: String(a._id),
        name: [a.title, a.firstName, a.lastName].filter(Boolean).join(' '),
        email: a.email,
        roleName: isOwner ? 'Owner' : (role?.roleName ?? 'No role'),
        timerRole,
        isYou,
        isOwner,
        suspended: invite?.status === AdminInviteStatus.SUSPENDED,
        manageable: !isYou && !isOwner && timerRole !== null,
      };
    });

    const pending = invites
      .filter((i) => i.status === AdminInviteStatus.PENDING)
      .map((i) => {
        const role = i.churchRole as unknown as Role | null;
        return {
          id: String(i._id),
          email: i.email,
          name: [i.title, i.firstName, i.lastName].filter(Boolean).join(' '),
          roleName: role?.roleName ?? '',
          timerRole: keyForRoleName(role?.roleName),
          sentAt: (i as unknown as { createdAt?: Date }).createdAt ?? null,
        };
      });

    return {
      members,
      invites: pending,
      seats: { used: seats.currentUsers, limit: seats.limit },
    };
  }

  async invite(
    authUser: Admin,
    dto: {
      email: string;
      firstName?: string;
      lastName?: string;
      role: TimerRoleKey;
    },
    // The inviter's active branch: accepting the invite grants access to it,
    // So the new member lands straight in this branch's timer.
    branchId: Types.ObjectId | null,
  ) {
    const role = await this.roleFor(dto.role);
    const invite = await this.adminInviteService.sendInvitation(
      authUser,
      {
        email: dto.email.trim().toLowerCase(),
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
      },
      String(role._id),
      ChurchProduct.SERVICE_TIMER,
      branchId,
    );
    return { id: String(invite._id) };
  }

  /** A pending invite of this church (the shared resend has no tenancy check). */
  private async pendingInvite(authUser: Admin, inviteId: string) {
    if (!Types.ObjectId.isValid(inviteId)) {
      throw new NotFoundException('Invite not found');
    }
    const invite = await this.inviteModel.findOne({
      _id: inviteId,
      churchId: authUser.churchId,
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.status !== AdminInviteStatus.PENDING) {
      throw new BadRequestException('This invite has already been accepted.');
    }
    return invite;
  }

  async resend(authUser: Admin, inviteId: string) {
    const invite = await this.pendingInvite(authUser, inviteId);
    await this.adminInviteService.resendInvitation(
      authUser,
      String(invite._id),
    );
    return { resent: true };
  }

  async cancel(authUser: Admin, inviteId: string) {
    const invite = await this.pendingInvite(authUser, inviteId);
    await this.adminInviteService.deleteInvitation(
      authUser,
      String(invite._id),
    );
    return { cancelled: true };
  }

  /** A member this Timer Admin may change: same church, a Timer role, not the owner or themselves. */
  private async manageableMember(authUser: Admin, adminId: string) {
    if (!Types.ObjectId.isValid(adminId)) {
      throw new NotFoundException('Team member not found');
    }
    const member = await this.adminModel
      .findOne({ _id: adminId, churchId: authUser.churchId })
      .populate('churchRole');
    if (!member) {
      throw new NotFoundException('Team member not found');
    }
    const role = member.churchRole as unknown as Role | null;
    if (String(member._id) === String(authUser._id)) {
      throw new ForbiddenException("You can't change your own access.");
    }
    if (isSuperAdminRole(role)) {
      throw new ForbiddenException("The church's owner can't be changed here.");
    }
    if (!keyForRoleName(role?.roleName)) {
      throw new ForbiddenException(
        "This person's access is managed in Church Workflow.",
      );
    }
    return member;
  }

  async changeRole(authUser: Admin, adminId: string, key: TimerRoleKey) {
    const member = await this.manageableMember(authUser, adminId);
    const role = await this.roleFor(key);
    const invite = await this.inviteModel.findOne({
      email: member.email,
      churchId: authUser.churchId,
    });
    if (invite) {
      // Updates the account too, and emails the person about the change.
      await this.adminInviteService.changeRole(
        authUser,
        String(invite._id),
        String(role._id),
      );
    } else {
      await this.adminModel.updateOne(
        { _id: member._id },
        { $set: { churchRole: role._id } },
      );
    }
    return { id: String(member._id), timerRole: key };
  }

  async remove(authUser: Admin, adminId: string) {
    const member = await this.manageableMember(authUser, adminId);
    const invite = await this.inviteModel.findOne({
      email: member.email,
      churchId: authUser.churchId,
    });
    if (invite) {
      await this.adminInviteService.removeUser(
        authUser,
        String(invite._id),
        'remove user',
      );
    } else {
      await this.adminModel.deleteOne({ _id: member._id });
    }
    return { removed: true };
  }
}

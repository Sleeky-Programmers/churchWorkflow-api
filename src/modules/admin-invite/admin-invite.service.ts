import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invite } from '../../schemas/invite.schema';
import { CreateAdminInviteDto } from './dto/create-admin-invite.dto';
import { EmailService } from '../email/email.service';
import { Admin } from '../../schemas/admin.schema';
import { ChurchService } from '../church/church.service';
import { RolesService } from '../roles/roles.service';
import { AdminService } from '../admin/admin.service';
import { encryptInvite } from '../../common/helpers/crypto.helper';
import { InvitePayload } from '../../common/utils/types.utils';
import {
  AdminInviteStatus,
  AdminOptions,
  InviteEmailType,
  PlanType,
} from '../../common/utils/enums.utils';
import { SubscriptionService } from '../subscription/subscription.service';
import { renderEmailLayout } from '../email/templates/email-layout.template';

@Injectable()
export class AdminInviteService {
  constructor(
    @InjectModel(Invite.name) private inviteModel: Model<Invite>,
    private churchService: ChurchService,
    private adminService: AdminService,
    private emailService: EmailService,
    private rolesService: RolesService,
    private subscriptionService: SubscriptionService,
  ) {}

  async sendInviteEmail({
    churchId,
    title,
    firstName,
    lastName,
    email,
    churchRole,
    churchRoleId,
    type = InviteEmailType.INVITE,
    invitePending = true,
    previousRole,
  }: InvitePayload & {
    type?: InviteEmailType;
    invitePending?: boolean;
    previousRole?: string;
  }) {
    const church = await this.churchService.findById(churchId);

    if (!church) {
      throw new NotFoundException('Church not found');
    }

    const FRONTEND_URL = process.env.FRONTEND_URL;
    const baseUrl = FRONTEND_URL?.replace(/\/$/, '');

    const hasName = Boolean(title || firstName || lastName);
    const name = [title, firstName, lastName].filter(Boolean).join(' ');
    const churchName = church.name;

    const token = encryptInvite({
      email,
      churchId,
      churchRole: churchRoleId,
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(title && { title }),
    });

    const inviteUrl = `${baseUrl}/auth/signup?invite=${token}`;
    const accountUrl = baseUrl;

    const isRoleChange = type === InviteEmailType.ROLE_CHANGE;

    const heading = isRoleChange
      ? 'Your role has been updated'
      : "You've been invited 🎉";

    const intro = isRoleChange
      ? `${churchName} has updated your role on <strong>Church Workflow</strong>.`
      : `${churchName} has invited you to join their church management system on <strong>Church Workflow</strong>.`;

    const buttonText = invitePending ? 'Accept Invitation' : 'Go to Workspace';
    const buttonLink = invitePending ? inviteUrl : accountUrl;

    const paragraphs = [intro, 'Your current role:'];

    if (invitePending) {
      paragraphs.push(
        'You have not yet accepted your invitation. Once you accept, you will have access based on this role.',
      );
    }

    const html = renderEmailLayout({
      previewText: heading,
      heading,
      greeting: hasName ? `Dear ${name},` : undefined,
      paragraphs,
      highlight: churchRole,
      button: { text: buttonText, link: buttonLink },
      fineprint: [
        previousRole ? `Previous role: ${previousRole}` : '',
        'If you did not expect this, please contact your administrator.',
      ]
        .filter(Boolean)
        .join('<br />'),
      footerNote: `This notification was sent by ${churchName} via Church Workflow.`,
    });

    const subject = isRoleChange ? 'Role Updated' : 'Admin Invitation';
    await this.emailService.sendEmail(email, subject, html);
  }

  async sendInvitation(
    authUser: Admin,
    createAdminInviteDto: CreateAdminInviteDto,
    churchRole: string,
  ) {
    const { title, firstName, lastName, email } = createAdminInviteDto;
    const { churchId } = authUser;
    const churchRoleObjectId = new Types.ObjectId(churchRole);
    const role = await this.rolesService.getRoleById(churchRoleObjectId);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const pendingInvites = await this.inviteModel.countDocuments({
      churchId,
      status: AdminInviteStatus.PENDING,
    });
    const currentUsers = await this.adminService.countAdminsByChurch(churchId);

    // Seats already used BEFORE this new invite - checkUserLimit blocks when
    // This is >= the plan limit, so don't add 1 for the invite being created
    // Here or every church gets blocked one seat early (e.g. owner + 1
    // Pending invite on a 3-seat plan would wrongly read as "3 of 3").
    const seatsUsed = currentUsers + pendingInvites;
    const userLimitCheck = await this.subscriptionService.checkUserLimit(
      churchId,
      seatsUsed,
    );

    if (!userLimitCheck.allowed) {
      throw new BadRequestException(
        userLimitCheck.message || 'User limit reached',
      );
    }

    const invite = await this.inviteModel.findOne({ email });

    if (invite) {
      throw new ConflictException('An invite has been sent to this user');
    }

    const [_, inviteResponse] = await Promise.all([
      await this.sendInviteEmail({
        churchId,
        title,
        firstName,
        lastName,
        email,
        churchRole: role.roleName,
        churchRoleId: churchRoleObjectId,
      }),
      await this.inviteModel.create({
        churchId,
        churchRole: churchRoleObjectId,
        ...createAdminInviteDto,
      }),
    ]);

    return inviteResponse;
  }

  async getUserLimitStatus(authUser: Admin) {
    const { churchId } = authUser;

    const pendingInvites = await this.inviteModel.countDocuments({
      churchId,
      status: AdminInviteStatus.PENDING,
    });
    const currentAdmins = await this.adminService.countAdminsByChurch(churchId);
    const currentUsers = currentAdmins + pendingInvites;

    const subscription =
      await this.subscriptionService.getActiveSubscription(churchId);
    const plan = subscription?.plan || PlanType.STARTER;
    const limit = await this.subscriptionService.getPlanUserLimit(plan);

    const percentage = limit > 0 ? (currentUsers / limit) * 100 : 0;
    const isOverLimit = limit > 0 && currentUsers >= limit;
    const isNearLimit = limit > 0 && percentage >= 80 && !isOverLimit;

    return {
      currentUsers,
      limit,
      percentage: Math.min(percentage, 100),
      isOverLimit,
      isNearLimit,
      planName: plan,
    };
  }

  async resendInvitation(authUser: Admin, inviteId: string) {
    const invite = await this.inviteModel.findById(inviteId);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== AdminInviteStatus.PENDING) {
      throw new BadRequestException(
        'This invitation has either been accepted or deleted',
      );
    }

    const { title, firstName, lastName, email, churchRole } = invite;
    const { churchId } = authUser;

    const churchRoleObjectId = new Types.ObjectId(churchRole);
    const role = await this.rolesService.getRoleById(churchRoleObjectId);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.sendInviteEmail({
      churchId,
      title,
      firstName,
      lastName,
      email,
      churchRole: role.roleName,
      churchRoleId: churchRoleObjectId,
    });

    return invite;
  }

  async fetchAllInvitations(authUser: Admin) {
    const { churchId } = authUser;
    return await this.inviteModel
      .find({ churchId })
      .populate('churchRole')
      .sort({ createdAt: -1 });
  }

  async deleteInvitation(inviteId: string) {
    const invite = await this.inviteModel.findById(inviteId);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== AdminInviteStatus.PENDING) {
      throw new BadRequestException(
        'You cannot delete an accepted or declined invitation',
      );
    }

    return await this.inviteModel.findByIdAndDelete(invite._id);
  }

  async acceptInvitation(email: string) {
    const invite = await this.inviteModel.findOne({ email });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== AdminInviteStatus.PENDING) {
      throw new BadRequestException(
        'This invitation has either been accepted or deleted',
      );
    }

    return await this.inviteModel.findByIdAndUpdate(
      invite._id,
      { status: AdminInviteStatus.ACTIVE },
      { new: true },
    );
  }

  async changeRole(inviteId: string, churchRole: string) {
    const churchRoleObjectId = new Types.ObjectId(churchRole);
    const role = await this.rolesService.getRoleById(churchRoleObjectId);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const invite = await this.inviteModel.findById(inviteId);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    const oldRole = await this.rolesService.getRoleById(invite.churchRole);
    const oldRoleName = oldRole.roleName;

    const [updatedInvite, _] = await Promise.all([
      this.inviteModel.findByIdAndUpdate(
        invite._id,
        { churchRole: role._id },
        { new: true },
      ),
      this.adminService.findOneAndUpdate(invite.email, {
        churchRole: role._id,
      }),
    ]);

    await this.sendInviteEmail({
      churchId: invite.churchId,
      title: invite.title,
      firstName: invite.firstName,
      lastName: invite.lastName,
      email: invite.email,
      churchRole: role.roleName,
      churchRoleId: role._id,
      type: InviteEmailType.ROLE_CHANGE,
      invitePending: invite.status === AdminInviteStatus.PENDING,
      previousRole: oldRoleName,
    });

    return updatedInvite;
  }

  async suspendOrRestoreUser(inviteId: string, option: AdminOptions) {
    const invite = await this.inviteModel.findById(inviteId);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status === AdminInviteStatus.PENDING) {
      throw new BadRequestException(
        'This invitation is still pending, therefore, you cannot suspend this user',
      );
    }

    return await this.inviteModel.findByIdAndUpdate(
      invite._id,
      {
        status:
          option === AdminOptions.SUSPEND
            ? AdminInviteStatus.SUSPENDED
            : AdminInviteStatus.ACTIVE,
      },
      { new: true },
    );
  }

  async removeUser(inviteId: string, key: string) {
    const invite = await this.inviteModel.findById(inviteId);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (key.toLowerCase() !== 'remove user') {
      throw new BadRequestException('Type "remove user" to delete this user');
    }

    await Promise.all([
      this.inviteModel.findByIdAndDelete(invite._id),
      this.adminService.findOneAndDelete(invite.email),
    ]);

    return { message: 'User removed successfully' };
  }

  async viewAdminDetails(inviteId: string) {
    const invite = await this.inviteModel.findById(inviteId);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== AdminInviteStatus.ACTIVE) {
      throw new BadRequestException('This invitation has not been accepted');
    }

    const admin = await this.adminService.findOne(invite.email);

    if (!admin) {
      throw new NotFoundException(
        'This user has not accepted the invitation to be an admin',
      );
    }

    const role = await this.rolesService.getRoleById(admin.churchRole);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      roleName: role.roleName,
      role,
    };
  }
}

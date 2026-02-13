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
} from '../../common/utils/enums.utils';

@Injectable()
export class AdminInviteService {
  constructor(
    @InjectModel(Invite.name) private inviteModel: Model<Invite>,
    private churchService: ChurchService,
    private adminService: AdminService,
    private emailService: EmailService,
    private rolesService: RolesService,
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

    const inviteUrl = `${FRONTEND_URL}?token=${token}`;
    const accountUrl = FRONTEND_URL;

    const isRoleChange = type === InviteEmailType.ROLE_CHANGE;

    const heading = isRoleChange
      ? 'Your role has been updated'
      : "You've been invited 🎉";

    const intro = isRoleChange
      ? `${churchName} has updated your role on <strong>Church Workflow</strong>.`
      : `${churchName} has invited you to join their church management system on <strong>Church Workflow</strong>.`;

    const buttonText = invitePending ? 'Accept Invitation' : 'Go to Workspace';
    const buttonLink = invitePending ? inviteUrl : accountUrl;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="UTF-8" />
      <title>Church Workflow</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; } body { background: #F7F7F8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #000000; line-height: 1.5; } .email-wrapper { max-width: 640px; margin: 40px auto; background: #ffffff; } .header { background-color: #0C5FB3; padding: 28px 32px; text-align: center; } .logo-image { height: 42px; width: auto; display: inline-block; } .content { padding: 48px 48px 40px; text-align: center; } .content h1 { font-size: 26px; font-weight: 700; margin-bottom: 24px; } .content p { font-size: 16px; margin-bottom: 16px; } .role { color: #0C5FB3; font-weight: 600; font-size: 18px; margin-top: 4px; } .button-wrapper { margin: 32px 0; background-color: #0C5FB3; padding: 14px 28px; border-radius: 8px; } .btn { color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 16px; display: block; width: 100%; } p { font-size: 14px; color: #000000; margin-top: 24px; } .fine-print { font-size: 14px; color: #737373; margin-top: 24px; } .footer { text-align: center; padding: 0 40px 40px; font-size: 13px; color: #737373; } .footer a { color: #0C5FB3; text-decoration: none; } .copyright { margin-top: 16px; font-size: 12px; }
      </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <img
              src="https://res.cloudinary.com/dlw6sowno/image/upload/v1769148983/cw-logo_apjjxi.png"
              alt="Church Workflow"
              class="logo-image"
            />
          </div>

          <div class="content">
            <h1>${heading}</h1>

            <p>${hasName ? `Dear ${name},` : ''}</p>

            <p>${intro}</p>

            <p>Your current role:</p>
            <div class="role">${churchRole}</div>

            ${
              previousRole
                ? `<p class="fine-print">Previous role: ${previousRole}</p>`
                : ''
            }

            ${
              invitePending
                ? `
            <p>
              You have not yet accepted your invitation. Once you accept, you will
              have access based on this role.
            </p>`
                : ''
            }

            <div class="button-wrapper">
              <a href="${buttonLink}" class="btn">${buttonText}</a>
            </div>

            <p class="fine-print">
              If you did not expect this, please contact your administrator.
            </p>
          </div>

          <div class="footer">
            <p>This notification was sent by ${churchName} via Church Workflow.</p>

            <p>
              <a href="https://www.churchworkflow.com" target="_blank" rel="noopener noreferrer">
                www.churchworkflow.com
              </a>
            </p>

            <div class="copyright">
              © ${new Date().getFullYear()} Church Workflow. All rights reserved.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

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
    return await this.inviteModel.find({ churchId }).sort({ createdAt: -1 });
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

import { AdminInviteStatus } from './../../common/utils/enums.utils';
import {
  BadRequestException,
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
import { encryptInvite } from '../../common/helpers/crypto.helper';
import { InvitePayload } from '../../common/utils/types.utils';

@Injectable()
export class AdminInviteService {
  constructor(
    @InjectModel(Invite.name) private inviteModel: Model<Invite>,
    private churchService: ChurchService,
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
  }: InvitePayload) {
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

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Church Workflow Invitation</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            background: #F7F7F8;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
              Roboto, Helvetica, Arial, sans-serif;
            color: #000000;
            line-height: 1.5;
          }

          .email-wrapper {
            max-width: 640px;
            margin: 40px auto;
            background: #ffffff;
          }

          .header {
            background-color: #0C5FB3;
            padding: 28px 32px;
            text-align: center;
          }

          .logo-image {
            height: 42px;
            width: auto;
            display: inline-block;
          }

          .content {
            padding: 48px 48px 40px;
            text-align: center;
          }

          .content h1 {
            font-size: 26px;
            font-weight: 700;
            margin-bottom: 24px;
          }

          .content p {
            font-size: 16px;
            margin-bottom: 16px;
          }

          .role {
            color: #0C5FB3;
            font-weight: 600;
            font-size: 18px;
            margin-top: 4px;
          }

          .button-wrapper {
            margin: 32px 0;
            background-color: #0C5FB3;
            padding: 14px 28px;
            border-radius: 8px;
          }

          .btn {
            color: #ffffff !important;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            display: block;
            width: 100%;
          }

          p {
            font-size: 14px;
            color: #000000;
            margin-top: 24px;
          }

          .fine-print {
            font-size: 14px;
            color: #737373;
            margin-top: 24px;
          }

          .footer {
            text-align: center;
            padding: 0 40px 40px;
            font-size: 13px;
            color: #737373;
          }

          .footer a {
            color: #0C5FB3;
            text-decoration: none;
          }

          .copyright {
            margin-top: 16px;
            font-size: 12px;
          }
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
            <h1>You've been invited 🎉</h1>

            <p>${hasName ? `Dear ${name},` : ''}</p>

            <p>
              ${churchName} has invited you to join their church management
              system on <strong>Church Workflow</strong>.
            </p>

            <p>You've been assigned the role of:</p>
            <div class="role">${churchRole}</div>

            <div class="button-wrapper">
              <a href="${inviteUrl}" class="btn">Accept Invitation</a>
            </div>

            <p>
              By accepting this invitation, you'll be able to access ${churchName}'s workspace and perform actions based on your assigned
              role.
            </p>

            <p class="fine-print">
              If you weren't expecting this invitation, you can safely ignore
              this email.
            </p>
          </div>

          <div class="footer">
            <p>This invitation was sent by ${churchName} via Church Workflow.</p>

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

    await this.emailService.sendEmail(email, 'Admin Invitation', html);
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

    const isAccepted = invite.status === AdminInviteStatus.ACCEPTED;
    const isDeclined = invite.status === AdminInviteStatus.DECLINED;

    if (isAccepted || isDeclined) {
      throw new BadRequestException(
        `This invitation has been ${isAccepted ? 'accepted' : 'declined'}`,
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
}

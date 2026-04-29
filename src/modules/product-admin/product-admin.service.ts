import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { ProductAdmin } from '../../schemas/product-admin.schema';
import { ProductAdminRolesService } from '../product-admin-roles/product-admin-roles.service';
import { ProductAdminInvite } from '../../schemas/product-admin-invite.schema';
import {
  paginationMeta,
  PaginationBaseDto,
} from '../../common/helpers/pagination.helper';
import {
  DefaultProductAdminRoles,
  ProductAdminInviteStatus,
  ProductAdminStatus,
} from '../../common/utils/enums.utils';
import { EmailService } from '../email/email.service';

@Injectable()
export class ProductAdminService implements OnModuleInit {
  constructor(
    @InjectModel(ProductAdmin.name)
    private productAdminModel: Model<ProductAdmin>,
    @InjectModel(ProductAdminInvite.name)
    private inviteModel: Model<ProductAdminInvite>,
    private configService: ConfigService,
    private rolesService: ProductAdminRolesService,
    private emailService: EmailService,
  ) {}

  async onModuleInit() {
    await this.rolesService.seedDefaultRoles();

    const count = await this.productAdminModel.countDocuments();
    if (count === 0) {
      const name = this.configService.get<string>('productAdmin.seedName');
      const email = this.configService.get<string>('productAdmin.seedEmail');
      const password = this.configService.get<string>(
        'productAdmin.seedPassword',
      );

      const hashed = bcrypt.hashSync(password, 10);

      const superRole = await this.rolesService.findByName(
        DefaultProductAdminRoles.SUPER_ADMIN,
      );

      await this.productAdminModel.create({
        name,
        email,
        password: hashed,
        role: superRole?._id,
      });
    }
  }

  async findOne(email: string) {
    return await this.productAdminModel.findOne({ email });
  }

  async findById(id: string) {
    return await this.productAdminModel.findById(id).populate('role');
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.findOne(email);
    if (!user) {
      return null;
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return null;
    }

    const { password: _, ...rest } = user.toObject();
    return rest as unknown as ProductAdmin;
  }

  async inviteAdmin(email: string, roleId: string) {
    const role = await this.rolesService.findById(roleId);
    if (!role) {
      throw new BadRequestException('Invalid role');
    }

    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await this.inviteModel.create({
      email,
      role: new Types.ObjectId(roleId),
      token,
      expiresAt,
    });

    const frontendUrl = process.env.PRODUCT_ADMIN_FRONTEND_URL;
    const baseUrl = frontendUrl.replace(/\/$/, '');
    const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="UTF-8" />
      <title>Church Workflow</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; } 
        body { background: #F7F7F8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #000000; line-height: 1.5; } 
        .email-wrapper { max-width: 640px; margin: 40px auto; background: #ffffff; } 
        .header { background-color: #0C5FB3; padding: 28px 32px; text-align: center; } 
        .logo-image { height: 42px; width: auto; display: inline-block; } 
        .content { padding: 48px 48px 40px; text-align: center; } 
        .content h1 { font-size: 26px; font-weight: 700; margin-bottom: 24px; } 
        .content p { font-size: 16px; margin-bottom: 16px; } 
        .role { color: #0C5FB3; font-weight: 600; font-size: 18px; margin-top: 4px; } 
        .button-wrapper { margin: 32px 0; display: inline-block; background-color: #0C5FB3; border-radius: 8px; } 
        .btn { color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 16px; display: block; padding: 14px 28px; } 
        .fine-print { font-size: 14px; color: #737373; margin-top: 24px; } 
        .footer { text-align: center; padding: 0 40px 40px; font-size: 13px; color: #737373; } 
        .footer a { color: #0C5FB3; text-decoration: none; } 
        .copyright { margin-top: 16px; font-size: 12px; }
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

            <p>You have been invited to join the <strong>Church Workflow</strong> product administration panel.</p>

            <p>Your assigned role:</p>
            <div class="role">${role.name.replace(/_/g, ' ')}</div>

            <div class="button-wrapper">
              <a href="${inviteUrl}" class="btn">Accept Invitation</a>
            </div>

            <p class="fine-print">
              This invitation expires in 7 days. If you did not expect this, please contact your administrator.
            </p>
          </div>

          <div class="footer">
            <p>This notification was sent via Church Workflow.</p>

            <p>
              <a href="https://admin.churchworkflow.com" target="_blank" rel="noopener noreferrer">
                app.churchworkflow.com
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

    await this.emailService.sendEmail(email, 'Product Admin Invitation', html);

    return invite;
  }

  async acceptInvite(token: string, name: string, password: string) {
    const invite = await this.inviteModel.findOne({
      token,
      status: ProductAdminInviteStatus.PENDING,
    });
    if (!invite) {
      throw new Error('Invalid or expired invite');
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new Error('Invite expired');
    }

    const hashed = bcrypt.hashSync(password, 10);

    const created = await this.productAdminModel.create({
      name,
      email: invite.email,
      password: hashed,
      role: invite.role,
    });

    invite.status = ProductAdminInviteStatus.ACCEPTED;
    await invite.save();

    const { password: _, ...rest } = created.toObject();
    return rest;
  }

  async blockAdmin(id: string) {
    return this.productAdminModel.findByIdAndUpdate(
      id,
      { status: ProductAdminStatus.BLOCKED },
      { new: true },
    );
  }

  async unblockAdmin(id: string) {
    return this.productAdminModel.findByIdAndUpdate(
      id,
      { status: ProductAdminStatus.ACTIVE },
      { new: true },
    );
  }

  async stats() {
    const total = await this.productAdminModel.countDocuments();
    const active = await this.productAdminModel.countDocuments({
      status: ProductAdminStatus.ACTIVE,
    });
    const blocked = await this.productAdminModel.countDocuments({
      status: ProductAdminStatus.BLOCKED,
    });
    const superRole = await this.rolesService.findByName(
      DefaultProductAdminRoles.SUPER_ADMIN,
    );
    const superCount = superRole
      ? await this.productAdminModel.countDocuments({ role: superRole._id })
      : 0;

    return { total, active, blocked, superAdmins: superCount };
  }

  async list(
    filter: PaginationBaseDto & { role?: string; status?: string },
  ): Promise<{
    data: any[];
    pagination: any;
  }> {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filter.role) {
      query.role = new Types.ObjectId(filter.role);
    }
    if (filter.status) {
      query.status = filter.status;
    }

    const [data, itemCount] = await Promise.all([
      this.productAdminModel
        .find(query)
        .populate('role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.productAdminModel.countDocuments(query),
    ]);

    const adminData = data.map((admin) => {
      const { password: _, ...rest } = admin;
      return rest;
    });

    return {
      data: adminData,
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }
}

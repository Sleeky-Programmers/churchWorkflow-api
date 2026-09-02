import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';

import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import {
  DefaultProductAdminRoles,
  ProductAdminInviteStatus,
  ProductAdminStatus,
} from '../../common/utils/enums.utils';
import { ProductAdminInvite } from '../../schemas/product-admin-invite.schema';
import { ProductAdmin } from '../../schemas/product-admin.schema';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';
import { EmailService } from '../email/email.service';
import { renderEmailLayout } from '../email/templates/email-layout.template';
import { ProductAdminRolesService } from '../product-admin-roles/product-admin-roles.service';
import { ProductAdminLoginDto } from './dto/login.dto';

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
    private jwtService: JwtService,
  ) {}

  generateTokens(userId: Types.ObjectId) {
    const accessToken = this.jwtService.sign(
      { sub: userId },
      {
        expiresIn: this.configService.getOrThrow('productAdmin.jwtExpiresIn'),
        secret: this.configService.getOrThrow('productAdmin.jwtSecret'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.getOrThrow('productAdmin.jwtRefreshSecret'),
        expiresIn: this.configService.getOrThrow(
          'productAdmin.jwtRefreshExpiresIn',
        ),
      },
    );

    return { accessToken, refreshToken };
  }

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
    return await this.productAdminModel
      .findOne({ email: email.toLowerCase().trim() })
      .populate('role', 'name permissions -_id');
  }

  async findByEmail(email: string) {
    return await this.productAdminModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+password');
  }

  async findById(id: string) {
    return await this.productAdminModel.findById(id).populate('role');
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.findByEmail(email);
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

  async login(dto: ProductAdminLoginDto) {
    try {
      const user = await this.validateCredentials(dto.email, dto.password);

      if (!user) {
        throw new BadRequestException('Invalid credentials');
      }

      const { accessToken, refreshToken } = this.generateTokens(user._id);

      const role = await this.rolesService.findById(user.role.toString());
      if (!role) {
        throw new BadRequestException('Invalid role');
      }

      return {
        message: 'Login successful',
        user,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    let payload: any;

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const tokens = this.generateTokens(user._id);

    return tokens;
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

    const html = renderEmailLayout({
      previewText: "You've been invited to Church Workflow",
      heading: "You've been invited 🎉",
      paragraphs: [
        'You have been invited to join the <strong>Church Workflow</strong> product administration panel.',
        'Your assigned role:',
      ],
      highlight: role.name.replace(/_/g, ' '),
      button: { text: 'Accept Invitation', link: inviteUrl },
      fineprint:
        'This invitation expires in 7 days. If you did not expect this, please contact your administrator.',
      footerLinkUrl: 'https://admin.churchworkflow.com',
      footerLinkLabel: 'app.churchworkflow.com',
    });

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

  async updateAdminProfile(
    id: Types.ObjectId,
    updateData: Partial<ProductAdmin>,
  ) {
    const updated = await this.productAdminModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            ...updateData,
            ...(updateData.email && {
              email: updateData.email.toLowerCase().trim(),
            }),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Product Admin not found');
    }

    return {
      id: updated._id.toString(),
      firstName: updated.name,
      email: updated.email,
    };
  }

  async resetPassword(authUser: ProductAdmin, dto: ResetPasswordDto) {
    const { newPassword, confirmNewPassword } = dto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    await this.productAdminModel.findByIdAndUpdate(authUser._id, {
      password: bcrypt.hashSync(newPassword, 10),
    });

    return { message: 'Password reset successful' };
  }
}

import { randomBytes } from 'crypto';

import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';

import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Church } from '../../schemas/church.schema';
import { TimerSession } from '../../schemas/timer-session.schema';
import { TimerSettings } from '../../schemas/timer-settings.schema';
import { TimerTemplate } from '../../schemas/timer-template.schema';
import { FileUploadService } from '../file-upload/file-upload.service';
import { UpdateTimerSettingsDto } from './dto/timer-settings.dto';
import { TimerSessionDto } from './dto/timer-session.dto';
import { TimerTemplateDto } from './dto/timer-template.dto';
import {
  afterFailedPin,
  pinLockMinutesLeft,
  tidySession,
  TimerPrincipal,
} from './service-timer.access';
import { ServiceTimerEvents } from './service-timer.events';

/** One branch's timer. */
export interface TimerScope {
  churchId: Types.ObjectId;
  branchId: Types.ObjectId;
}

interface OperatorTokenPayload {
  kind: 'timer-operator';
  churchId: string;
  branchId: string;
  pinVersion: number;
}

const OPERATOR_TOKEN_TTL = '12h';

const newDisplayToken = () => randomBytes(18).toString('base64url');

@Injectable()
export class ServiceTimerService {
  constructor(
    @InjectModel(TimerSettings.name)
    private settingsModel: Model<TimerSettings>,
    @InjectModel(TimerTemplate.name)
    private templateModel: Model<TimerTemplate>,
    @InjectModel(TimerSession.name)
    private sessionModel: Model<TimerSession>,
    @InjectModel(Church.name)
    private churchModel: Model<Church>,
    private fileUploadService: FileUploadService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private events: ServiceTimerEvents,
  ) {}

  /** The timer for the admin's active branch. */
  scopeFor(tenant: TenantContext): TimerScope {
    if (!tenant.branchId) {
      throw new BadRequestException(
        'No active branch selected. Switch to a branch and try again.',
      );
    }
    return { churchId: tenant.churchId, branchId: tenant.branchId };
  }

  scopeOf(p: TimerPrincipal): TimerScope {
    return {
      churchId: new Types.ObjectId(p.churchId),
      branchId: new Types.ObjectId(p.branchId),
    };
  }

  // ---------------------------------------------------------------- settings

  /** Settings for a branch, created with defaults the first time. */
  async getSettingsDoc(scope: TimerScope) {
    return this.settingsModel.findOneAndUpdate(
      scope,
      { $setOnInsert: { ...scope, displayToken: newDisplayToken() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  /** Settings as the client sees them, with the church's name and logo as fallbacks. */
  private async present(doc: TimerSettings, opts: { withToken: boolean }) {
    const church = await this.churchModel
      .findById(doc.churchId)
      .select('name logoUrl')
      .lean();
    const hasPin = await this.settingsModel.exists({
      _id: doc._id,
      operatorPinHash: { $ne: null },
    });
    return {
      churchName: doc.churchName ?? church?.name ?? '',
      churchNameOverride: doc.churchName,
      serviceStart: doc.serviceStart,
      warnMin: doc.warnMin,
      keepRunning: doc.keepRunning,
      shortcuts: doc.shortcuts,
      font: doc.font,
      colors: doc.colors,
      show: doc.show,
      logoUrl: doc.logoUrl ?? church?.logoUrl ?? null,
      hasOwnLogo: !!doc.logoUrl,
      hasPin: !!hasPin,
      ...(opts.withToken ? { displayToken: doc.displayToken } : {}),
    };
  }

  async getSettings(scope: TimerScope) {
    return this.present(await this.getSettingsDoc(scope), { withToken: true });
  }

  async updateSettings(scope: TimerScope, dto: UpdateTimerSettingsDto) {
    await this.getSettingsDoc(scope);
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) {
        continue;
      }
      if (key === 'colors' || key === 'show') {
        // Patch single colours / toggles without resetting the rest.
        for (const [k, v] of Object.entries(value as object)) {
          if (v !== undefined) {
            set[`${key}.${k}`] = v;
          }
        }
      } else if (key === 'churchName') {
        set.churchName = (value as string | null)?.trim() || null;
      } else {
        set[key] = value;
      }
    }
    const doc = await this.settingsModel.findOneAndUpdate(
      scope,
      { $set: set },
      { new: true },
    );
    return this.publishSettings(scope, doc);
  }

  async uploadLogo(scope: TimerScope, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Attach an image as "file".');
    }
    const current = await this.getSettingsDoc(scope);
    const { url, publicId } = await this.fileUploadService.uploadFile(file);
    const doc = await this.settingsModel.findOneAndUpdate(
      scope,
      { $set: { logoUrl: url, logoPublicId: publicId } },
      { new: true },
    );
    if (current.logoPublicId) {
      await this.fileUploadService
        .deleteFile(current.logoPublicId)
        .catch(() => {
          // An orphaned image in storage is not worth failing the upload for.
        });
    }
    return this.publishSettings(scope, doc);
  }

  async removeLogo(scope: TimerScope) {
    const current = await this.getSettingsDoc(scope);
    const doc = await this.settingsModel.findOneAndUpdate(
      scope,
      { $set: { logoUrl: null, logoPublicId: null } },
      { new: true },
    );
    if (current.logoPublicId) {
      await this.fileUploadService
        .deleteFile(current.logoPublicId)
        .catch(() => {
          // Already gone or storage unavailable: the setting is cleared anyway.
        });
    }
    return this.publishSettings(scope, doc);
  }

  private async publishSettings(scope: TimerScope, doc: TimerSettings) {
    const forClients = await this.present(doc, { withToken: false });
    this.events.emitToBranch(
      String(scope.churchId),
      String(scope.branchId),
      'settings',
      { settings: forClients },
    );
    return this.present(doc, { withToken: true });
  }

  // ------------------------------------------------- operator PIN and links

  async setOperatorPin(scope: TimerScope, pin: string) {
    await this.getSettingsDoc(scope);
    await this.settingsModel.updateOne(scope, {
      $set: {
        operatorPinHash: await bcrypt.hash(pin, 10),
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
      $inc: { pinVersion: 1 },
    });
    await this.events.disconnectGuests(
      String(scope.churchId),
      String(scope.branchId),
    );
    return { hasPin: true };
  }

  async clearOperatorPin(scope: TimerScope) {
    await this.getSettingsDoc(scope);
    await this.settingsModel.updateOne(scope, {
      $set: {
        operatorPinHash: null,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
      $inc: { pinVersion: 1 },
    });
    await this.events.disconnectGuests(
      String(scope.churchId),
      String(scope.branchId),
    );
    return { hasPin: false };
  }

  /** A new display link. Old links, and PIN sessions opened from them, stop working. */
  async rotateDisplayToken(scope: TimerScope) {
    await this.getSettingsDoc(scope);
    const displayToken = newDisplayToken();
    await this.settingsModel.updateOne(scope, {
      $set: { displayToken },
      $inc: { pinVersion: 1 },
    });
    await this.events.disconnectGuests(
      String(scope.churchId),
      String(scope.branchId),
    );
    return { displayToken };
  }

  async findByDisplayToken(displayToken: string) {
    const doc = await this.settingsModel.findOne({ displayToken });
    if (!doc) {
      throw new NotFoundException(
        'This display link is not valid. Ask your timer admin for the current link.',
      );
    }
    return doc;
  }

  /** What a display (no login) needs: the look and the live session. */
  async publicSnapshot(displayToken: string) {
    const doc = await this.findByDisplayToken(displayToken);
    const scope = { churchId: doc.churchId, branchId: doc.branchId };
    return {
      settings: await this.present(doc, { withToken: false }),
      session: await this.getSession(scope),
      serverNow: Date.now(),
    };
  }

  private operatorSecret() {
    return `${this.configService.get<string>('jwt.secret')}:service-timer-operator`;
  }

  /** Exchanges the operator PIN for a short-lived token that can only run the timer. */
  async operatorLogin(displayToken: string, pin: string) {
    const doc = await this.settingsModel
      .findOne({ displayToken })
      .select('+operatorPinHash');
    if (!doc) {
      throw new NotFoundException(
        'This display link is not valid. Ask your timer admin for the current link.',
      );
    }
    if (!doc.operatorPinHash) {
      throw new ForbiddenException(
        'No operator PIN has been set. Ask your timer admin to set one, or sign in.',
      );
    }
    const now = Date.now();
    const wait = pinLockMinutesLeft(doc.pinLockedUntil, now);
    if (wait) {
      throw new HttpException(
        `Too many wrong PINs. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!(await bcrypt.compare(pin, doc.operatorPinHash))) {
      await this.settingsModel.updateOne(
        { _id: doc._id },
        { $set: afterFailedPin(doc.failedPinAttempts, now) },
      );
      throw new UnauthorizedException('That PIN is not right.');
    }
    await this.settingsModel.updateOne(
      { _id: doc._id },
      { $set: { failedPinAttempts: 0, pinLockedUntil: null } },
    );
    const payload: OperatorTokenPayload = {
      kind: 'timer-operator',
      churchId: String(doc.churchId),
      branchId: String(doc.branchId),
      pinVersion: doc.pinVersion,
    };
    const operatorToken = await this.jwtService.signAsync(payload, {
      secret: this.operatorSecret(),
      expiresIn: OPERATOR_TOKEN_TTL,
    });
    return { operatorToken, expiresIn: OPERATOR_TOKEN_TTL };
  }

  /** Checks an operator token is genuine and its PIN and link are still current. */
  async verifyOperatorToken(token: string): Promise<TimerPrincipal> {
    let payload: OperatorTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.operatorSecret(),
      });
    } catch {
      throw new UnauthorizedException(
        'Your operator session has ended. Enter the PIN again.',
      );
    }
    if (payload.kind !== 'timer-operator') {
      throw new UnauthorizedException('Not an operator token.');
    }
    const doc = await this.settingsModel
      .findOne({ churchId: payload.churchId, branchId: payload.branchId })
      .select('+operatorPinHash');
    if (!doc || !doc.operatorPinHash || doc.pinVersion !== payload.pinVersion) {
      throw new UnauthorizedException(
        'The operator PIN or display link has changed. Enter the PIN again.',
      );
    }
    return {
      kind: 'operator',
      churchId: payload.churchId,
      branchId: payload.branchId,
      canControl: true,
      canManage: false,
    };
  }

  // --------------------------------------------------------------- templates

  private presentTemplate(t: TimerTemplate) {
    return {
      id: String(t._id),
      name: t.name,
      serviceStart: t.serviceStart,
      items: t.items.map((i) => ({
        name: i.name,
        person: i.person ?? '',
        minutes: i.minutes,
      })),
      updatedAt: (t as unknown as { updatedAt?: Date }).updatedAt,
    };
  }

  async listTemplates(churchId: Types.ObjectId) {
    const docs = await this.templateModel.find({ churchId }).sort({ name: 1 });
    return docs.map((t) => this.presentTemplate(t));
  }

  private async publishTemplates(churchId: Types.ObjectId) {
    const templates = await this.listTemplates(churchId);
    this.events.emitToChurch(String(churchId), 'templates', { templates });
    return templates;
  }

  private templateFields(dto: TimerTemplateDto, adminId: Types.ObjectId) {
    const name = dto.name.trim();
    return {
      name,
      nameKey: name.toLowerCase(),
      serviceStart: dto.serviceStart,
      items: dto.items.map((i) => ({
        name: i.name,
        person: i.person ?? '',
        minutes: i.minutes,
      })),
      updatedBy: adminId,
    };
  }

  private nameTaken(err: unknown, name: string) {
    if ((err as { code?: number })?.code === 11000) {
      return new ConflictException(
        `A template called "${name.trim()}" already exists. Replace it instead.`,
      );
    }
    return err;
  }

  async createTemplate(
    churchId: Types.ObjectId,
    adminId: Types.ObjectId,
    dto: TimerTemplateDto,
  ) {
    let doc: TimerTemplate;
    try {
      doc = await this.templateModel.create({
        churchId,
        ...this.templateFields(dto, adminId),
      });
    } catch (err) {
      throw this.nameTaken(err, dto.name);
    }
    await this.publishTemplates(churchId);
    return this.presentTemplate(doc);
  }

  async updateTemplate(
    churchId: Types.ObjectId,
    adminId: Types.ObjectId,
    id: string,
    dto: TimerTemplateDto,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Template not found');
    }
    let doc: TimerTemplate | null;
    try {
      doc = await this.templateModel.findOneAndUpdate(
        { _id: id, churchId },
        { $set: this.templateFields(dto, adminId) },
        { new: true },
      );
    } catch (err) {
      throw this.nameTaken(err, dto.name);
    }
    if (!doc) {
      throw new NotFoundException('Template not found');
    }
    await this.publishTemplates(churchId);
    return this.presentTemplate(doc);
  }

  async deleteTemplate(churchId: Types.ObjectId, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Template not found');
    }
    const res = await this.templateModel.deleteOne({ _id: id, churchId });
    if (!res.deletedCount) {
      throw new NotFoundException('Template not found');
    }
    await this.publishTemplates(churchId);
    return { deleted: true };
  }

  // ----------------------------------------------------------- live session

  private presentSession(s: TimerSession) {
    return {
      items: s.items.map((i) => ({
        id: i.id,
        name: i.name,
        person: i.person ?? '',
        minutes: i.minutes,
      })),
      index: s.index,
      timer: {
        running: s.timer?.running ?? false,
        startedAt: s.timer?.startedAt ?? null,
        elapsedBefore: s.timer?.elapsedBefore ?? 0,
        extraMs: s.timer?.extraMs ?? 0,
      },
      message: {
        text: s.message?.text ?? '',
        shown: s.message?.shown ?? false,
      },
      serviceStart: s.serviceStart,
      version: s.version,
      origin: s.origin,
    };
  }

  /** The branch's live session, created empty the first time. */
  async getSession(scope: TimerScope) {
    const existing = await this.sessionModel.findOne(scope);
    if (existing) {
      return this.presentSession(existing);
    }
    const settings = await this.getSettingsDoc(scope);
    const doc = await this.sessionModel.findOneAndUpdate(
      scope,
      { $setOnInsert: { ...scope, serviceStart: settings.serviceStart } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return this.presentSession(doc);
  }

  /**
   * Saves a controller's session and sends it to every device in the
   * branch. The latest write wins, as in the prototype: a device that comes
   * back with unsent changes sends them, rather than being overwritten.
   */
  async pushSession(
    scope: TimerScope,
    dto: TimerSessionDto,
    updatedBy: Types.ObjectId | null,
  ) {
    const s = tidySession(dto);
    const doc = await this.sessionModel.findOneAndUpdate(
      scope,
      {
        $set: {
          items: s.items,
          index: s.index,
          timer: s.timer,
          message: s.message,
          serviceStart: s.serviceStart,
          origin: s.origin,
          updatedBy,
        },
        $inc: { version: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const session = this.presentSession(doc);
    this.events.emitToBranch(
      String(scope.churchId),
      String(scope.branchId),
      'session',
      { session },
    );
    return { version: session.version, serverNow: Date.now() };
  }

  /** Everything a controller needs on first load. */
  async bootstrap(scope: TimerScope) {
    const [settings, templates, session] = await Promise.all([
      this.getSettings(scope),
      this.listTemplates(scope.churchId),
      this.getSession(scope),
    ]);
    return { settings, templates, session, serverNow: Date.now() };
  }

  /** What a device gets when its socket connects. */
  async snapshotFor(p: TimerPrincipal) {
    const scope = this.scopeOf(p);
    const doc = await this.getSettingsDoc(scope);
    return {
      settings: await this.present(doc, { withToken: p.kind === 'admin' }),
      session: await this.getSession(scope),
      templates:
        p.kind === 'display' ? [] : await this.listTemplates(scope.churchId),
      access: {
        kind: p.kind,
        canControl: p.canControl,
        canManage: p.canManage,
      },
      serverNow: Date.now(),
    };
  }
}

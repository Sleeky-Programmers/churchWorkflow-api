import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as mammoth from 'mammoth';
import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';

import { TimerPlanService } from '../billing/timer-plan.service';
import {
  TimerImport,
  TimerImportSource,
  TimerImportStatus,
} from '../../../schemas/timer-import.schema';
import {
  EXTRACTION_INSTRUCTION,
  EXTRACTION_SYSTEM,
  ExtractedProgram,
  monthBounds,
  ProgramSchema,
  tidyProgram,
} from './program-extraction';

/** The Anthropic client, or null when ANTHROPIC_API_KEY isn't set. */
export const ANTHROPIC_CLIENT = 'ANTHROPIC_CLIENT';

export const PDF = 'application/pdf';
export const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
export const IMPORT_MIME_TYPES = [PDF, DOCX, ...IMAGE_TYPES];

/** Longest Word-document text sent as is; anything longer isn't one programme. */
const MAX_TEXT_CHARS = 50_000;

const UNREADABLE =
  "We couldn't find an order of service in that upload. Try a clearer photo, a PDF, or paste the program as text.";

type ImportInput = { file?: Express.Multer.File; text?: string };
type UserContent = Anthropic.Beta.BetaContentBlockParam;

// Built once: zod's types are too deep for TypeScript to infer inline.
const PROGRAM_FORMAT = betaZodOutputFormat(ProgramSchema);

/** The parts of the parsed response this service reads. */
interface ParsedProgramMessage {
  model: string;
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
  parsed_output: ExtractedProgram | null;
}

export interface ImportUsage {
  used: number;
  limit: number;
  resetsOn: string;
}

/**
 * Smart import (Product Plan, section 4): one Claude request turns an
 * uploaded order of service into program items for the church to review.
 * Nothing is saved as a template here; the review screen does that.
 */
@Injectable()
export class TimerImportService {
  private readonly logger = new Logger(TimerImportService.name);

  constructor(
    @InjectModel(TimerImport.name)
    private importModel: Model<TimerImport>,
    private plans: TimerPlanService,
    private config: ConfigService,
    @Optional()
    @Inject(ANTHROPIC_CLIENT)
    private client: Anthropic | null,
  ) {}

  private get model() {
    return this.config.get<string>('TIMER_IMPORT_MODEL') || 'claude-opus-5-5';
  }

  private get effort() {
    const e = this.config.get<string>('TIMER_IMPORT_EFFORT');
    return (
      (['low', 'medium', 'high'] as const).find((x) => x === e) ?? 'medium'
    );
  }

  /**
   * Successful imports this month against the church's plan: Free 1,
   * Church 30, Church Workflow fair use (Product Plan, section 7).
   * A limit of 0 means unlimited.
   */
  async usage(
    churchId: Types.ObjectId,
  ): Promise<ImportUsage & { plan: string }> {
    const { start, next } = monthBounds(new Date());
    const [plan, used] = await Promise.all([
      this.plans.planFor(churchId),
      this.importModel.countDocuments({
        churchId,
        status: TimerImportStatus.SUCCEEDED,
        createdAt: { $gte: start },
      }),
    ]);
    return {
      used,
      limit: plan.importLimit,
      resetsOn: next.toISOString(),
      plan: plan.key,
    };
  }

  async extract(
    churchId: Types.ObjectId,
    adminId: Types.ObjectId,
    input: ImportInput,
  ) {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "Smart import isn't set up on this server yet.",
      );
    }
    const usage = await this.usage(churchId);
    if (usage.limit > 0 && usage.used >= usage.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: 'IMPORT_LIMIT_REACHED',
          message:
            usage.plan === 'FREE'
              ? "You've used this month's free import. Upgrade to the Church plan for more, or add the program by hand."
              : `You've used all ${usage.limit} imports for this month. Add the program by hand, or wait until next month.`,
          usage,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const { content, source } = await this.toContent(input);
    const record = (status: TimerImportStatus, extra: Partial<TimerImport>) =>
      this.importModel.create({
        churchId,
        adminId,
        source,
        fileName: input.file?.originalname ?? null,
        status,
        aiModel: this.model,
        ...extra,
      });

    let response: ParsedProgramMessage;
    try {
      response = await this.request(content);
    } catch (err) {
      await record(TimerImportStatus.FAILED, { error: describe(err) });
      throw this.toHttpError(err);
    }

    const tokens = {
      aiModel: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
    const parsed = response.parsed_output;
    if (
      response.stop_reason === 'refusal' ||
      response.stop_reason === 'max_tokens' ||
      !parsed ||
      !parsed.readable
    ) {
      await record(TimerImportStatus.UNREADABLE, {
        ...tokens,
        error: `stop_reason=${response.stop_reason}, readable=${parsed?.readable}`,
      });
      throw new UnprocessableEntityException(UNREADABLE);
    }

    const program = tidyProgram(parsed);
    if (!program.items.length) {
      await record(TimerImportStatus.UNREADABLE, {
        ...tokens,
        error: 'no items',
      });
      throw new UnprocessableEntityException(UNREADABLE);
    }

    await record(TimerImportStatus.SUCCEEDED, {
      ...tokens,
      itemCount: program.items.length,
    });
    return { ...program, usage: { ...usage, used: usage.used + 1 } };
  }

  private request(content: UserContent[]): Promise<ParsedProgramMessage> {
    return this.client!.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      // A policy decline is rerouted to a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: EXTRACTION_SYSTEM,
      output_config: {
        effort: this.effort,
        format: PROGRAM_FORMAT,
      },
      messages: [
        {
          role: 'user',
          content: [...content, { type: 'text', text: EXTRACTION_INSTRUCTION }],
        },
      ],
    });
  }

  /** The upload as Claude content: PDFs and photos as is, Word as its text. */
  private async toContent(
    input: ImportInput,
  ): Promise<{ content: UserContent[]; source: TimerImportSource }> {
    const { file } = input;
    if (file) {
      const data = file.buffer.toString('base64');
      if (file.mimetype === PDF) {
        return {
          source: TimerImportSource.PDF,
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: PDF, data },
            },
          ],
        };
      }
      if (IMAGE_TYPES.includes(file.mimetype)) {
        return {
          source: TimerImportSource.IMAGE,
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.mimetype as 'image/jpeg',
                data,
              },
            },
          ],
        };
      }
      if (file.mimetype === DOCX) {
        let text: string;
        try {
          text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
        } catch {
          throw new BadRequestException(
            "We couldn't open that Word document. Save it again as .docx or PDF and try again.",
          );
        }
        return {
          source: TimerImportSource.WORD,
          content: [{ type: 'text', text: this.checkText(text) }],
        };
      }
      throw new BadRequestException(
        'Upload a PDF, a Word document (.docx) or a photo (JPG, PNG or WebP).',
      );
    }
    if (input.text?.trim()) {
      return {
        source: TimerImportSource.TEXT,
        content: [{ type: 'text', text: this.checkText(input.text) }],
      };
    }
    throw new BadRequestException(
      'Upload a file or paste the order of service.',
    );
  }

  private checkText(text: string) {
    const t = text.trim();
    if (!t) {
      throw new UnprocessableEntityException(
        'That document has no text we can read. Try a PDF or a photo instead.',
      );
    }
    if (t.length > MAX_TEXT_CHARS) {
      throw new UnprocessableEntityException(
        'That document is too long to be one order of service. Upload just the program.',
      );
    }
    return t;
  }

  /** Most specific first: config problems, rate limits, bad files, outages. */
  private toHttpError(err: unknown) {
    if (
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.PermissionDeniedError
    ) {
      this.logger.error(`Smart import credentials rejected: ${describe(err)}`);
      return new ServiceUnavailableException(
        "Smart import isn't available right now.",
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return new ServiceUnavailableException(
        'Smart import is busy right now. Try again in a minute.',
      );
    }
    if (err instanceof Anthropic.BadRequestError) {
      this.logger.warn(`Smart import request rejected: ${describe(err)}`);
      return new UnprocessableEntityException(
        "We couldn't read that file. Try a PDF, a clearer photo, or paste the text.",
      );
    }
    this.logger.error(`Smart import failed: ${describe(err)}`);
    return new ServiceUnavailableException(
      "Smart import isn't available right now. Try again shortly, or add the program by hand.",
    );
  }
}

function describe(err: unknown) {
  if (err instanceof Anthropic.APIError) {
    return `${err.status} ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

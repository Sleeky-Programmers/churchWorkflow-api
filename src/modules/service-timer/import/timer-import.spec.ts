import Anthropic from '@anthropic-ai/sdk';
import { Types } from 'mongoose';

import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ChurchProduct } from '../../../common/utils/enums.utils';
import { TimerImportStatus } from '../../../schemas/timer-import.schema';
import {
  ExtractedProgram,
  monthBounds,
  tidyProgram,
} from './program-extraction';
import { DOCX, PDF, TimerImportService } from './timer-import.service';

jest.mock('mammoth', () => ({
  extractRawText: jest.fn(async ({ buffer }: { buffer: Buffer }) => {
    if (buffer.toString() === 'broken') {
      throw new Error('not a zip');
    }
    return { value: buffer.toString() };
  }),
}));

const churchId = new Types.ObjectId();
const adminId = new Types.ObjectId();

const program = (over: Partial<ExtractedProgram> = {}): ExtractedProgram => ({
  readable: true,
  serviceName: 'Sunday Worship Service',
  serviceStart: '9:00',
  items: [
    {
      name: ' 1. Opening  Prayer ',
      person: 'Min. Adebisi',
      minutes: 8,
      confident: true,
    },
    {
      name: 'The Word',
      person: 'Pst. Oluwatoyin',
      minutes: 40.4,
      confident: true,
    },
  ],
  ...over,
});

const reply = (parsed: ExtractedProgram | null, stop = 'end_turn') => ({
  model: 'claude-opus-5-5',
  stop_reason: stop,
  usage: { input_tokens: 2100, output_tokens: 600 },
  parsed_output: parsed,
});

function build(opts: {
  used?: number;
  products?: ChurchProduct[];
  parse?: jest.Mock;
  env?: Record<string, string>;
  noClient?: boolean;
}) {
  const created: any[] = [];
  const importModel = {
    countDocuments: jest.fn().mockResolvedValue(opts.used ?? 0),
    create: jest.fn(async (doc) => {
      created.push(doc);
      return doc;
    }),
  };
  const churchModel = {
    findById: () => ({
      select: () => ({
        lean: async () => ({
          products: opts.products ?? [ChurchProduct.SERVICE_TIMER],
        }),
      }),
    }),
  };
  const parse = opts.parse ?? jest.fn().mockResolvedValue(reply(program()));
  const client = opts.noClient
    ? null
    : ({ beta: { messages: { parse } } } as any);
  const service = new TimerImportService(
    importModel as any,
    churchModel as any,
    { get: (k: string) => opts.env?.[k] } as any,
    client,
  );
  return { service, parse, created, importModel };
}

const file = (mimetype: string, content = 'x', originalname = 'program') =>
  ({
    mimetype,
    buffer: Buffer.from(content),
    originalname,
  }) as Express.Multer.File;

describe('tidyProgram', () => {
  it('cleans names, rounds minutes and normalises the start time', () => {
    const t = tidyProgram(program());
    expect(t.serviceStart).toBe('09:00');
    expect(t.items[0].name).toBe('1. Opening Prayer');
    expect(t.items[1].minutes).toBe(40);
  });

  it('drops empty items, clamps minutes and flags zero-minute items', () => {
    const t = tidyProgram(
      program({
        serviceStart: 'morning',
        items: [
          { name: '  ', person: '', minutes: 5, confident: true },
          { name: 'Vigil', person: '', minutes: 900, confident: true },
          { name: 'Grace', person: '', minutes: 0, confident: true },
        ],
      }),
    );
    expect(t.serviceStart).toBe('');
    expect(t.items.map((i) => i.name)).toEqual(['Vigil', 'Grace']);
    expect(t.items[0].minutes).toBe(600);
    expect(t.items[1].confident).toBe(false);
  });

  it('resets the allowance on the first of next month', () => {
    const { start, next } = monthBounds(new Date('2026-11-10T15:00:00Z'));
    expect(start.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(next.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});

describe('TimerImportService', () => {
  it('sends a PDF as a document to Claude Opus 5.5 with refusal fallbacks', async () => {
    const { service, parse, created } = build({});
    const result = await service.extract(churchId, adminId, {
      file: file(PDF, '%PDF'),
    });

    const body = parse.mock.calls[0][0];
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(body.fallbacks).toBe('default');
    expect(body.output_config.effort).toBe('medium');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.messages[0].content[0]).toMatchObject({
      type: 'document',
      source: {
        type: 'base64',
        media_type: PDF,
        data: Buffer.from('%PDF').toString('base64'),
      },
    });

    expect(result.items).toHaveLength(2);
    expect(result.usage).toMatchObject({ used: 1, limit: 1 });
    expect(created[0]).toMatchObject({
      status: TimerImportStatus.SUCCEEDED,
      source: 'pdf',
      itemCount: 2,
      inputTokens: 2100,
      outputTokens: 600,
      aiModel: 'claude-opus-5-5',
    });
  });

  it('sends a photo as an image and Word documents as their text', async () => {
    const { service, parse } = build({
      products: [ChurchProduct.CHURCH_WORKFLOW],
    });
    await service.extract(churchId, adminId, { file: file('image/jpeg') });
    expect(parse.mock.calls[0][0].messages[0].content[0]).toMatchObject({
      type: 'image',
      source: { media_type: 'image/jpeg' },
    });

    await service.extract(churchId, adminId, {
      file: file(DOCX, 'Opening Prayer - 10 mins'),
    });
    expect(parse.mock.calls[1][0].messages[0].content[0]).toEqual({
      type: 'text',
      text: 'Opening Prayer - 10 mins',
    });

    await service.extract(churchId, adminId, { text: '  Praise 20 mins  ' });
    expect(parse.mock.calls[2][0].messages[0].content[0].text).toBe(
      'Praise 20 mins',
    );
  });

  it('lets the model and effort be changed from the environment', async () => {
    const { service, parse } = build({
      env: {
        TIMER_IMPORT_MODEL: 'claude-haiku-5-5',
        TIMER_IMPORT_EFFORT: 'low',
      },
    });
    await service.extract(churchId, adminId, { text: 'Praise 20 mins' });
    expect(parse.mock.calls[0][0].model).toBe('claude-haiku-5-5');
    expect(parse.mock.calls[0][0].output_config.effort).toBe('low');
  });

  it('stops at the monthly allowance before calling Claude', async () => {
    const { service, parse } = build({ used: 1 });
    const err = await service
      .extract(churchId, adminId, { text: 'x' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(403);
    expect(err.getResponse()).toMatchObject({ code: 'IMPORT_LIMIT_REACHED' });
    expect(parse).not.toHaveBeenCalled();
  });

  it('gives Church Workflow churches fair use', async () => {
    const { service } = build({
      used: 1,
      products: [ChurchProduct.CHURCH_WORKFLOW],
    });
    expect((await service.usage(churchId)).limit).toBe(50);
  });

  it("doesn't count an upload that isn't an order of service", async () => {
    const { service, created } = build({
      parse: jest
        .fn()
        .mockResolvedValue(reply(program({ readable: false, items: [] }))),
    });
    await expect(
      service.extract(churchId, adminId, { text: 'shopping list' }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(created[0].status).toBe(TimerImportStatus.UNREADABLE);
  });

  it('treats a refusal or a cut-off answer as unreadable', async () => {
    for (const stop of ['refusal', 'max_tokens']) {
      const { service, created } = build({
        parse: jest.fn().mockResolvedValue(reply(null, stop)),
      });
      await expect(
        service.extract(churchId, adminId, { text: 'x' }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(created[0].status).toBe(TimerImportStatus.UNREADABLE);
    }
  });

  it('turns API errors into clear messages and records the failure', async () => {
    const rateLimited = new Anthropic.RateLimitError(
      429,
      { type: 'error' },
      'rate limited',
      new Headers(),
    );
    const { service, created } = build({
      parse: jest.fn().mockRejectedValue(rateLimited),
    });
    const err = await service
      .extract(churchId, adminId, { text: 'x' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.message).toMatch(/busy/);
    expect(created[0].status).toBe(TimerImportStatus.FAILED);

    const badFile = new Anthropic.BadRequestError(
      400,
      { type: 'error' },
      'bad pdf',
      new Headers(),
    );
    const b = build({ parse: jest.fn().mockRejectedValue(badFile) });
    await expect(
      b.service.extract(churchId, adminId, { file: file(PDF) }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('refuses unsupported or broken files without calling Claude', async () => {
    const { service, parse } = build({});
    await expect(
      service.extract(churchId, adminId, { file: file('application/msword') }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.extract(churchId, adminId, { file: file(DOCX, 'broken') }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.extract(churchId, adminId, { file: file(DOCX, '   ') }),
    ).rejects.toThrow(UnprocessableEntityException);
    await expect(service.extract(churchId, adminId, {})).rejects.toThrow(
      BadRequestException,
    );
    expect(parse).not.toHaveBeenCalled();
  });

  it('answers 503 when no API key is configured', async () => {
    const { service } = build({ noClient: true });
    await expect(
      service.extract(churchId, adminId, { text: 'x' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

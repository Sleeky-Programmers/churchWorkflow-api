import { Types } from 'mongoose';

import { ChurchProduct } from '../../../common/utils/enums.utils';
import { CW_TRIAL_DAYS, TimerChurchWorkflowService } from './timer-cw-link.service';

const day = 86_400_000;
const churchId = new Types.ObjectId();
const branchId = new Types.ObjectId();

const lean = (v: any) => ({ select: () => ({ lean: async () => v }), lean: async () => v });

function setup(opts: { products: ChurchProduct[]; cw: any; instances?: any[] }) {
  const church: any = { _id: churchId, products: [...opts.products], timeZone: 'Africa/Lagos' };
  const cw: any = opts.cw ? { ...opts.cw } : null;
  let instanceQuery: any = null;
  const service = new TimerChurchWorkflowService(
    {
      findById: () => lean(church),
      updateOne: async (_q: any, u: any) => {
        for (const p of u.$addToSet?.products ? [u.$addToSet.products] : []) {
          if (!church.products.includes(p)) church.products.push(p);
        }
      },
    } as any,
    { findById: () => lean({ timeZone: null }) } as any,
    {
      findOne: () => lean(cw),
      updateOne: async (q: any, u: any) => {
        if (cw && cw.status !== q.status.$ne) Object.assign(cw, u.$set);
      },
    } as any,
    {
      find: (q: any) => {
        instanceQuery = q;
        return { sort: () => ({ limit: () => ({ lean: async () => opts.instances ?? [] }) }) };
      },
    } as any,
    { get: (k: string) => (k === 'FRONTEND_URL' ? 'https://app.churchworkflow.test/' : undefined) } as any,
  );
  return { service, church, cw, query: () => instanceQuery };
}

const signupTrial = () => ({
  status: 'TRIAL',
  endDate: new Date(Date.now() - 20 * day),
  gracePeriodEndDate: new Date(Date.now() - 20 * day),
});

describe('Timer ↔ Church Workflow link', () => {
  it('Church Workflow churches are members already', async () => {
    const { service } = setup({ products: [ChurchProduct.CHURCH_WORKFLOW], cw: signupTrial() });
    expect(await service.status(churchId)).toMatchObject({
      state: 'member',
      url: 'https://app.churchworkflow.test',
    });
  });

  it('starts a fresh trial the first time a timer church opens Church Workflow', async () => {
    const s = setup({ products: [ChurchProduct.SERVICE_TIMER], cw: signupTrial() });
    expect((await s.service.status(churchId)).state).toBe('available');

    const res = await s.service.start(churchId);
    expect(res.state).toBe('trial');
    expect(s.church.products).toEqual([ChurchProduct.SERVICE_TIMER, ChurchProduct.CHURCH_WORKFLOW]);
    const days = (s.cw.endDate.getTime() - Date.now()) / day;
    expect(days).toBeGreaterThan(CW_TRIAL_DAYS - 0.01);
    expect(days).toBeLessThanOrEqual(CW_TRIAL_DAYS);
    expect(s.cw.gracePeriodEndDate).toEqual(s.cw.endDate);
  });

  it("doesn't restart the trial, or touch a paid plan", async () => {
    const s = setup({ products: [ChurchProduct.SERVICE_TIMER], cw: signupTrial() });
    await s.service.start(churchId);
    const end = s.cw.endDate;
    await s.service.start(churchId);
    expect(s.cw.endDate).toBe(end);

    const paidEnd = new Date(Date.now() + 200 * day);
    const p = setup({ products: [ChurchProduct.SERVICE_TIMER], cw: { status: 'ACTIVE', endDate: paidEnd } });
    expect((await p.service.status(churchId)).state).toBe('active');
    await p.service.start(churchId);
    expect(p.cw).toMatchObject({ status: 'ACTIVE', endDate: paidEnd });
  });

  it('says when a started trial has ended', async () => {
    const s = setup({
      products: [ChurchProduct.SERVICE_TIMER, ChurchProduct.CHURCH_WORKFLOW],
      cw: signupTrial(),
    });
    expect((await s.service.status(churchId)).state).toBe('ended');
    // And starting again doesn't hand out another trial.
    expect((await s.service.start(churchId)).state).toBe('ended');
  });

  it("lists this branch's and church-wide services from today on", async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
    const at = (d: string) => new Date(`${d}T00:00:00.000Z`);
    const yesterday = new Date(at(today).getTime() - day).toISOString().slice(0, 10);
    const s = setup({
      products: [ChurchProduct.CHURCH_WORKFLOW],
      cw: null,
      instances: [
        { _id: new Types.ObjectId(), title: 'Midweek', date: at(yesterday), startTime: '18:00' },
        { _id: new Types.ObjectId(), title: 'Sunday Service', date: at(today), startTime: '9:00', location: 'Main hall' },
      ],
    });
    const list = await s.service.upcomingServices({ churchId, branchId } as any);
    expect(list).toEqual([
      expect.objectContaining({ title: 'Sunday Service', date: today, startTime: '09:00', location: 'Main hall' }),
    ]);
    expect(s.query().branchId).toEqual({ $in: [branchId, null] });
  });
});

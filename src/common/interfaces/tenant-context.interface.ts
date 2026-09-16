import { Types } from 'mongoose';
import { AdminAccessScope } from '../utils/enums.utils';

export interface TenantContext {
  churchId: Types.ObjectId;
  branchId: Types.ObjectId | null;
  accessScope: AdminAccessScope;
  accessibleBranchIds: Types.ObjectId[];
}

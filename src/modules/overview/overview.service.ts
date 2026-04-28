import { Injectable } from '@nestjs/common';
import { MembersService } from '../members/members.service';
import { ChurchService } from '../church/church.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { ActivityLogService } from '../activity-log/activity-log.service';


@Injectable()
export class OverviewService {
  constructor(
    private membersService: MembersService,
    private churchService: ChurchService,
    private subscriptionService: SubscriptionService,
    private activityLogService:ActivityLogService
  ) {}

  async getOverview() {
   const { totalChurches, newChurchesLast30Days } =  await this.churchService.getChurchStats();
    const totalMembers = await  this.membersService.countAllMembers()
   
    const { totalActivePlans,  totalStarterPlans, churchesByPlan} = await this.subscriptionService.getSubscriptionByPlan()
    const {topChurchByMembers} =  await this.membersService.topChurchesByMembers()
    const recentActivities = await this.activityLogService.getRecentActivitiesSuperAdmin()
    
    return {
      totalChurches,
      newChurchesLast30Days,
      totalMembers,

      totalActivePlans,
      totalStarterPlans,

      churchesByPlan,
      topChurchByMembers,
       recentActivities 
    };
  }
}
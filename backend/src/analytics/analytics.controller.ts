import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@Roles('teacher')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('class/:classId')
  async getClassAnalytics(@Param('classId') classId: string) {
    const data = await this.analyticsService.getClassAnalytics(classId);
    return { data };
  }

  @Get('session/:sessionId')
  async getSessionAnalytics(@Param('sessionId') sessionId: string) {
    const data = await this.analyticsService.getSessionAnalytics(sessionId);
    return { data };
  }

  @Get('student/:userId')
  async getStudentAnalytics(@Param('userId') userId: string) {
    const data = await this.analyticsService.getStudentAnalytics(userId);
    return { data };
  }

  @Get('session/:sessionId/comparison')
  async getSessionComparison(@Param('sessionId') sessionId: string) {
    const data = await this.analyticsService.getSessionComparison(sessionId);
    return { data };
  }
}

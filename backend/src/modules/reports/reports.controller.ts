import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, RoleNames } from '../auth/decorators/roles.decorator';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleNames.ADMIN, RoleNames.MANAGER)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Get sales report' })
  async getSalesReport(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('groupBy') groupBy?: string,
  ) {
    const report = await this.reportsService.getSalesReport({
      dateFrom,
      dateTo,
      groupBy: groupBy as 'day' | 'week' | 'month',
    });

    return {
      success: true,
      data: report,
    };
  }

  @Get('sales-by-user')
  @ApiOperation({ summary: 'Get sales by user report' })
  async getSalesByUser(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    const report = await this.reportsService.getSalesByUser({
      dateFrom,
      dateTo,
    });

    return {
      success: true,
      data: { salesByUser: report },
    };
  }

  @Get('discounts')
  @ApiOperation({ summary: 'Get discount usage report' })
  async getDiscountReport(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    const report = await this.reportsService.getDiscountReport({
      dateFrom,
      dateTo,
    });

    return {
      success: true,
      data: { discountUsage: report },
    };
  }

  @Get('quotes')
  @ApiOperation({ summary: 'Get quotes report' })
  async getQuotesReport(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    const report = await this.reportsService.getQuotesReport({
      dateFrom,
      dateTo,
    });

    return {
      success: true,
      data: report,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  async getSalesReport(options: {
    dateFrom: string;
    dateTo: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<any> {
    const { dateFrom, dateTo, groupBy = 'day' } = options;

    // Get total sales summary
    const summaryResult = await this.dataSource.query(
      `SELECT
        COUNT(*) as orderCount,
        SUM(grand_total) as totalSales,
        SUM(discount_amount) as totalDiscounts,
        SUM(tax_amount) as totalTax,
        AVG(grand_total) as averageOrder
      FROM orders
      WHERE created_at >= ? AND created_at <= ? AND status = 'complete'`,
      [dateFrom, dateTo],
    );

    // Get sales by date
    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'week') {
      dateFormat = '%Y-%u';
    } else if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    }

    const salesByPeriod = await this.dataSource.query(
      `SELECT
        DATE_FORMAT(created_at, '${dateFormat}') as period,
        COUNT(*) as orderCount,
        SUM(grand_total) as totalSales
      FROM orders
      WHERE created_at >= ? AND created_at <= ? AND status = 'complete'
      GROUP BY period
      ORDER BY period`,
      [dateFrom, dateTo],
    );

    return {
      summary: summaryResult[0] || {
        orderCount: 0,
        totalSales: 0,
        totalDiscounts: 0,
        totalTax: 0,
        averageOrder: 0,
      },
      salesByPeriod,
    };
  }

  async getSalesByUser(options: {
    dateFrom: string;
    dateTo: string;
  }): Promise<any[]> {
    const { dateFrom, dateTo } = options;

    const result = await this.dataSource.query(
      `SELECT
        u.id as userId,
        u.first_name as firstName,
        u.last_name as lastName,
        COUNT(o.id) as orderCount,
        SUM(o.grand_total) as totalSales,
        SUM(o.discount_amount) as totalDiscounts
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.created_at >= ? AND o.created_at <= ? AND o.status = 'complete'
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY totalSales DESC`,
      [dateFrom, dateTo],
    );

    return result;
  }

  async getDiscountReport(options: {
    dateFrom: string;
    dateTo: string;
  }): Promise<any> {
    const { dateFrom, dateTo } = options;

    const result = await this.dataSource.query(
      `SELECT
        dal.user_role as userRole,
        dal.discount_type as discountType,
        COUNT(*) as usageCount,
        SUM(dal.discount_amount) as totalDiscount,
        AVG(dal.discount_percent) as avgDiscountPercent
      FROM discount_audit_log dal
      WHERE dal.created_at >= ? AND dal.created_at <= ?
      GROUP BY dal.user_role, dal.discount_type
      ORDER BY totalDiscount DESC`,
      [dateFrom, dateTo],
    );

    return result;
  }

  async getQuotesReport(options: {
    dateFrom: string;
    dateTo: string;
  }): Promise<any> {
    const { dateFrom, dateTo } = options;

    const result = await this.dataSource.query(
      `SELECT
        status,
        COUNT(*) as count,
        SUM(grand_total) as totalValue
      FROM quotes
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY status`,
      [dateFrom, dateTo],
    );

    const conversionRate = await this.dataSource.query(
      `SELECT
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted,
        COUNT(*) as total
      FROM quotes
      WHERE created_at >= ? AND created_at <= ?`,
      [dateFrom, dateTo],
    );

    return {
      byStatus: result,
      conversionRate: conversionRate[0],
    };
  }
}

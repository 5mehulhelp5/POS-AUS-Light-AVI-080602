import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { RefundsService, CreateRefundDto } from './refunds.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, RoleNames } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly refundsService: RefundsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List orders' })
  async findAll(
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('search') search?: string,
    @Query('userId') userId?: number,
    @Query('customerId') customerId?: number,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const { orders, total } = await this.ordersService.findAll({
      status: status as any,
      source: source as any,
      search,
      userId,
      customerId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      page,
      limit,
    });

    return {
      success: true,
      data: {
        orders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          paymentStatus: o.paymentStatus,
          grandTotal: parseFloat(o.grandTotal.toString()),
          customer: o.customer
            ? {
                id: o.customer.id,
                firstName: o.customer.firstName,
                lastName: o.customer.lastName,
              }
            : null,
          user: {
            id: o.user.id,
            firstName: o.user.firstName,
            lastName: o.user.lastName,
          },
          itemCount: o.items.length,
          createdAt: o.createdAt,
          source: o.source,
          magentoIncrementId: o.magentoIncrementId,
          magentoOrderId: o.magentoOrderId,
          syncStatus: o.syncStatus,
          syncError: o.syncError,
          syncAttempts: o.syncAttempts,
        })),
        pagination: {
          page: page || 1,
          limit: limit || 20,
          total,
          totalPages: Math.ceil(total / (limit || 20)),
        },
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const order = await this.ordersService.findById(id);
    if (!order) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      };
    }

    return {
      success: true,
      data: { order },
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  async create(@Body() createDto: any, @CurrentUser() user: any) {
    const userRole = {
      id: user.role.id,
      name: user.role.name,
      maxDiscountPercent: parseFloat(user.role.maxDiscountPercent),
      canStackDiscounts: user.role.canStackDiscounts,
    };

    const order = await this.ordersService.create(createDto, user.id, userRole);

    return {
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          grandTotal: parseFloat(order.grandTotal.toString()),
          syncStatus: order.syncStatus,
          createdAt: order.createdAt,
        },
        receipt: {
          url: `/receipts/${order.orderNumber}.pdf`,
        },
      },
    };
  }

  @Patch(':id/customer')
  @UseGuards(RolesGuard)
  @Roles(RoleNames.ADMIN, RoleNames.MANAGER)
  @ApiOperation({
    summary: 'Link a customer to an existing order (e.g. a walk-in) so store credit can be issued on refund',
  })
  async linkCustomer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { customerId: number },
  ) {
    if (!body?.customerId) {
      return {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'customerId is required' },
      };
    }
    const order = await this.ordersService.linkCustomer(id, Number(body.customerId));
    return {
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customer: order.customer
            ? {
                id: order.customer.id,
                firstName: order.customer.firstName,
                lastName: order.customer.lastName,
              }
            : null,
        },
      },
    };
  }

  @Post(':id/refund')
  @UseGuards(RolesGuard)
  @Roles(RoleNames.ADMIN, RoleNames.MANAGER)
  @ApiOperation({ summary: 'Refund selected items on an order (partial or full)' })
  async refund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateRefundDto,
    @CurrentUser() user: any,
  ) {
    const refund = await this.refundsService.create(id, user.id, dto);
    return {
      success: true,
      data: {
        refund: {
          id: refund.id,
          orderId: refund.orderId,
          reason: refund.reason,
          reasonText: refund.reasonText,
          refundAmount: parseFloat(refund.refundAmount.toString()),
          isFullRefund: refund.isFullRefund,
          createdAt: refund.createdAt,
          user: refund.user
            ? {
                id: refund.user.id,
                firstName: refund.user.firstName,
                lastName: refund.user.lastName,
              }
            : null,
          items: refund.items.map((ri) => ({
            id: ri.id,
            orderItemId: ri.orderItemId,
            quantity: ri.quantity,
            amount: parseFloat(ri.amount.toString()),
            restock: ri.restock,
          })),
        },
      },
    };
  }

  @Get(':id/refunds')
  @ApiOperation({ summary: 'List refunds for an order' })
  async listRefunds(@Param('id', ParseIntPipe) id: number) {
    const refunds = await this.refundsService.findByOrder(id);
    return {
      success: true,
      data: {
        refunds: refunds.map((r) => ({
          id: r.id,
          reason: r.reason,
          reasonText: r.reasonText,
          refundAmount: parseFloat(r.refundAmount.toString()),
          isFullRefund: r.isFullRefund,
          createdAt: r.createdAt,
          user: r.user
            ? {
                id: r.user.id,
                firstName: r.user.firstName,
                lastName: r.user.lastName,
              }
            : null,
          items: r.items.map((ri) => ({
            id: ri.id,
            orderItemId: ri.orderItemId,
            quantity: ri.quantity,
            amount: parseFloat(ri.amount.toString()),
            restock: ri.restock,
          })),
        })),
      },
    };
  }
}

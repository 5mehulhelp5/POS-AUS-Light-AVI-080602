import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders' })
  async findAll(
    @Query('status') status?: string,
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
}

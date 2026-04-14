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
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuotesService, CreateQuoteDto, UpdateQuoteDto } from './quotes.service';
import { OrdersService } from '../orders/orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QuoteStatus } from './entities/quote.entity';

@ApiTags('quotes')
@Controller('quotes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new quote' })
  async create(@Body() dto: CreateQuoteDto, @CurrentUser() user: any) {
    const quote = await this.quotesService.create(dto, user.id);
    return {
      success: true,
      data: { quote },
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an open quote' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuoteDto,
    @CurrentUser() user: any,
  ) {
    const quote = await this.quotesService.update(id, dto, user.id);
    return {
      success: true,
      data: { quote },
    };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an open quote' })
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    const quote = await this.quotesService.cancel(id, user.id);
    return {
      success: true,
      data: { quote },
    };
  }

  @Get(':id/convert-check')
  @ApiOperation({
    summary: 'Check whether a quote can be converted (stock + expiry)',
  })
  async convertCheck(@Param('id', ParseIntPipe) id: number) {
    const { quote, blockers, expiredWithinGrace } =
      await this.quotesService.validateConvert(id);
    const priceRows = await this.quotesService.computeConversionPrices(quote);
    return {
      success: true,
      data: {
        canConvert: !blockers.outOfStock && !blockers.expiredPastGrace,
        expiredWithinGrace,
        blockers,
        prices: priceRows,
      },
    };
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Convert a quote to an order' })
  async convert(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      payments: Array<{
        method: string;
        amount: number;
        reference?: string;
        amountTendered?: number;
      }>;
      customerId?: number;
      notes?: string;
      allowBackorder?: boolean;
    },
    @CurrentUser() user: any,
  ) {
    const allowBackorder = !!body.allowBackorder;
    if (allowBackorder && user.role.name !== 'admin' && user.role.name !== 'manager') {
      throw new ForbiddenException(
        'Only managers or admins may override stock checks',
      );
    }

    const { quote, blockers } = await this.quotesService.validateConvert(
      id,
      allowBackorder,
    );

    if (blockers.expiredPastGrace) {
      throw new BadRequestException(
        `Quote has expired beyond the ${blockers.expiredPastGrace.graceDays}-day grace period. Create a new quote.`,
      );
    }
    if (blockers.outOfStock) {
      throw new BadRequestException({
        message: 'Some items are out of stock',
        outOfStock: blockers.outOfStock,
      });
    }

    // Use the quoted price unless current price is lower
    const priceRows = await this.quotesService.computeConversionPrices(quote);

    // Build CreateOrderDto from quote
    const userRole = {
      id: user.role.id,
      name: user.role.name,
      maxDiscountPercent: parseFloat(user.role.maxDiscountPercent),
      canStackDiscounts: user.role.canStackDiscounts,
    };

    // Only include items with a real productId (skip custom/legacy quote items that can't map back to a product)
    const items = priceRows
      .filter((r) => r.productId != null)
      .map((r) => ({
        productId: r.productId as number,
        quantity: r.quantity,
        unitPriceOverride: r.effectiveUnitPrice,
        discountPercent: r.discountPercent,
      }));

    if (items.length === 0) {
      throw new BadRequestException(
        'No convertible items on this quote (all items lack a product reference)',
      );
    }

    const order = await this.ordersService.create(
      {
        customerId: body.customerId ?? quote.customerId ?? undefined,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          discountPercent: i.discountPercent,
        })),
        payments: body.payments,
        notes: body.notes || `Converted from quote ${quote.quoteNumber}`,
      } as any,
      user.id,
      userRole,
    );

    await this.quotesService.markConverted(quote.id, order.id);

    return {
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          grandTotal: parseFloat(order.grandTotal.toString()),
          status: order.status,
        },
        quoteId: quote.id,
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'List quotes' })
  async findAll(
    @Query('status') status?: string,
    @Query('customerId') customerId?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const { quotes, total } = await this.quotesService.findAll({
      status: status as QuoteStatus,
      customerId,
      page,
      limit,
    });

    return {
      success: true,
      data: {
        quotes: quotes.map((q) => ({
          id: q.id,
          quoteNumber: q.quoteNumber,
          status: q.status,
          buyerType: q.buyerType,
          grandTotal: parseFloat(q.grandTotal.toString()),
          customer: q.customer
            ? {
                id: q.customer.id,
                firstName: q.customer.firstName,
                lastName: q.customer.lastName,
              }
            : null,
          user: {
            id: q.user.id,
            firstName: q.user.firstName,
            lastName: q.user.lastName,
          },
          itemCount: q.items?.length || 0,
          expiresAt: q.expiresAt,
          createdAt: q.createdAt,
          convertedOrderId: q.convertedOrderId,
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
  @ApiOperation({ summary: 'Get quote by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const quote = await this.quotesService.findById(id);
    if (!quote) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quote not found' },
      };
    }

    return {
      success: true,
      data: { quote },
    };
  }
}

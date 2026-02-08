import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuoteStatus } from './entities';

@ApiTags('quotes')
@Controller('quotes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

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

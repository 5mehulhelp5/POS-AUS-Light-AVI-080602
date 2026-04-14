import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Search customers' })
  async findAll(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const { customers, total } = await this.customersService.findAll({
      search,
      page,
      limit,
    });

    return {
      success: true,
      data: {
        customers,
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
  @ApiOperation({ summary: 'Get customer by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const customer = await this.customersService.findById(id);
    if (!customer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
      };
    }

    return {
      success: true,
      data: { customer },
    };
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get customer aggregate stats (spend, orders, quotes)' })
  async getStats(@Param('id', ParseIntPipe) id: number) {
    const stats = await this.customersService.getStats(id);
    return {
      success: true,
      data: { stats },
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create new customer' })
  async create(@Body() createDto: any) {
    const customer = await this.customersService.create(createDto);
    return {
      success: true,
      data: { customer },
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: any,
  ) {
    const customer = await this.customersService.update(id, updateDto);
    return {
      success: true,
      data: { customer },
    };
  }
}

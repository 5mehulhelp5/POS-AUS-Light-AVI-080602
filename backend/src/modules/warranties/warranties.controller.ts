import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  WarrantiesService,
  CreateWarrantyDto,
  UpdateWarrantyDto,
} from './warranties.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WarrantyStatus } from './entities';

function serialize(w: any) {
  return {
    id: w.id,
    customerId: w.customerId,
    contactName: w.contactName,
    contactPhone: w.contactPhone,
    supplierId: w.supplierId,
    supplierName: w.supplierName,
    productSku: w.productSku,
    productName: w.productName,
    invoiceNumber: w.invoiceNumber,
    purchaseDate: w.purchaseDate,
    claimDate: w.claimDate,
    faultDescription: w.faultDescription,
    resolutionNotes: w.resolutionNotes,
    status: w.status,
    customer: w.customer
      ? {
          id: w.customer.id,
          firstName: w.customer.firstName,
          lastName: w.customer.lastName,
        }
      : null,
    supplier: w.supplier ? { id: w.supplier.id, name: w.supplier.name } : null,
    user: w.user
      ? { id: w.user.id, firstName: w.user.firstName, lastName: w.user.lastName }
      : null,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

@ApiTags('warranties')
@Controller('warranties')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WarrantiesController {
  constructor(private readonly warrantiesService: WarrantiesService) {}

  @Get()
  @ApiOperation({ summary: 'List warranty claims' })
  async findAll(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const { warranties, total } = await this.warrantiesService.findAll({
      status: status as WarrantyStatus,
      supplierId,
      page,
      limit,
    });
    return {
      success: true,
      data: {
        warranties: warranties.map(serialize),
        pagination: {
          page: page || 1,
          limit: limit || 50,
          total,
          totalPages: Math.ceil(total / (limit || 50)),
        },
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get warranty claim by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const warranty = await this.warrantiesService.findById(id);
    if (!warranty) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Warranty not found' },
      };
    }
    return { success: true, data: { warranty: serialize(warranty) } };
  }

  @Post()
  @ApiOperation({ summary: 'Create a warranty claim' })
  async create(@Body() dto: CreateWarrantyDto, @CurrentUser() user: any) {
    const warranty = await this.warrantiesService.create(dto, user.id);
    return { success: true, data: { warranty: serialize(warranty) } };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a warranty claim' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWarrantyDto,
  ) {
    const warranty = await this.warrantiesService.update(id, dto);
    return { success: true, data: { warranty: serialize(warranty) } };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a warranty claim' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.warrantiesService.remove(id);
    return { success: true };
  }
}

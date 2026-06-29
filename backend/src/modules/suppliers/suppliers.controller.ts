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
  SuppliersService,
  CreateSupplierDto,
  UpdateSupplierDto,
} from './suppliers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'List suppliers (name/rep/phone search)' })
  async findAll(@Query('search') search?: string) {
    const suppliers = await this.suppliersService.findAll(search);
    return { success: true, data: { suppliers } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const supplier = await this.suppliersService.findById(id);
    if (!supplier) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Supplier not found' },
      };
    }
    return { success: true, data: { supplier } };
  }

  @Post()
  @ApiOperation({ summary: 'Create a supplier' })
  async create(@Body() dto: CreateSupplierDto) {
    const supplier = await this.suppliersService.create(dto);
    return { success: true, data: { supplier } };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a supplier' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierDto,
  ) {
    const supplier = await this.suppliersService.update(id, dto);
    return { success: true, data: { supplier } };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a supplier' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.suppliersService.remove(id);
    return { success: true };
  }
}

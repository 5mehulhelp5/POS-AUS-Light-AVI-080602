import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Search and list products' })
  async findAll(
    @Query('search') search?: string,
    @Query('category') category?: number,
    @Query('inStock') inStock?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const { products, total } = await this.productsService.findAll({
      search,
      category,
      inStock,
      page,
      limit,
    });

    return {
      success: true,
      data: {
        products: products.map((p) => ({
          id: p.id,
          magentoId: p.magentoId,
          sku: p.sku,
          name: p.name,
          price: parseFloat(p.price.toString()),
          specialPrice: p.specialPrice
            ? parseFloat(p.specialPrice.toString())
            : null,
          stockQty: p.stockQty,
          isInStock: p.isInStock,
          imageUrl: p.imageUrl,
          thumbnailUrl: p.thumbnailUrl,
          productType: p.productType,
          barcode: p.barcode,
          categories: p.categories?.map((c) => ({
            id: c.id,
            name: c.name,
          })),
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

  @Get('categories')
  @ApiOperation({ summary: 'Get category tree' })
  async getCategories() {
    const categories = await this.productsService.getCategoryTree();
    return {
      success: true,
      data: { categories },
    };
  }

  @Get('categories/:id/subcategories')
  @ApiOperation({ summary: 'Get subcategories of a category' })
  async getSubcategories(@Param('id', ParseIntPipe) id: number) {
    const subcategories = await this.productsService.getSubcategories(id);
    const parentCategory = await this.productsService.getCategoryById(id);
    return {
      success: true,
      data: {
        parentCategory: parentCategory
          ? { id: parentCategory.id, name: parentCategory.name }
          : null,
        subcategories,
      },
    };
  }

  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'Lookup product by barcode' })
  async findByBarcode(@Param('barcode') barcode: string) {
    const product = await this.productsService.findByBarcode(barcode);
    if (!product) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      };
    }

    return {
      success: true,
      data: { product },
    };
  }

  @Get('sku/:sku')
  @ApiOperation({ summary: 'Lookup product by SKU' })
  async findBySku(@Param('sku') sku: string) {
    const product = await this.productsService.findBySku(sku);
    if (!product) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      };
    }

    return {
      success: true,
      data: { product },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const product = await this.productsService.findById(id);
    if (!product) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      };
    }

    return {
      success: true,
      data: { product },
    };
  }
}

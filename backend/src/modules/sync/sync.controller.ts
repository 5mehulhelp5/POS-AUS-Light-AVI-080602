import {
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, RoleNames } from '../auth/decorators/roles.decorator';

@ApiTags('sync')
@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  @Roles(RoleNames.ADMIN, RoleNames.MANAGER)
  @ApiOperation({ summary: 'Get sync status' })
  async getStatus() {
    const status = await this.syncService.getSyncStatus();
    return {
      success: true,
      data: status,
    };
  }

  @Get('test-connection')
  @Roles(RoleNames.ADMIN)
  @ApiOperation({ summary: 'Test Magento connection' })
  async testConnection() {
    const result = await this.syncService.testConnection();
    return {
      success: result.success,
      message: result.message,
      data: result.productCount ? { productCount: result.productCount } : undefined,
    };
  }

  @Post('categories')
  @Roles(RoleNames.ADMIN)
  @ApiOperation({ summary: 'Sync categories from Magento' })
  async syncCategories() {
    const result = await this.syncService.syncCategories();
    return {
      success: result.success,
      message: result.message,
      data: {
        categoriesCreated: result.categoriesCreated,
        categoriesUpdated: result.categoriesUpdated,
      },
      errors: result.errors,
    };
  }

  @Post('products')
  @Roles(RoleNames.ADMIN)
  @ApiOperation({ summary: 'Sync products from Magento' })
  async syncProducts() {
    const result = await this.syncService.syncProducts();
    return {
      success: result.success,
      message: result.message,
      data: {
        productsCreated: result.productsCreated,
        productsUpdated: result.productsUpdated,
      },
      errors: result.errors,
    };
  }

  @Post('orders')
  @Roles(RoleNames.ADMIN)
  @ApiOperation({ summary: 'Sync orders from Magento (runs in background)' })
  async syncOrders() {
    // Fire-and-forget so nginx doesn't time out on long syncs.
    // Progress/results are written to sync_logs; poll /sync/orders-status for progress.
    this.syncService
      .syncOrders()
      .then((result) => {
        if (!result.success) {
          // eslint-disable-next-line no-console
          console.error('[syncOrders] failed:', result.message, result.errors);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[syncOrders] threw:', err);
      });

    return {
      success: true,
      message: 'Order sync started in background. Check Orders page / sync status for progress.',
    };
  }

  @Get('orders-status')
  @Roles(RoleNames.ADMIN, RoleNames.MANAGER)
  @ApiOperation({ summary: 'Get order sync progress' })
  async getOrderSyncStatus() {
    const progress = this.syncService.getOrderSyncProgress();
    return { success: true, data: progress };
  }

  @Post('customers')
  @Roles(RoleNames.ADMIN)
  @ApiOperation({ summary: 'Sync customers from Magento' })
  async syncCustomers() {
    const result = await this.syncService.syncCustomers();
    return {
      success: result.success,
      message: result.message,
      data: {
        customersCreated: result.customersCreated,
        customersUpdated: result.customersUpdated,
      },
      errors: result.errors,
    };
  }

  @Post('full')
  @Roles(RoleNames.ADMIN)
  @ApiOperation({ summary: 'Full sync - categories, products, and customers' })
  async fullSync() {
    const result = await this.syncService.fullSync();
    return {
      success: result.success,
      message: result.message,
      data: {
        productsCreated: result.productsCreated,
        productsUpdated: result.productsUpdated,
        categoriesCreated: result.categoriesCreated,
        categoriesUpdated: result.categoriesUpdated,
        customersCreated: result.customersCreated,
        customersUpdated: result.customersUpdated,
      },
      errors: result.errors,
    };
  }

  @Post('clear-and-sync')
  @Roles(RoleNames.ADMIN)
  @ApiOperation({ summary: 'Clear all data and sync fresh from Magento' })
  async clearAndSync() {
    const result = await this.syncService.clearAndSync();
    return {
      success: result.success,
      message: result.message,
      data: {
        productsCreated: result.productsCreated,
        productsUpdated: result.productsUpdated,
        categoriesCreated: result.categoriesCreated,
        categoriesUpdated: result.categoriesUpdated,
      },
      errors: result.errors,
    };
  }

  @Post('clear')
  @Roles(RoleNames.ADMIN)
  @ApiOperation({ summary: 'Clear all products and categories (WARNING: destructive)' })
  async clearData() {
    const result = await this.syncService.clearDummyData();
    return {
      success: result.success,
      message: result.message,
    };
  }

  @Post('stock')
  @Roles(RoleNames.ADMIN)
  @ApiOperation({ summary: 'Sync stock quantities only (faster than full sync)' })
  async syncStock() {
    const result = await this.syncService.syncStockOnly();
    return {
      success: result.success,
      message: result.message,
      data: {
        productsUpdated: result.productsUpdated,
      },
    };
  }
}

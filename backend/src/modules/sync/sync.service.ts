import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MagentoService, MagentoProduct, MagentoCustomer } from './magento.service';
import { Product, ProductType } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Customer, SyncStatus } from '../customers/entities/customer.entity';
import { SyncLog, SyncType, SyncDirection, SyncLogStatus } from './entities/sync-log.entity';

export interface SyncResult {
  success: boolean;
  message: string;
  productsCreated?: number;
  productsUpdated?: number;
  categoriesCreated?: number;
  categoriesUpdated?: number;
  customersCreated?: number;
  customersUpdated?: number;
  errors?: string[];
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly magentoService: MagentoService,
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
  ) {}

  async testConnection(): Promise<{ success: boolean; message: string; productCount?: number }> {
    return this.magentoService.testConnection();
  }

  async clearDummyData(): Promise<{ success: boolean; message: string }> {
    this.logger.log('Clearing dummy data...');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Disable foreign key checks temporarily
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

      // Clear product_categories junction table
      await queryRunner.query('DELETE FROM product_categories');

      // Clear products
      const productResult = await queryRunner.query('DELETE FROM products');

      // Clear categories
      const categoryResult = await queryRunner.query('DELETE FROM categories');

      // Reset auto-increment
      await queryRunner.query('ALTER TABLE products AUTO_INCREMENT = 1');
      await queryRunner.query('ALTER TABLE categories AUTO_INCREMENT = 1');

      // Re-enable foreign key checks
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');

      await queryRunner.commitTransaction();

      this.logger.log('Dummy data cleared successfully');
      return {
        success: true,
        message: `Cleared all products and categories`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to clear dummy data', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await queryRunner.release();
    }
  }

  async syncCategories(): Promise<SyncResult> {
    this.logger.log('Starting category sync...');
    const errors: string[] = [];
    let categoriesCreated = 0;
    let categoriesUpdated = 0;

    try {
      const magentoCategories = await this.magentoService.fetchCategories();

      // First pass: Create/update all categories WITHOUT parent_id
      for (const magentoCat of magentoCategories) {
        try {
          let category = await this.categoryRepository.findOne({
            where: { magentoId: magentoCat.id },
          });

          if (category) {
            // Update existing (without parent for now)
            category.name = magentoCat.name;
            category.level = magentoCat.level;
            category.path = magentoCat.path;
            category.isActive = magentoCat.is_active;
            category.sortOrder = magentoCat.position ?? 0;
            category.syncedAt = new Date();
            await this.categoryRepository.save(category);
            categoriesUpdated++;
          } else {
            // Create new (without parent for now)
            category = this.categoryRepository.create({
              magentoId: magentoCat.id,
              name: magentoCat.name,
              parentId: null, // Set to null initially
              level: magentoCat.level,
              path: magentoCat.path,
              isActive: magentoCat.is_active,
              sortOrder: magentoCat.position ?? 0,
              syncedAt: new Date(),
            });
            await this.categoryRepository.save(category);
            categoriesCreated++;
          }
        } catch (error) {
          const errorMsg = `Failed to sync category ${magentoCat.id}: ${error}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Mark categories not returned from Magento as inactive
      const syncedMagentoIds = magentoCategories.map(c => c.id);
      if (syncedMagentoIds.length > 0) {
        const allLocalCategories = await this.categoryRepository.find();
        for (const localCat of allLocalCategories) {
          if (!syncedMagentoIds.includes(localCat.magentoId) && localCat.isActive) {
            localCat.isActive = false;
            localCat.syncedAt = new Date();
            await this.categoryRepository.save(localCat);
            this.logger.log(`Deactivated category "${localCat.name}" (magentoId: ${localCat.magentoId}) - no longer in Magento`);
          }
        }
      }

      // Second pass: Update parent_id references using local IDs
      this.logger.log('Updating category parent references...');
      for (const magentoCat of magentoCategories) {
        if (magentoCat.parent_id && magentoCat.parent_id > 1) {
          try {
            // Find the local category
            const category = await this.categoryRepository.findOne({
              where: { magentoId: magentoCat.id },
            });

            // Find the parent category by its Magento ID
            const parentCategory = await this.categoryRepository.findOne({
              where: { magentoId: magentoCat.parent_id },
            });

            if (category && parentCategory) {
              category.parentId = parentCategory.id; // Use LOCAL id, not magento_id
              await this.categoryRepository.save(category);
            }
          } catch (error) {
            this.logger.warn(`Failed to set parent for category ${magentoCat.id}: ${error}`);
          }
        }
      }

      // Log the sync
      await this.logSync('categories', categoriesCreated + categoriesUpdated, errors.length === 0);

      return {
        success: errors.length === 0,
        message: `Category sync completed: ${categoriesCreated} created, ${categoriesUpdated} updated`,
        categoriesCreated,
        categoriesUpdated,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error('Category sync failed', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        errors: [String(error)],
      };
    }
  }

  async syncProducts(): Promise<SyncResult> {
    this.logger.log('Starting product sync...');
    const errors: string[] = [];
    let productsCreated = 0;
    let productsUpdated = 0;

    try {
      const magentoProducts = await this.magentoService.fetchAllProducts();

      // First pass: sync all products
      for (const magentoProd of magentoProducts) {
        try {
          await this.syncSingleProduct(magentoProd);

          const existing = await this.productRepository.findOne({
            where: { magentoId: magentoProd.id },
          });

          if (existing && existing.createdAt.getTime() === existing.updatedAt.getTime()) {
            productsCreated++;
          } else {
            productsUpdated++;
          }
        } catch (error) {
          const errorMsg = `Failed to sync product ${magentoProd.sku}: ${error}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Stock quantities are now included in the REST API response (extension_attributes.stock_item)
      // so no separate stock sync pass is needed

      // Log the sync
      await this.logSync('products', productsCreated + productsUpdated, errors.length === 0);

      return {
        success: errors.length === 0,
        message: `Product sync completed: ${productsCreated} created, ${productsUpdated} updated`,
        productsCreated,
        productsUpdated,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error('Product sync failed', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        errors: [String(error)],
      };
    }
  }

  // Helper to get a custom attribute value from REST API product
  private getCustomAttribute(magentoProd: MagentoProduct, code: string): any {
    return magentoProd.custom_attributes?.find(
      (attr) => attr.attribute_code === code,
    )?.value;
  }

  private async syncSingleProduct(magentoProd: MagentoProduct): Promise<Product> {
    let product = await this.productRepository.findOne({
      where: { magentoId: magentoProd.id },
      relations: ['categories'],
    });

    const productType = this.mapProductType(magentoProd.type_id);

    // Price comes directly from REST API
    const price = magentoProd.price || 0;

    // Special price from custom attributes
    const specialPriceRaw = this.getCustomAttribute(magentoProd, 'special_price');
    const specialPrice = specialPriceRaw ? parseFloat(specialPriceRaw) : null;
    const specialPriceFrom = this.getCustomAttribute(magentoProd, 'special_from_date') || null;
    const specialPriceTo = this.getCustomAttribute(magentoProd, 'special_to_date') || null;

    // Build image URL from custom attributes
    // Magento serves original images at /pub/media/catalog/product/ path
    const baseUrl = this.magentoService.getBaseUrl();
    const imageFile = this.getCustomAttribute(magentoProd, 'image');
    const thumbnailFile = this.getCustomAttribute(magentoProd, 'thumbnail') || imageFile;
    const imageUrl = imageFile && imageFile !== 'no_selection'
      ? `${baseUrl}/pub/media/catalog/product${imageFile}`
      : null;
    const thumbnailUrl = thumbnailFile && thumbnailFile !== 'no_selection'
      ? `${baseUrl}/pub/media/catalog/product${thumbnailFile}`
      : null;

    // Description from custom attributes
    const descriptionHtml = this.getCustomAttribute(magentoProd, 'description') || '';
    const description = descriptionHtml
      ? descriptionHtml.replace(/<[^>]*>/g, '')
      : null;
    const shortDescription = this.getCustomAttribute(magentoProd, 'short_description') || null;

    // Stock from extension_attributes (this Magento returns stock_quantity as a number)
    const extAttrs = magentoProd.extension_attributes;
    let stockQty = 0;
    let isInStock = false;
    if (extAttrs?.stock_quantity !== undefined) {
      stockQty = Math.floor(extAttrs.stock_quantity);
      isInStock = stockQty > 0;
    } else if (extAttrs?.stock_item) {
      stockQty = Math.floor(extAttrs.stock_item.qty);
      isInStock = extAttrs.stock_item.is_in_stock;
    }

    // Weight
    const weight = magentoProd.weight || null;

    // Status: 1=enabled, 2=disabled
    const isActive = magentoProd.status === 1;

    if (product) {
      // Update existing product
      product.sku = magentoProd.sku;
      product.name = magentoProd.name;
      product.description = description;
      product.shortDescription = shortDescription;
      product.price = price;
      product.specialPrice = specialPrice;
      product.specialPriceFrom = specialPriceFrom ? new Date(specialPriceFrom) : null;
      product.specialPriceTo = specialPriceTo ? new Date(specialPriceTo) : null;
      product.weight = weight;
      product.productType = productType;
      product.imageUrl = imageUrl;
      product.thumbnailUrl = thumbnailUrl;
      product.isInStock = isInStock;
      product.stockQty = stockQty;
      product.isActive = isActive;
      product.syncedAt = new Date();
    } else {
      // Create new product
      product = this.productRepository.create({
        magentoId: magentoProd.id,
        sku: magentoProd.sku,
        name: magentoProd.name,
        description,
        shortDescription,
        price,
        specialPrice,
        specialPriceFrom: specialPriceFrom ? new Date(specialPriceFrom) : null,
        specialPriceTo: specialPriceTo ? new Date(specialPriceTo) : null,
        weight,
        productType,
        imageUrl,
        thumbnailUrl,
        isInStock,
        stockQty,
        isActive,
        syncedAt: new Date(),
      });
    }

    // Handle categories from extension_attributes.category_links
    const categoryLinks = magentoProd.extension_attributes?.category_links;
    if (categoryLinks && categoryLinks.length > 0) {
      const categories: Category[] = [];
      for (const link of categoryLinks) {
        const category = await this.categoryRepository.findOne({
          where: { magentoId: parseInt(link.category_id, 10) },
        });
        if (category) {
          categories.push(category);
        }
      }
      product.categories = categories;
    }

    return this.productRepository.save(product);
  }

  private mapProductType(magentoType: string): ProductType {
    switch (magentoType) {
      case 'configurable':
        return ProductType.CONFIGURABLE;
      case 'bundle':
        return ProductType.BUNDLE;
      case 'grouped':
        return ProductType.GROUPED;
      case 'virtual':
        return ProductType.VIRTUAL;
      default:
        return ProductType.SIMPLE;
    }
  }

  async syncCustomers(): Promise<SyncResult> {
    this.logger.log('Starting customer sync...');
    const errors: string[] = [];
    let customersCreated = 0;
    let customersUpdated = 0;

    try {
      const magentoCustomers = await this.magentoService.fetchAllCustomers();

      for (const magentoCust of magentoCustomers) {
        try {
          await this.syncSingleCustomer(magentoCust);

          const existing = await this.customerRepository.findOne({
            where: { magentoId: magentoCust.id },
          });

          if (existing && existing.createdAt.getTime() === existing.updatedAt.getTime()) {
            customersCreated++;
          } else {
            customersUpdated++;
          }
        } catch (error) {
          const errorMsg = `Failed to sync customer ${magentoCust.email}: ${error}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Log the sync
      await this.logSync('customers', customersCreated + customersUpdated, errors.length === 0);

      return {
        success: errors.length === 0,
        message: `Customer sync completed: ${customersCreated} created, ${customersUpdated} updated`,
        customersCreated,
        customersUpdated,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error('Customer sync failed', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        errors: [String(error)],
      };
    }
  }

  private async syncSingleCustomer(magentoCust: MagentoCustomer): Promise<Customer> {
    let customer = await this.customerRepository.findOne({
      where: { magentoId: magentoCust.id },
    });

    // Extract billing address
    const billingAddr = magentoCust.addresses?.find(a => a.default_billing) || magentoCust.addresses?.[0];
    // Extract shipping address
    const shippingAddr = magentoCust.addresses?.find(a => a.default_shipping) || billingAddr;

    // Get phone from addresses (Magento stores phone on addresses, not customer)
    const phone = billingAddr?.telephone || shippingAddr?.telephone || null;

    // Get company from billing address
    const company = billingAddr?.company || null;

    // Get custom attribute for taxvat (ABN)
    const taxNumber = magentoCust.custom_attributes?.find(
      a => a.attribute_code === 'taxvat',
    )?.value || null;

    if (customer) {
      // Update existing customer
      customer.email = magentoCust.email;
      customer.firstName = magentoCust.firstname;
      customer.lastName = magentoCust.lastname;
      customer.phone = phone;
      customer.company = company;
      customer.taxNumber = taxNumber;

      // Update billing address
      if (billingAddr) {
        customer.billingStreet = billingAddr.street?.join(', ') || null;
        customer.billingCity = billingAddr.city || null;
        customer.billingState = billingAddr.region?.region_code || billingAddr.region?.region || null;
        customer.billingPostcode = billingAddr.postcode || null;
        customer.billingCountry = billingAddr.country_id || 'AU';
      }

      // Update shipping address
      if (shippingAddr) {
        customer.shippingStreet = shippingAddr.street?.join(', ') || null;
        customer.shippingCity = shippingAddr.city || null;
        customer.shippingState = shippingAddr.region?.region_code || shippingAddr.region?.region || null;
        customer.shippingPostcode = shippingAddr.postcode || null;
        customer.shippingCountry = shippingAddr.country_id || 'AU';
      }

      customer.syncStatus = SyncStatus.SYNCED;
      customer.syncedAt = new Date();
    } else {
      // Create new customer
      customer = this.customerRepository.create({
        magentoId: magentoCust.id,
        email: magentoCust.email,
        firstName: magentoCust.firstname,
        lastName: magentoCust.lastname,
        phone,
        company,
        taxNumber,
        billingStreet: billingAddr?.street?.join(', ') || null,
        billingCity: billingAddr?.city || null,
        billingState: billingAddr?.region?.region_code || billingAddr?.region?.region || null,
        billingPostcode: billingAddr?.postcode || null,
        billingCountry: billingAddr?.country_id || 'AU',
        shippingStreet: shippingAddr?.street?.join(', ') || null,
        shippingCity: shippingAddr?.city || null,
        shippingState: shippingAddr?.region?.region_code || shippingAddr?.region?.region || null,
        shippingPostcode: shippingAddr?.postcode || null,
        shippingCountry: shippingAddr?.country_id || 'AU',
        isGuest: false,
        syncStatus: SyncStatus.SYNCED,
        syncedAt: new Date(),
      });
    }

    return this.customerRepository.save(customer);
  }

  async fullSync(): Promise<SyncResult> {
    this.logger.log('Starting full sync...');

    // First sync categories
    const categoryResult = await this.syncCategories();
    if (!categoryResult.success) {
      return {
        success: false,
        message: `Category sync failed: ${categoryResult.message}`,
        errors: categoryResult.errors,
      };
    }

    // Then sync products
    const productResult = await this.syncProducts();

    // Then sync customers
    const customerResult = await this.syncCustomers();

    return {
      success: productResult.success && customerResult.success,
      message: `Full sync completed. Categories: ${categoryResult.categoriesCreated} created, ${categoryResult.categoriesUpdated} updated. Products: ${productResult.productsCreated} created, ${productResult.productsUpdated} updated. Customers: ${customerResult.customersCreated} created, ${customerResult.customersUpdated} updated.`,
      productsCreated: productResult.productsCreated,
      productsUpdated: productResult.productsUpdated,
      categoriesCreated: categoryResult.categoriesCreated,
      categoriesUpdated: categoryResult.categoriesUpdated,
      customersCreated: customerResult.customersCreated,
      customersUpdated: customerResult.customersUpdated,
      errors: [...(categoryResult.errors || []), ...(productResult.errors || []), ...(customerResult.errors || [])],
    };
  }

  async syncStockOnly(): Promise<SyncResult> {
    this.logger.log('Starting stock-only sync...');

    try {
      // Get all product SKUs from local database
      const products = await this.productRepository.find({
        select: ['sku'],
      });
      const skus = products.map((p) => p.sku);

      if (skus.length === 0) {
        return {
          success: true,
          message: 'No products to update',
          productsUpdated: 0,
        };
      }

      // Fetch stock from Magento
      const stockMap = await this.magentoService.fetchStockForSkus(skus);

      // Update stock quantities in database
      let updated = 0;
      for (const [sku, qty] of stockMap.entries()) {
        const result = await this.productRepository.update(
          { sku },
          { stockQty: Math.floor(qty), isInStock: qty > 0 },
        );
        if (result.affected && result.affected > 0) {
          updated++;
        }
      }

      this.logger.log(`Stock sync completed: ${updated} products updated`);

      return {
        success: true,
        message: `Stock sync completed: ${updated} products updated`,
        productsUpdated: updated,
      };
    } catch (error) {
      this.logger.error('Stock sync failed', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async clearAndSync(): Promise<SyncResult> {
    this.logger.log('Starting clear and sync...');

    // Clear existing data
    const clearResult = await this.clearDummyData();
    if (!clearResult.success) {
      return {
        success: false,
        message: `Failed to clear data: ${clearResult.message}`,
      };
    }

    // Full sync
    return this.fullSync();
  }

  private async logSync(entityType: 'products' | 'categories' | 'customers', recordsProcessed: number, success: boolean): Promise<void> {
    try {
      const syncTypeMap: Record<string, SyncType> = {
        products: SyncType.PRODUCTS,
        categories: SyncType.CATEGORIES,
        customers: SyncType.CUSTOMERS,
      };
      const syncType = syncTypeMap[entityType];
      const log = this.syncLogRepository.create({
        syncType,
        direction: SyncDirection.MAGENTO_TO_POS,
        status: success ? SyncLogStatus.COMPLETED : SyncLogStatus.FAILED,
        recordsProcessed,
        startedAt: new Date(),
        completedAt: new Date(),
      });
      await this.syncLogRepository.save(log);
    } catch (error) {
      this.logger.error('Failed to log sync', error);
    }
  }

  async getSyncStatus(): Promise<{
    lastSync: Date | null;
    productCount: number;
    categoryCount: number;
    customerCount: number;
  }> {
    const lastLog = await this.syncLogRepository.findOne({
      where: { status: SyncLogStatus.COMPLETED },
      order: { completedAt: 'DESC' },
    });

    const productCount = await this.productRepository.count();
    const categoryCount = await this.categoryRepository.count();
    const customerCount = await this.customerRepository.count();

    return {
      lastSync: lastLog?.completedAt || null,
      productCount,
      categoryCount,
      customerCount,
    };
  }
}

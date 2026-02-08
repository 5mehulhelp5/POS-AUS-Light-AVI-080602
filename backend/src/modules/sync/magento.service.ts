import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface MagentoProduct {
  id: number;
  sku: string;
  name: string;
  type_id: string;
  status: number; // 1=enabled, 2=disabled
  visibility: number; // 1=not visible, 2=catalog, 3=search, 4=catalog+search
  price: number;
  weight?: number;
  created_at?: string;
  updated_at?: string;
  // Custom attributes from REST API (flat key-value after parsing)
  custom_attributes?: Array<{
    attribute_code: string;
    value: any;
  }>;
  // Media gallery from REST API
  media_gallery_entries?: Array<{
    id: number;
    media_type: string;
    label: string | null;
    position: number;
    disabled: boolean;
    types: string[];
    file: string;
  }>;
  // Category links from extension_attributes
  extension_attributes?: {
    category_links?: Array<{
      category_id: string;
      position: number;
    }>;
    // Stock quantity (simple number from this Magento instance)
    stock_quantity?: number;
    // Some Magento versions return stock_item object instead
    stock_item?: {
      qty: number;
      is_in_stock: boolean;
    };
  };
}

export interface MagentoCategory {
  id: number;
  name: string;
  parent_id: number;
  level: number;
  path: string;
  is_active: boolean;
  children?: MagentoCategory[];
}

export interface MagentoProductsResponse {
  items: MagentoProduct[];
  total_count: number;
  search_criteria: {
    page_size: number;
    current_page: number;
  };
}

@Injectable()
export class MagentoService {
  private readonly logger = new Logger(MagentoService.name);
  private readonly baseUrl: string;
  private readonly adminUsername: string;
  private readonly adminPassword: string;
  private readonly timeout: number;
  private adminToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private httpClient: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('MAGENTO_BASE_URL') || '';
    this.adminUsername = this.configService.get<string>('MAGENTO_ADMIN_USERNAME') || '';
    this.adminPassword = this.configService.get<string>('MAGENTO_ADMIN_PASSWORD') || '';
    this.timeout = this.configService.get<number>('MAGENTO_TIMEOUT') || 30000;

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getAdminToken(): Promise<string> {
    // Return cached token if still valid (tokens typically last 4 hours)
    if (this.adminToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.adminToken;
    }

    this.logger.log('Fetching new Magento admin token...');

    try {
      const response = await this.httpClient.post(
        '/rest/V1/integration/admin/token',
        {
          username: this.adminUsername,
          password: this.adminPassword,
        },
      );

      this.adminToken = response.data;
      // Set expiry to 3.5 hours from now (tokens last 4 hours)
      this.tokenExpiry = new Date(Date.now() + 3.5 * 60 * 60 * 1000);

      this.logger.log('Successfully obtained Magento admin token');
      return this.adminToken as string;
    } catch (error) {
      this.logger.error('Failed to get Magento admin token', error);
      throw new Error('Failed to authenticate with Magento');
    }
  }

  async fetchProducts(
    pageSize: number = 100,
    currentPage: number = 1,
  ): Promise<MagentoProductsResponse> {
    const token = await this.getAdminToken();

    try {
      // Use REST API with admin token to get ALL products (including disabled/not visible)
      const response = await this.httpClient.get(
        `/rest/V1/products?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${currentPage}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 60000, // 60s timeout for large pages
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch products from Magento', error);
      throw error;
    }
  }

  async fetchAllProducts(): Promise<MagentoProduct[]> {
    const allProducts: MagentoProduct[] = [];
    let currentPage = 1;
    const pageSize = 100; // REST API can handle larger pages
    let totalCount = 0;

    this.logger.log('Starting to fetch all products from Magento via REST API...');

    do {
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : '?';
      this.logger.log(`Fetching page ${currentPage} of ${totalPages}...`);
      const response = await this.fetchProducts(pageSize, currentPage);

      allProducts.push(...response.items);
      totalCount = response.total_count;
      this.logger.log(`Got ${response.items.length} products (total so far: ${allProducts.length}/${totalCount})`);
      currentPage++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } while (allProducts.length < totalCount);

    this.logger.log(`Fetched ${allProducts.length} products from Magento`);
    return allProducts;
  }

  async fetchCategories(): Promise<MagentoCategory[]> {
    const query = `
      {
        category(id: 1) {
          id
          name
          children {
            id
            name
            level
            path
            include_in_menu
            children {
              id
              name
              level
              path
              include_in_menu
              children {
                id
                name
                level
                path
                include_in_menu
              }
            }
          }
        }
      }
    `;

    try {
      // Storefront GraphQL does not require admin token
      const response = await this.httpClient.post(
        '/graphql',
        { query },
      );

      if (response.data.errors) {
        this.logger.error('GraphQL errors:', response.data.errors);
        throw new Error('GraphQL query failed');
      }

      // Flatten the category tree and derive parent_id from path
      const categories: MagentoCategory[] = [];
      const flattenCategories = (items: any[]) => {
        for (const item of items) {
          const pathParts = item.path ? item.path.split('/').map(Number) : [];
          const parentId = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : 0;

          categories.push({
            id: item.id,
            name: item.name,
            parent_id: parentId,
            level: item.level,
            path: item.path,
            is_active: !!item.include_in_menu,
          });
          if (item.children && item.children.length > 0) {
            flattenCategories(item.children);
          }
        }
      };

      if (response.data.data?.category?.children) {
        flattenCategories(response.data.data.category.children);
      }

      this.logger.log(`Fetched ${categories.length} categories from Magento`);
      return categories;
    } catch (error) {
      this.logger.error('Failed to fetch categories from Magento', error);
      throw error;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; productCount?: number }> {
    try {
      const response = await this.fetchProducts(1, 1);
      return {
        success: true,
        message: 'Successfully connected to Magento',
        productCount: response.total_count,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Fetch stock quantities for a single SKU
  async fetchStockBySku(sku: string): Promise<number> {
    const token = await this.getAdminToken();

    try {
      const response = await this.httpClient.get(
        `/rest/V1/stockItems/${encodeURIComponent(sku)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data?.qty || 0;
    } catch (error) {
      // Product might not have stock info
      return 0;
    }
  }

  // Fetch stock quantities for multiple SKUs in batches
  async fetchStockForSkus(skus: string[]): Promise<Map<string, number>> {
    const token = await this.getAdminToken();
    const stockMap = new Map<string, number>();

    this.logger.log(`Fetching stock for ${skus.length} SKUs...`);

    // Batch requests to avoid overwhelming the API
    const batchSize = 50;
    for (let i = 0; i < skus.length; i += batchSize) {
      const batch = skus.slice(i, i + batchSize);

      // Build search criteria for stockItems
      const searchCriteria = batch.map((sku, index) =>
        `searchCriteria[filter_groups][0][filters][${index}][field]=sku&searchCriteria[filter_groups][0][filters][${index}][value]=${encodeURIComponent(sku)}&searchCriteria[filter_groups][0][filters][${index}][condition_type]=eq`
      ).join('&');

      try {
        // Try MSI source-items endpoint first (Magento 2.3+)
        const response = await this.httpClient.get(
          `/rest/V1/inventory/source-items?${searchCriteria}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.data?.items) {
          for (const item of response.data.items) {
            const existingQty = stockMap.get(item.sku) || 0;
            stockMap.set(item.sku, existingQty + (item.quantity || 0));
          }
        }
      } catch {
        // Fall back to legacy stockItems endpoint
        for (const sku of batch) {
          try {
            const qty = await this.fetchStockBySku(sku);
            stockMap.set(sku, qty);
          } catch {
            stockMap.set(sku, 0);
          }
        }
      }

      // Progress log
      if ((i + batchSize) % 500 === 0 || i + batchSize >= skus.length) {
        this.logger.log(`Stock fetch progress: ${Math.min(i + batchSize, skus.length)}/${skus.length}`);
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    this.logger.log(`Fetched stock for ${stockMap.size} products`);
    return stockMap;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

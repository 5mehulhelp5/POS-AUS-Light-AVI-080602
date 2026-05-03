import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, IsNull } from 'typeorm';
import { Product, Category } from './entities';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll(options?: {
    search?: string;
    category?: number;
    inStock?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ products: Product[]; total: number }> {
    const { search, category, inStock } = options || {};
    const page = Number(options?.page) || 1;
    const limit = Number(options?.limit) || 20;

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .where('product.isActive = :isActive', { isActive: true });

    if (search) {
      query.andWhere(
        '(product.name LIKE :search OR product.sku LIKE :search OR product.barcode LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (category) {
      // Get the category and all its child category IDs
      const categoryIds = await this.getCategoryAndChildIds(category);
      query.andWhere('category.id IN (:...categoryIds)', { categoryIds });
    }

    if (inStock !== undefined) {
      query.andWhere('product.isInStock = :inStock', { inStock });
    }

    const [products, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('product.name', 'ASC')
      .getManyAndCount();

    return { products, total };
  }

  // Helper to get a category and all its descendants
  private async getCategoryAndChildIds(categoryId: number): Promise<number[]> {
    const ids: number[] = [categoryId];

    const findChildren = async (parentId: number): Promise<void> => {
      const children = await this.categoryRepository.find({
        where: { parentId },
        select: ['id'],
      });

      for (const child of children) {
        ids.push(child.id);
        await findChildren(child.id);
      }
    };

    await findChildren(categoryId);
    return ids;
  }

  async findById(id: number): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { id },
      relations: ['categories', 'attributes'],
    });
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { barcode, isActive: true },
      relations: ['categories'],
    });
  }

  async findBySku(sku: string): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { sku, isActive: true },
      relations: ['categories'],
    });
  }

  async findByIds(ids: number[]): Promise<Product[]> {
    return this.productRepository.find({
      where: { id: In(ids) },
    });
  }

  // Same as findByIds but eager-loads categories — needed by the trade
  // discount engine (rules check by category subtree).
  async findByIdsWithCategories(ids: number[]): Promise<Product[]> {
    return this.productRepository.find({
      where: { id: In(ids) },
      relations: ['categories'],
    });
  }

  async updateStock(productId: number, quantity: number): Promise<void> {
    const product = await this.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const newQty = product.stockQty - quantity;
    await this.productRepository.update(productId, {
      stockQty: newQty,
      isInStock: newQty > 0,
    });
  }

  async getCategories(): Promise<Category[]> {
    return this.categoryRepository.find({
      where: { isActive: true },
      order: { level: 'ASC', sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async getCategoryTree(): Promise<Category[]> {
    // Get level 2 categories (main categories under Root) that have products
    // These are the useful categories like "Indoor", "Outdoor", "Fans", etc.
    const mainCategories = await this.categoryRepository
      .createQueryBuilder('cat')
      .where('cat.level = :level', { level: 2 })
      .andWhere('cat.isActive = :isActive', { isActive: true })
      .orderBy('cat.sortOrder', 'ASC')
      .addOrderBy('cat.name', 'ASC')
      .getMany();

    // Filter to only categories that have products (directly or in children)
    const categoriesWithProducts: Category[] = [];

    for (const cat of mainCategories) {
      const childIds = await this.getCategoryAndChildIds(cat.id);
      const productCount = await this.productRepository
        .createQueryBuilder('product')
        .innerJoin('product.categories', 'category')
        .where('category.id IN (:...categoryIds)', { categoryIds: childIds })
        .getCount();

      if (productCount > 0) {
        categoriesWithProducts.push(cat);
      }
    }

    return categoriesWithProducts;
  }

  async getSubcategories(parentId: number): Promise<Category[]> {
    // Get direct children of the given category that have products
    const children = await this.categoryRepository.find({
      where: { parentId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    // Filter to only subcategories that have products
    const subcategoriesWithProducts: Category[] = [];

    for (const cat of children) {
      const childIds = await this.getCategoryAndChildIds(cat.id);
      const productCount = await this.productRepository
        .createQueryBuilder('product')
        .innerJoin('product.categories', 'category')
        .where('category.id IN (:...categoryIds)', { categoryIds: childIds })
        .getCount();

      if (productCount > 0) {
        subcategoriesWithProducts.push(cat);
      }
    }

    return subcategoriesWithProducts;
  }

  async getCategoryById(id: number): Promise<Category | null> {
    return this.categoryRepository.findOne({ where: { id } });
  }
}

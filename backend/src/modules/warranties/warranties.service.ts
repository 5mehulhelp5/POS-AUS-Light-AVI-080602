import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warranty, WarrantyStatus } from './entities';
import { Supplier } from '../suppliers/entities';

export interface CreateWarrantyDto {
  customerId?: number | null;
  contactName?: string;
  contactPhone?: string;
  supplierId?: number | null;
  supplierName?: string;
  productSku?: string;
  productName?: string;
  invoiceNumber?: string;
  purchaseDate?: string;
  claimDate?: string;
  faultDescription?: string;
  resolutionNotes?: string;
  status?: WarrantyStatus;
}

export type UpdateWarrantyDto = Partial<CreateWarrantyDto>;

@Injectable()
export class WarrantiesService {
  constructor(
    @InjectRepository(Warranty)
    private readonly warrantyRepository: Repository<Warranty>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async create(data: CreateWarrantyDto, userId: number): Promise<Warranty> {
    // Snapshot supplier name from the FK if not provided explicitly.
    let supplierName = data.supplierName?.trim() || null;
    if (data.supplierId && !supplierName) {
      const supplier = await this.supplierRepository.findOne({
        where: { id: data.supplierId },
      });
      supplierName = supplier?.name || null;
    }

    const warranty = this.warrantyRepository.create({
      customerId: data.customerId ?? null,
      contactName: data.contactName?.trim() || null,
      contactPhone: data.contactPhone?.replace(/\D+/g, '') || null,
      supplierId: data.supplierId ?? null,
      supplierName,
      productSku: data.productSku?.trim() || null,
      productName: data.productName?.trim() || null,
      invoiceNumber: data.invoiceNumber?.trim() || null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      claimDate: data.claimDate ? new Date(data.claimDate) : new Date(),
      faultDescription: data.faultDescription?.trim() || null,
      resolutionNotes: data.resolutionNotes?.trim() || null,
      status: data.status || WarrantyStatus.NEW,
      userId,
    });
    const saved = await this.warrantyRepository.save(warranty);
    return this.findById(saved.id) as Promise<Warranty>;
  }

  async update(id: number, data: UpdateWarrantyDto): Promise<Warranty> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Warranty not found');
    const patch: Partial<Warranty> = {};
    if (data.customerId !== undefined) patch.customerId = data.customerId ?? null;
    if (data.contactName !== undefined)
      patch.contactName = data.contactName?.trim() || null;
    if (data.contactPhone !== undefined)
      patch.contactPhone = data.contactPhone?.replace(/\D+/g, '') || null;
    if (data.supplierId !== undefined) {
      patch.supplierId = data.supplierId ?? null;
      if (data.supplierId && data.supplierName === undefined) {
        const supplier = await this.supplierRepository.findOne({
          where: { id: data.supplierId },
        });
        patch.supplierName = supplier?.name || null;
      }
    }
    if (data.supplierName !== undefined)
      patch.supplierName = data.supplierName?.trim() || null;
    if (data.productSku !== undefined)
      patch.productSku = data.productSku?.trim() || null;
    if (data.productName !== undefined)
      patch.productName = data.productName?.trim() || null;
    if (data.invoiceNumber !== undefined)
      patch.invoiceNumber = data.invoiceNumber?.trim() || null;
    if (data.purchaseDate !== undefined)
      patch.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null;
    if (data.claimDate !== undefined)
      patch.claimDate = data.claimDate ? new Date(data.claimDate) : null;
    if (data.faultDescription !== undefined)
      patch.faultDescription = data.faultDescription?.trim() || null;
    if (data.resolutionNotes !== undefined)
      patch.resolutionNotes = data.resolutionNotes?.trim() || null;
    if (data.status !== undefined) patch.status = data.status;
    await this.warrantyRepository.update(id, patch);
    return this.findById(id) as Promise<Warranty>;
  }

  async remove(id: number): Promise<void> {
    const existing = await this.warrantyRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Warranty not found');
    await this.warrantyRepository.delete(id);
  }

  async findAll(options?: {
    status?: WarrantyStatus;
    supplierId?: number;
    page?: number;
    limit?: number;
  }): Promise<{ warranties: Warranty[]; total: number }> {
    const { status, supplierId } = options || {};
    const page = Number(options?.page) || 1;
    const limit = Number(options?.limit) || 50;

    const query = this.warrantyRepository
      .createQueryBuilder('warranty')
      .leftJoinAndSelect('warranty.customer', 'customer')
      .leftJoinAndSelect('warranty.supplier', 'supplier')
      .leftJoinAndSelect('warranty.user', 'user');

    if (status) query.andWhere('warranty.status = :status', { status });
    if (supplierId)
      query.andWhere('warranty.supplierId = :supplierId', { supplierId });

    const [warranties, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('warranty.createdAt', 'DESC')
      .getManyAndCount();

    return { warranties, total };
  }

  async findById(id: number): Promise<Warranty | null> {
    return this.warrantyRepository.findOne({
      where: { id },
      relations: ['customer', 'supplier', 'user'],
    });
  }
}

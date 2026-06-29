import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Supplier } from './entities';

export interface CreateSupplierDto {
  name: string;
  phone?: string;
  rep?: string;
  email?: string;
  notes?: string;
}

export type UpdateSupplierDto = Partial<CreateSupplierDto>;

// Initial supplier directory — sourced from the AUS Lighting Point of
// Contact form. Auto-seeded on first boot so the page is useful out of
// the gate; staff can edit/add/delete from the UI afterwards.
const SEED_SUPPLIERS: CreateSupplierDto[] = [
  { name: '3A LIGHTING', phone: '02 9724 7263' },
  { name: 'ADM\\MEANWELL', phone: '1300 236 467', rep: 'SOKATER: 0409 010 485' },
  { name: 'AMES (Prestige)', phone: '1300 310 451', rep: 'Nathan 0430 393 642' },
  { name: 'Alacio', phone: '0403 045 818', rep: 'Adam 0403 045 818' },
  { name: 'AQUALUX\\TELECTRAN', phone: '02 9454 7900', rep: 'Steve: 0410 641 120' },
  { name: 'BRIGHT GREEN', phone: '1300 672 499', email: 'sales@brightgreen.com.au' },
  { name: 'BRILLIANT LIGHTING', phone: '03 9765 2555', rep: 'Rob: 0412 037 701' },
  { name: 'Calibo Fans', phone: '1300 116 305', rep: 'Damien 0491 204 135' },
  { name: 'CDB Goldair (360 Fans)', phone: '03 9365 5100' },
  { name: 'CLA', phone: '02 9938 7100', rep: 'Glenn 0421 826 859' },
  { name: 'COUGAR Lighting', phone: '08 8169 2900', rep: 'Mark' },
  { name: 'CONTESSA', phone: '1300 887 948' },
  { name: 'DOMUS Lighting', phone: '02 9554 9600', rep: 'Spiro: 0468 964 433' },
  { name: 'EGLO Lighting', phone: '07 3375 1413', rep: 'Kate: 0403 095 820' },
  { name: 'EVERTOP Lighting', phone: '0474 888 333', rep: 'Colin' },
  { name: 'EMAC & LAWTON', phone: '03 8524 6159', rep: 'Elissa: 0422 532 249' },
  { name: 'FIORENTINO', phone: '08 8266 3222' },
  { name: 'FORM Lighting', phone: '02 8399 3418' },
  { name: 'GENTECH', phone: '03 9561 5688' },
  { name: 'GMT', phone: '03 9819 1777' },
  { name: 'HAVIT Lighting', phone: '02 9381 8300', rep: 'Steve: 0487 888 667' },
  { name: 'HUNTER PACIFIC', phone: '1300 369 828', rep: 'Rhonda: 0457 478 536' },
  { name: 'HUNZA Lighting', phone: '08 9240 2227', rep: 'Ben: 0420 855 514' },
  { name: 'ICON FANS', phone: '08 9456 4697', rep: 'Natalie' },
  { name: 'IXL', phone: '1300 727 421', rep: 'Ian 0433 567 433' },
  { name: 'LIGHTCO', phone: '1300 795 548', rep: 'Rob: 0424 230 428' },
  { name: 'Lighting Inspirations', phone: '03 9486 4115', rep: 'Catherine' },
  { name: 'MAYFIELD LAMPS', phone: '03 4226 5496' },
  { name: 'MECATOR', phone: '1300 552 255', rep: 'Katy: 0491 647 084 or Phil: 0422 521 233' },
  { name: 'OMNI Globes', phone: '1300 333 001' },
  { name: 'ORIEL Lighting', phone: '07 3715 9800' },
  { name: 'PHONIX Lighting (PHL)', phone: '02 9737 9030', rep: 'Mark: 0425 239 187' },
  { name: 'SUNNY Lighting (SAL)', phone: '03 9532 3168', rep: 'Chris: 0404 018 899' },
  { name: 'SUPERLUX', phone: '02 8216 4676' },
  { name: 'TOONGABBIE', phone: '02 9769 0812' },
  { name: 'TELBIX', phone: '9309 9060', rep: 'Anthony: 0498 100 222' },
  { name: 'TECLEC', phone: '03 9553 3600', rep: 'Alan' },
  { name: 'TEC LED', phone: '02 9317 4177', rep: 'Jeff 0430 873 544' },
  { name: 'TREND Lighting', phone: '02 9669 8888', rep: 'Jim' },
  { name: 'UGE', phone: '03 9416 7992' },
  { name: 'VIORE DESIGN', phone: '02 8060 1852' },
  { name: 'VENTAIR', phone: '03 9775 0556', rep: 'Richard: 0410 507 916' },
  { name: 'VENCHA', phone: '02 8811 1622', rep: 'Charlie: 0418 837 065' },
];

@Injectable()
export class SuppliersService implements OnModuleInit {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async onModuleInit() {
    const count = await this.supplierRepository.count();
    if (count === 0) {
      await this.supplierRepository.save(
        SEED_SUPPLIERS.map((s) => this.supplierRepository.create(s)),
      );
    }
  }

  async create(data: CreateSupplierDto): Promise<Supplier> {
    const supplier = this.supplierRepository.create({
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      rep: data.rep?.trim() || null,
      email: data.email?.trim() || null,
      notes: data.notes?.trim() || null,
    });
    return this.supplierRepository.save(supplier);
  }

  async update(id: number, data: UpdateSupplierDto): Promise<Supplier> {
    const existing = await this.supplierRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Supplier not found');
    const patch: Partial<Supplier> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.phone !== undefined) patch.phone = data.phone?.trim() || null;
    if (data.rep !== undefined) patch.rep = data.rep?.trim() || null;
    if (data.email !== undefined) patch.email = data.email?.trim() || null;
    if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;
    await this.supplierRepository.update(id, patch);
    return this.supplierRepository.findOne({ where: { id } }) as Promise<Supplier>;
  }

  async remove(id: number): Promise<void> {
    const existing = await this.supplierRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Supplier not found');
    await this.supplierRepository.delete(id);
  }

  async findAll(search?: string): Promise<Supplier[]> {
    const where = search
      ? [
          { name: Like(`%${search}%`) },
          { rep: Like(`%${search}%`) },
          { phone: Like(`%${search}%`) },
        ]
      : undefined;
    return this.supplierRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async findById(id: number): Promise<Supplier | null> {
    return this.supplierRepository.findOne({ where: { id } });
  }
}

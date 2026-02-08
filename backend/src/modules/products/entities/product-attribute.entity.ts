import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_attributes')
export class ProductAttribute {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'product_id', type: 'int', unsigned: true })
  productId: number;

  @Index()
  @Column({ name: 'attribute_code', type: 'varchar', length: 100 })
  attributeCode: string;

  @Column({ name: 'attribute_label', type: 'varchar', length: 255 })
  attributeLabel: string;

  @Column({ name: 'attribute_value', type: 'varchar', length: 255 })
  attributeValue: string;

  @ManyToOne(() => Product, (product) => product.attributes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}

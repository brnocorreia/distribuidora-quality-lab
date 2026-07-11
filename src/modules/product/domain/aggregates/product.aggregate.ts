import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AggregateRoot } from '@shared/domain/aggregate-root';
import { ValidationException } from '@shared/domain/exceptions';
import { ProductPrice } from '../value-objects/product-price.vo';

export interface CreateProductProps {
  name: string;
  description?: string;
  unitPrice: number;
  category: string;
}

export interface UpdateProductProps {
  name?: string;
  description?: string;
  unitPrice?: number;
  category?: string;
}

@Entity('products')
export class ProductAggregate extends AggregateRoot {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  private _id: string;

  @Column({ name: 'name', length: 150 })
  private _name: string;

  @Column({ name: 'description', length: 1000, nullable: true })
  private _description: string;

  @Column('decimal', { name: 'unit_price', precision: 10, scale: 2 })
  private _unitPrice: number;

  @Column({ name: 'category', length: 100 })
  private _category: string;

  @Column({ name: 'available', default: true })
  private _available: boolean;

  @CreateDateColumn({ name: 'created_at' })
  private _createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  private _updatedAt: Date;

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get unitPrice(): number {
    return this._unitPrice;
  }

  get category(): string {
    return this._category;
  }

  get available(): boolean {
    return this._available;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static create(props: CreateProductProps): ProductAggregate {
    ProductAggregate.validateName(props.name);
    ProductAggregate.validateCategory(props.category);
    const price = ProductPrice.create(props.unitPrice);

    const product = new ProductAggregate();
    product._name = props.name;
    product._description = props.description ?? '';
    product._unitPrice = price.value;
    product._category = props.category;
    product._available = true;

    return product;
  }

  update(props: UpdateProductProps): void {
    if (props.name !== undefined) {
      ProductAggregate.validateName(props.name);
      this._name = props.name;
    }

    if (props.description !== undefined) {
      this._description = props.description;
    }

    if (props.unitPrice !== undefined) {
      const price = ProductPrice.create(props.unitPrice);
      this._unitPrice = price.value;
    }

    if (props.category !== undefined) {
      ProductAggregate.validateCategory(props.category);
      this._category = props.category;
    }
  }

  markAsUnavailable(): void {
    this._available = false;
  }

  markAsAvailable(): void {
    this._available = true;
  }

  private static validateName(name: string): void {
    if (!name || name.trim().length === 0 || name.length > 150) {
      throw new ValidationException('Invalid product name', {
        name: ['name must be between 1 and 150 characters'],
      });
    }
  }

  private static validateCategory(category: string): void {
    if (!category || category.trim().length === 0 || category.length > 100) {
      throw new ValidationException('Invalid product category', {
        category: ['category must be between 1 and 100 characters'],
      });
    }
  }
}

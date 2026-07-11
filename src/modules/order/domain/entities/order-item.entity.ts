import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Entity as DomainEntity } from '@shared/domain/entity';
import { ValidationException } from '@shared/domain/exceptions';
import { OrderAggregate } from '../aggregates/order.aggregate';

interface CreateOrderItemProps {
  orderId?: string;
  order?: OrderAggregate;
  productId: string;
  quantity: number;
  unitPrice: number;
}

@Entity('order_items')
export class OrderItem extends DomainEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  private _id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  private _orderId: string | undefined;

  @ManyToOne(() => OrderAggregate, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  private _order: OrderAggregate | undefined;

  @Column({ name: 'product_id', type: 'uuid' })
  private _productId: string;

  @Column({ name: 'quantity', type: 'integer' })
  private _quantity: number;

  @Column('decimal', { name: 'unit_price', precision: 10, scale: 2 })
  private _unitPrice: number;

  @CreateDateColumn({ name: 'created_at' })
  private _createdAt: Date;

  get id(): string {
    return this._id;
  }

  get orderId(): string {
    return (this._orderId || (this._order ? this._order.id : undefined)) as string;
  }

  get order(): OrderAggregate | undefined {
    return this._order;
  }

  get productId(): string {
    return this._productId;
  }

  get quantity(): number {
    return this._quantity;
  }

  get unitPrice(): number {
    return this._unitPrice;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get subtotal(): number {
    return Number((this._quantity * this._unitPrice).toFixed(2));
  }

  static create(props: CreateOrderItemProps): OrderItem {
    OrderItem.validateProductId(props.productId);
    OrderItem.validateQuantity(props.quantity);
    OrderItem.validateUnitPrice(props.unitPrice);

    const item = new OrderItem();
    item._orderId = props.orderId;
    item._order = props.order;
    item._productId = props.productId;
    item._quantity = props.quantity;
    item._unitPrice = props.unitPrice;

    return item;
  }

  updateQuantity(quantity: number): void {
    OrderItem.validateQuantity(quantity);
    this._quantity = quantity;
  }

  private static validateProductId(productId: string): void {
    if (!productId || productId.trim().length === 0) {
      throw new ValidationException('Product ID is required', {
        productId: ['productId must be a valid UUID'],
      });
    }
  }

  private static validateQuantity(quantity: number): void {
    if (isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationException('Invalid quantity', {
        quantity: ['quantity must be a positive integer greater than 0'],
      });
    }
  }

  private static validateUnitPrice(unitPrice: number): void {
    if (isNaN(unitPrice) || unitPrice <= 0 || unitPrice > 999999.99) {
      throw new ValidationException('Invalid unit price', {
        unitPrice: ['unitPrice must be between 0.01 and 999999.99'],
      });
    }

    const decimals = unitPrice.toString().split('.')[1];
    if (decimals && decimals.length > 2) {
      throw new ValidationException('Invalid unit price precision', {
        unitPrice: ['unitPrice must have at most 2 decimal places'],
      });
    }
  }
}

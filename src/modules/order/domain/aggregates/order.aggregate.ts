import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { AggregateRoot } from '@shared/domain/aggregate-root';
import { BusinessRuleException, ValidationException } from '@shared/domain/exceptions';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus, OrderStatusValue } from '../value-objects/order-status.vo';

interface CreateOrderProps {
  customerId: string;
  paymentTypeId?: string;
}

@Entity('orders')
export class OrderAggregate extends AggregateRoot {
  @PrimaryGeneratedColumn('uuid')
  private _id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  private _customerId: string;

  @Column({ length: 20, default: 'draft' })
  private _status: string;

  @Column('decimal', { name: 'total_amount', precision: 12, scale: 2, default: 0 })
  private _totalAmount: number;

  @Column({ name: 'payment_type_id', type: 'uuid', nullable: true })
  private _paymentTypeId: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { eager: true, cascade: true })
  private _items: OrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  private _createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  private _updatedAt: Date;

  get id(): string {
    return this._id;
  }

  get customerId(): string {
    return this._customerId;
  }

  get status(): OrderStatusValue {
    return this._status as OrderStatusValue;
  }

  set status(value: OrderStatusValue) {
    this._status = value;
  }

  get items(): OrderItem[] {
    return this._items ? [...this._items] : [];
  }

  set items(value: OrderItem[]) {
    this._items = value;
    this._totalAmount = this.calculateTotal();
  }

  get totalAmount(): number {
    return Number(this._totalAmount);
  }

  set totalAmount(value: number) {
    this._totalAmount = value;
  }

  get paymentTypeId(): string | null {
    return this._paymentTypeId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static create(props: CreateOrderProps): OrderAggregate {
    if (!props.customerId || props.customerId.trim().length === 0) {
      throw new ValidationException('Customer ID is required', {
        customerId: ['customerId must be a valid UUID'],
      });
    }

    const order = new OrderAggregate();
    order._customerId = props.customerId;
    order._status = 'draft';
    order._totalAmount = 0;
    order._paymentTypeId = props.paymentTypeId ?? null;
    order._items = [];

    return order;
  }

  addItem(productId: string, quantity: number, unitPrice: number): OrderItem {
    this.ensureDraftState('add items');

    const existingItem = this._items.find((i) => i.productId === productId);
    if (existingItem) {
      throw new BusinessRuleException('Product already exists in order', {
        productId,
        existingItemId: existingItem.id,
      });
    }

    const item = OrderItem.create({
      orderId: this._id,
      order: this,
      productId,
      quantity,
      unitPrice,
    });

    this._items.push(item);
    this._totalAmount = this.calculateTotal();

    return item;
  }

  removeItem(itemId: string): void {
    this.ensureDraftState('remove items');

    const index = this._items.findIndex((i) => i.id === itemId);
    if (index === -1) {
      throw new BusinessRuleException('Item not found in order', {
        itemId,
      });
    }

    this._items.splice(index, 1);
    this._totalAmount = this.calculateTotal();
  }

  confirm(): void {
    if (this._items.length === 0) {
      throw new BusinessRuleException('Cannot confirm an order without items', {
        orderId: this._id,
      });
    }

    const orderStatus = OrderStatus.create(this._status as OrderStatusValue);
    const newStatus = orderStatus.transitionTo('confirmed');
    this._status = newStatus.value;
  }

  transitionTo(target: OrderStatusValue): void {
    const orderStatus = OrderStatus.create(this._status as OrderStatusValue);
    const newStatus = orderStatus.transitionTo(target);
    this._status = newStatus.value;
  }

  cancel(): void {
    const orderStatus = OrderStatus.create(this._status as OrderStatusValue);
    const newStatus = orderStatus.transitionTo('cancelled');
    this._status = newStatus.value;
  }

  setPaymentType(paymentTypeId: string): void {
    this.ensureDraftState('set payment type');
    this._paymentTypeId = paymentTypeId;
  }

  getOrderStatus(): OrderStatus {
    return OrderStatus.create(this._status as OrderStatusValue);
  }

  private ensureDraftState(action: string): void {
    if (this._status !== 'draft') {
      throw new BusinessRuleException(`Cannot ${action} when order is not in draft state`, {
        currentState: this._status,
        requiredState: 'draft',
      });
    }
  }

  private calculateTotal(): number {
    if (!this._items || this._items.length === 0) return 0;
    const total = this._items.reduce((sum, item) => sum + item.subtotal, 0);
    return Number(total.toFixed(2));
  }
}

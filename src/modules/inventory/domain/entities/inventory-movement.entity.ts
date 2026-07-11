import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { Entity as DomainEntity } from '@shared/domain/entity';
import { ValidationException } from '@shared/domain/exceptions';

export type MovementType = 'entry' | 'withdrawal';

interface CreateMovementProps {
  productId: string;
  type: MovementType;
  quantity: number;
  reason?: string;
}

@Entity('inventory_movements')
export class InventoryMovement extends DomainEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  private _id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  private _productId: string;

  @Column({ name: 'type', length: 10 })
  private _type: string;

  @Column({ name: 'quantity', type: 'integer' })
  private _quantity: number;

  @Column({ name: 'reason', type: 'varchar', length: 255, nullable: true })
  private _reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  private _createdAt: Date;

  get id(): string {
    return this._id;
  }

  get productId(): string {
    return this._productId;
  }

  get type(): MovementType {
    return this._type as MovementType;
  }

  get quantity(): number {
    return this._quantity;
  }

  get reason(): string | null {
    return this._reason;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  static create(props: CreateMovementProps): InventoryMovement {
    InventoryMovement.validateProductId(props.productId);
    InventoryMovement.validateType(props.type);
    InventoryMovement.validateQuantity(props.quantity);
    InventoryMovement.validateReason(props.type, props.reason);

    const movement = new InventoryMovement();
    movement._productId = props.productId;
    movement._type = props.type;
    movement._quantity = props.quantity;
    movement._reason = props.reason ?? null;

    return movement;
  }

  private static validateProductId(productId: string): void {
    if (!productId || productId.trim().length === 0) {
      throw new ValidationException('Product ID is required', {
        productId: ['productId must be a valid UUID'],
      });
    }
  }

  private static validateType(type: string): void {
    if (type !== 'entry' && type !== 'withdrawal') {
      throw new ValidationException('Invalid movement type', {
        type: ['type must be either "entry" or "withdrawal"'],
      });
    }
  }

  private static validateQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationException('Invalid quantity', {
        quantity: ['quantity must be a positive integer greater than 0'],
      });
    }
  }

  private static validateReason(type: MovementType, reason?: string): void {
    if (type === 'withdrawal' && (!reason || reason.trim().length === 0)) {
      throw new ValidationException('Reason is required for withdrawals', {
        reason: ['reason is required when type is "withdrawal"'],
      });
    }
  }
}

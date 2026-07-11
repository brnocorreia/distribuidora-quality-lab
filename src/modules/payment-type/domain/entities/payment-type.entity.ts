import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Entity as DomainEntity } from '@shared/domain/entity';
import { ValidationException } from '@shared/domain/exceptions';
import { AcceptanceRule } from '../value-objects/acceptance-rule.vo';

interface CreatePaymentTypeProps {
  name: string;
  description?: string;
}

interface UpdatePaymentTypeProps {
  name?: string;
  description?: string;
  active?: boolean;
}

@Entity('payment_types')
export class PaymentTypeEntity extends DomainEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  private _id: string;

  @Column({ name: 'name', length: 100, unique: true })
  private _name: string;

  @Column({ name: 'description', length: 500, nullable: true })
  private _description: string;

  @Column({ name: 'active', default: true })
  private _active: boolean;

  @OneToMany(() => AcceptanceRule, (rule) => rule.paymentType, {
    cascade: true,
    eager: true,
  })
  private _rules: AcceptanceRule[];

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

  get active(): boolean {
    return this._active;
  }

  get rules(): AcceptanceRule[] {
    return this._rules ?? [];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static create(props: CreatePaymentTypeProps): PaymentTypeEntity {
    PaymentTypeEntity.validateName(props.name);

    if (props.description !== undefined) {
      PaymentTypeEntity.validateDescription(props.description);
    }

    const paymentType = new PaymentTypeEntity();
    paymentType._name = props.name;
    paymentType._description = props.description ?? '';
    paymentType._active = true;
    paymentType._rules = [];

    return paymentType;
  }

  update(props: UpdatePaymentTypeProps): void {
    if (props.name !== undefined) {
      PaymentTypeEntity.validateName(props.name);
      this._name = props.name;
    }

    if (props.description !== undefined) {
      PaymentTypeEntity.validateDescription(props.description);
      this._description = props.description;
    }

    if (props.active !== undefined) {
      this._active = props.active;
    }
  }

  deactivate(): void {
    this._active = false;
  }

  activate(): void {
    this._active = true;
  }

  addRule(rule: AcceptanceRule): void {
    if (!this._rules) {
      this._rules = [];
    }
    this._rules.push(rule);
  }

  private static validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationException('Name is required', {
        name: ['name must be between 1 and 100 characters'],
      });
    }

    if (name.length > 100) {
      throw new ValidationException('Name exceeds maximum length', {
        name: ['name must be between 1 and 100 characters'],
      });
    }
  }

  private static validateDescription(description: string): void {
    if (description.length > 500) {
      throw new ValidationException('Description exceeds maximum length', {
        description: ['description must be at most 500 characters'],
      });
    }
  }
}

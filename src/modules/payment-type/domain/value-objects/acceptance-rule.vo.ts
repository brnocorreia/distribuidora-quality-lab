import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ValidationException } from '@shared/domain/exceptions';

@Entity('acceptance_rules')
export class AcceptanceRule {
  static readonly MIN_ALLOWED_VALUE = 0.01;
  static readonly MAX_ALLOWED_VALUE = 999999999.99;

  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  private _id: string;

  @Column('decimal', { precision: 12, scale: 2, name: 'min_value' })
  private _minValue: number;

  @Column('decimal', { precision: 12, scale: 2, name: 'max_value' })
  private _maxValue: number;

  @ManyToOne('PaymentTypeEntity', 'rules')
  @JoinColumn({ name: 'payment_type_id' })
  private _paymentType: unknown;

  @CreateDateColumn({ name: 'created_at' })
  private _createdAt: Date;

  get id(): string {
    return this._id;
  }

  get minValue(): number {
    return Number(this._minValue);
  }

  get maxValue(): number {
    return Number(this._maxValue);
  }

  get paymentType(): unknown {
    return this._paymentType;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  static create(minValue: number, maxValue: number): AcceptanceRule {
    AcceptanceRule.validateValue(minValue, 'minValue');
    AcceptanceRule.validateValue(maxValue, 'maxValue');
    AcceptanceRule.validateMinLessThanOrEqualMax(minValue, maxValue);

    const rule = new AcceptanceRule();
    rule._minValue = minValue;
    rule._maxValue = maxValue;

    return rule;
  }

  isValueAccepted(value: number): boolean {
    return value >= this.minValue && value <= this.maxValue;
  }

  equals(other: AcceptanceRule): boolean {
    if (other === this) return true;
    if (!(other instanceof AcceptanceRule)) return false;
    return this.minValue === other.minValue && this.maxValue === other.maxValue;
  }

  private static validateValue(value: number, field: string): void {
    if (value < AcceptanceRule.MIN_ALLOWED_VALUE || value > AcceptanceRule.MAX_ALLOWED_VALUE) {
      throw new ValidationException(`Invalid ${field}`, {
        [field]: [
          `${field} must be between ${AcceptanceRule.MIN_ALLOWED_VALUE} and ${AcceptanceRule.MAX_ALLOWED_VALUE}`,
        ],
      });
    }
  }

  private static validateMinLessThanOrEqualMax(minValue: number, maxValue: number): void {
    if (minValue > maxValue) {
      throw new ValidationException('Invalid acceptance rule range', {
        minValue: ['minValue must be less than or equal to maxValue'],
      });
    }
  }
}

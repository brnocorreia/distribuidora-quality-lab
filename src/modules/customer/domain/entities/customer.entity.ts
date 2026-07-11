import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Entity as DomainEntity } from '@shared/domain/entity';
import { ValidationException } from '@shared/domain/exceptions/validation.exception';
import { Document } from '../value-objects/document.vo';

interface CreateCustomerProps {
  name: string;
  document: string;
  email: string;
  phone: string;
}

interface UpdateCustomerProps {
  name?: string;
  email?: string;
  phone?: string;
}

@Entity('customers')
export class CustomerEntity extends DomainEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  private _id: string;

  @Column({ name: 'name', length: 150 })
  private _name: string;

  @Column({ name: 'document', length: 14 })
  private _document: string;

  @Column({ name: 'email', length: 254, unique: true })
  private _email: string;

  @Column({ name: 'phone', length: 11 })
  private _phone: string;

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

  get document(): string {
    return this._document;
  }

  get email(): string {
    return this._email;
  }

  get phone(): string {
    return this._phone;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static create(props: CreateCustomerProps): CustomerEntity {
    CustomerEntity.validateName(props.name);
    CustomerEntity.validateEmail(props.email);
    CustomerEntity.validatePhone(props.phone);

    const documentVo = Document.create(props.document);

    const customer = new CustomerEntity();
    customer._name = props.name;
    customer._document = documentVo.value;
    customer._email = props.email;
    customer._phone = props.phone.replace(/\D/g, '');

    return customer;
  }

  update(props: UpdateCustomerProps): void {
    if (props.name !== undefined) {
      CustomerEntity.validateName(props.name);
      this._name = props.name;
    }

    if (props.email !== undefined) {
      CustomerEntity.validateEmail(props.email);
      this._email = props.email;
    }

    if (props.phone !== undefined) {
      CustomerEntity.validatePhone(props.phone);
      this._phone = props.phone.replace(/\D/g, '');
    }
  }

  private static validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationException('Name is required', {
        field: 'name',
        constraint: 'Name must be between 1 and 150 characters',
      });
    }

    if (name.length > 150) {
      throw new ValidationException('Name exceeds maximum length', {
        field: 'name',
        constraint: 'Name must be between 1 and 150 characters',
        received: name.length,
      });
    }
  }

  private static validateEmail(email: string): void {
    if (!email || !email.includes('@')) {
      throw new ValidationException('Invalid email format', {
        field: 'email',
        constraint: 'Email must contain @ and a domain',
      });
    }

    if (email.length > 254) {
      throw new ValidationException('Email exceeds maximum length', {
        field: 'email',
        constraint: 'Email must be at most 254 characters',
        received: email.length,
      });
    }

    const parts = email.split('@');
    if (parts.length !== 2 || !parts[1] || !parts[1].includes('.')) {
      throw new ValidationException('Invalid email format', {
        field: 'email',
        constraint: 'Email must contain @ and a valid domain',
      });
    }
  }

  private static validatePhone(phone: string): void {
    const digits = phone.replace(/\D/g, '');

    if (digits.length < 10 || digits.length > 11) {
      throw new ValidationException('Invalid phone number', {
        field: 'phone',
        constraint: 'Phone must have 10 or 11 digits',
        received: digits.length,
      });
    }
  }
}

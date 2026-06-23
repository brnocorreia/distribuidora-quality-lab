import { Injectable, Inject } from '@nestjs/common';
import { OrderAggregate } from '../../domain/aggregates/order.aggregate';
import { OrderRepository, ORDER_REPOSITORY } from '../../domain/repositories/order.repository';
import {
  CustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../../customer/domain/repositories/customer.repository';
import { NotFoundException } from '@shared/domain/exceptions';
import { LoggerService } from '@shared/infrastructure/logging/logger.service';

export interface CreateOrderInput {
  customerId: string;
  paymentTypeId?: string;
}

export interface CreateOrderOutput {
  id: string;
  customerId: string;
  status: string;
  totalAmount: number;
  paymentTypeId: string | null;
  items: [];
  createdAt: Date;
}

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
    private readonly logger: LoggerService,
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const customer = await this.customerRepository.findById(input.customerId);

    if (!customer) {
      this.logger.logStructured('warn', 'Customer not found', {
        context: 'CreateOrderUseCase',
        customerId: input.customerId,
      });
      throw new NotFoundException(`Customer with id ${input.customerId} not found`);
    }

    const order = OrderAggregate.create({
      customerId: input.customerId,
      paymentTypeId: input.paymentTypeId,
    });

    const saved = await this.orderRepository.save(order);

    this.logger.logStructured('info', 'Order created', {
      context: 'CreateOrderUseCase',
      orderId: saved.id,
      customerId: saved.customerId,
      paymentTypeId: saved.paymentTypeId,
    });

    return {
      id: saved.id,
      customerId: saved.customerId,
      status: saved.status,
      totalAmount: saved.totalAmount,
      paymentTypeId: saved.paymentTypeId,
      items: [],
      createdAt: saved.createdAt,
    };
  }
}

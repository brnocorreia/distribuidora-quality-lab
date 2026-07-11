import { Injectable, Inject } from '@nestjs/common';
import { OrderRepository, ORDER_REPOSITORY } from '../../domain/repositories/order.repository';
import {
  PaymentTypeRepository,
  PAYMENT_TYPE_REPOSITORY,
} from '../../../payment-type/domain/repositories/payment-type.repository';
import { BusinessRuleException, NotFoundException } from '@shared/domain/exceptions';
import { LoggerService } from '@shared/infrastructure/logging/logger.service';

export interface SetOrderPaymentTypeInput {
  orderId: string;
  paymentTypeId: string;
  correlationId?: string;
}

export interface SetOrderPaymentTypeOutput {
  id: string;
  status: string;
  totalAmount: number;
  paymentTypeId: string;
  updatedAt: Date;
}

@Injectable()
export class SetOrderPaymentTypeUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(PAYMENT_TYPE_REPOSITORY)
    private readonly paymentTypeRepository: PaymentTypeRepository,
    private readonly logger: LoggerService,
  ) {}

  async execute(input: SetOrderPaymentTypeInput): Promise<SetOrderPaymentTypeOutput> {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      this.logger.logStructured('warn', 'Order not found', {
        context: 'SetOrderPaymentTypeUseCase',
        correlationId: input.correlationId,
        orderId: input.orderId,
      });
      throw new NotFoundException(`Order with id ${input.orderId} not found`);
    }

    const paymentType = await this.paymentTypeRepository.findById(input.paymentTypeId);

    if (!paymentType) {
      this.logger.logStructured('warn', 'Payment type not found', {
        context: 'SetOrderPaymentTypeUseCase',
        correlationId: input.correlationId,
        orderId: input.orderId,
        paymentTypeId: input.paymentTypeId,
      });
      throw new NotFoundException('Payment type not found', {
        paymentTypeId: input.paymentTypeId,
      });
    }

    if (!paymentType.active) {
      this.logger.logStructured('warn', 'Payment type is inactive', {
        context: 'SetOrderPaymentTypeUseCase',
        correlationId: input.correlationId,
        orderId: input.orderId,
        paymentTypeId: input.paymentTypeId,
      });
      throw new BusinessRuleException('Payment type is inactive', {
        paymentTypeId: input.paymentTypeId,
        paymentTypeName: paymentType.name,
        reason: 'Payment type is not active and cannot be used for orders',
      });
    }

    order.setPaymentType(input.paymentTypeId);

    const saved = await this.orderRepository.save(order);

    this.logger.logStructured('info', 'Order payment type set', {
      context: 'SetOrderPaymentTypeUseCase',
      correlationId: input.correlationId,
      orderId: saved.id,
      paymentTypeId: saved.paymentTypeId,
    });

    return {
      id: saved.id,
      status: saved.status,
      totalAmount: saved.totalAmount,
      paymentTypeId: saved.paymentTypeId as string,
      updatedAt: saved.updatedAt,
    };
  }
}

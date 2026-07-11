import { Injectable, Inject } from '@nestjs/common';
import { OrderRepository, ORDER_REPOSITORY } from '../../domain/repositories/order.repository';
import { OrderStatusValue } from '../../domain/value-objects/order-status.vo';
import { NotFoundException } from '@shared/domain/exceptions';
import { LoggerService } from '@shared/infrastructure/logging/logger.service';

export interface TransitionOrderStatusInput {
  orderId: string;
  targetStatus: OrderStatusValue;
  correlationId?: string;
}

export interface TransitionOrderStatusOutput {
  id: string;
  previousStatus: string;
  currentStatus: string;
  updatedAt: Date;
}

@Injectable()
export class TransitionOrderStatusUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    private readonly logger: LoggerService,
  ) {}

  async execute(input: TransitionOrderStatusInput): Promise<TransitionOrderStatusOutput> {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      this.logger.logStructured('warn', 'Order not found', {
        context: 'TransitionOrderStatusUseCase',
        correlationId: input.correlationId,
        orderId: input.orderId,
      });
      throw new NotFoundException(`Order with id ${input.orderId} not found`);
    }

    const previousStatus = order.status;

    order.transitionTo(input.targetStatus);

    await this.orderRepository.save(order);

    this.logger.logStructured('info', 'Order status transitioned', {
      context: 'TransitionOrderStatusUseCase',
      correlationId: input.correlationId,
      orderId: order.id,
      previousStatus,
      currentStatus: order.status,
    });

    return {
      id: order.id,
      previousStatus,
      currentStatus: order.status,
      updatedAt: order.updatedAt,
    };
  }
}

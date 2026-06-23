import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrderRepository, ORDER_REPOSITORY } from '../../domain/repositories/order.repository';
import { InventoryMovement } from '../../../inventory/domain/entities/inventory-movement.entity';
import { OrderAggregate } from '../../domain/aggregates/order.aggregate';
import { NotFoundException } from '@shared/domain/exceptions';
import { LoggerService } from '@shared/infrastructure/logging/logger.service';

export interface CancelOrderInput {
  orderId: string;
}

export interface CancelOrderOutput {
  id: string;
  previousStatus: string;
  currentStatus: string;
  stockReverted: boolean;
  updatedAt: Date;
}

@Injectable()
export class CancelOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    private readonly dataSource: DataSource,
    private readonly logger: LoggerService,
  ) {}

  async execute(input: CancelOrderInput): Promise<CancelOrderOutput> {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      this.logger.logStructured('warn', 'Order not found', {
        context: 'CancelOrderUseCase',
        orderId: input.orderId,
      });
      throw new NotFoundException(`Order with id ${input.orderId} not found`);
    }

    const previousStatus = order.status;

    order.cancel();

    const shouldRevertStock = previousStatus === 'confirmed' || previousStatus === 'in_separation';

    await this.dataSource.transaction(async (manager) => {
      if (shouldRevertStock) {
        for (const item of order.items) {
          const movement = InventoryMovement.create({
            productId: item.productId,
            type: 'entry',
            quantity: item.quantity,
          });
          await manager.save(InventoryMovement, movement);
        }
      }
      await manager.save(OrderAggregate, order);
    });

    this.logger.logStructured('info', 'Order cancelled', {
      context: 'CancelOrderUseCase',
      orderId: order.id,
      previousStatus,
      currentStatus: order.status,
      stockReverted: shouldRevertStock,
    });

    return {
      id: order.id,
      previousStatus,
      currentStatus: order.status,
      stockReverted: shouldRevertStock,
      updatedAt: order.updatedAt,
    };
  }
}

import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrderRepository, ORDER_REPOSITORY } from '../../domain/repositories/order.repository';
import {
  InventoryRepository,
  INVENTORY_REPOSITORY,
} from '../../../inventory/domain/repositories/inventory.repository';
import { InventoryMovement } from '../../../inventory/domain/entities/inventory-movement.entity';
import { OrderAggregate } from '../../domain/aggregates/order.aggregate';
import { NotFoundException, BusinessRuleException } from '@shared/domain/exceptions';
import { ValidatePaymentForOrderUseCase } from '../../../payment-type/application/use-cases/validate-payment-for-order.use-case';
import { LoggerService } from '@shared/infrastructure/logging/logger.service';

export interface ConfirmOrderInput {
  orderId: string;
}

export interface InsufficientStockItem {
  productId: string;
  requested: number;
  available: number;
}

export interface ConfirmOrderOutput {
  id: string;
  status: string;
  totalAmount: number;
  confirmedAt: Date;
}

@Injectable()
export class ConfirmOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepository,
    private readonly validatePayment: ValidatePaymentForOrderUseCase,
    private readonly dataSource: DataSource,
    private readonly logger: LoggerService,
  ) {}

  async execute(input: ConfirmOrderInput): Promise<ConfirmOrderOutput> {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      this.logger.logStructured('warn', 'Order not found', {
        context: 'ConfirmOrderUseCase',
        orderId: input.orderId,
      });
      throw new NotFoundException(`Order with id ${input.orderId} not found`);
    }

    if (order.items.length === 0) {
      this.logger.logStructured('warn', 'Cannot confirm order without items', {
        context: 'ConfirmOrderUseCase',
        orderId: input.orderId,
      });
      throw new BusinessRuleException('Cannot confirm an order without items', {
        orderId: input.orderId,
      });
    }

    if (!order.paymentTypeId) {
      this.logger.logStructured('warn', 'Cannot confirm order without payment method', {
        context: 'ConfirmOrderUseCase',
        orderId: input.orderId,
      });
      throw new BusinessRuleException('Cannot confirm an order without a payment method', {
        orderId: input.orderId,
      });
    }

    await this.validatePayment.execute({
      paymentTypeId: order.paymentTypeId,
      orderValue: order.totalAmount,
    });

    this.logger.logStructured('info', 'Confirming order', {
      context: 'ConfirmOrderUseCase',
      orderId: input.orderId,
      totalAmount: order.totalAmount,
      itemCount: order.items.length,
    });

    const consolidatedDemand = new Map<string, number>();
    for (const item of order.items) {
      const current = consolidatedDemand.get(item.productId) || 0;
      consolidatedDemand.set(item.productId, current + item.quantity);
    }

    await this.dataSource.transaction(async (manager) => {
      const balanceChecks = Array.from(consolidatedDemand.entries()).map(
        async ([productId, quantity]) => {
          const balance = await this.inventoryRepository.getBalance(productId);
          if (balance < quantity) {
            this.logger.logStructured('warn', 'Insufficient stock', {
              context: 'ConfirmOrderUseCase',
              orderId: input.orderId,
              productId,
              requested: quantity,
              available: balance,
            });
            throw new BusinessRuleException(
              `Insufficient stock for product ${productId}. Requested: ${quantity}, Available: ${balance}`,
            );
          }
        },
      );

      await Promise.all(balanceChecks);

      order.confirm();
      await manager.save(OrderAggregate, order);

      const movementInserts = Array.from(consolidatedDemand.entries()).map(
        ([productId, quantity]) => {
          const movement = InventoryMovement.create({
            productId,
            type: 'withdrawal',
            quantity,
            reason: `Order ${input.orderId} confirmation`,
          });
          return manager.save(InventoryMovement, movement);
        },
      );

      await Promise.all(movementInserts);
    });

    this.logger.logStructured('info', 'Order confirmed', {
      context: 'ConfirmOrderUseCase',
      orderId: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
    });

    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      confirmedAt: order.updatedAt,
    };
  }
}

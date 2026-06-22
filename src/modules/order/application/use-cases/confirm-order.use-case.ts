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
  ) {}

  async execute(input: ConfirmOrderInput): Promise<ConfirmOrderOutput> {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      throw new NotFoundException(`Order with id ${input.orderId} not found`);
    }

    if (order.items.length === 0) {
      throw new BusinessRuleException('Cannot confirm an order without items', {
        orderId: input.orderId,
      });
    }

    if (!order.paymentTypeId) {
      throw new BusinessRuleException('Cannot confirm an order without a payment method', {
        orderId: input.orderId,
      });
    }
    await this.validatePayment.execute({
      paymentTypeId: order.paymentTypeId,
      orderValue: order.totalAmount,
    });

    const consolidatedDemand = new Map<string, number>();
    for (const item of order.items) {
      const current = consolidatedDemand.get(item.productId) || 0;
      consolidatedDemand.set(item.productId, current + item.quantity);
    }

    const insufficientItems: InsufficientStockItem[] = [];

    for (const [productId, quantity] of consolidatedDemand.entries()) {
      const balance = await this.inventoryRepository.getBalance(productId);
      if (balance < quantity) {
        insufficientItems.push({
          productId,
          requested: quantity,
          available: balance,
        });
      }
    }

    if (insufficientItems.length > 0) {
      throw new BusinessRuleException('Insufficient stock for one or more items', {
        items: insufficientItems,
      });
    }

    order.confirm();

    await this.dataSource.transaction(async (manager) => {
      for (const [productId, quantity] of consolidatedDemand.entries()) {
        const movement = InventoryMovement.create({
          productId,
          type: 'withdrawal',
          quantity,
          reason: `Order ${input.orderId} confirmation`,
        });
        await manager.save(InventoryMovement, movement);
      }
      await manager.save(OrderAggregate, order);
    });

    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      confirmedAt: order.updatedAt,
    };
  }
}

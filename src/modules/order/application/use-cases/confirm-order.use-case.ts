import { Injectable, Inject } from '@nestjs/common';
import { OrderRepository, ORDER_REPOSITORY } from '../../domain/repositories/order.repository';
import {
  InventoryRepository,
  INVENTORY_REPOSITORY,
} from '../../../inventory/domain/repositories/inventory.repository';
import { InventoryMovement } from '../../../inventory/domain/entities/inventory-movement.entity';
import { NotFoundException, BusinessRuleException } from '@shared/domain/exceptions';

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
  ) {}

  async execute(input: ConfirmOrderInput): Promise<ConfirmOrderOutput> {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      throw new NotFoundException(`Order with id ${input.orderId} not found`);
    }

    // Req 4.10: Reject confirmation of order without items
    if (order.items.length === 0) {
      throw new BusinessRuleException('Cannot confirm an order without items', {
        orderId: input.orderId,
      });
    }

    // Req 4.7: Validate stock for all items BEFORE transitioning state
    const insufficientItems: InsufficientStockItem[] = [];

    for (const item of order.items) {
      const balance = await this.inventoryRepository.getBalance(item.productId);
      if (balance < item.quantity) {
        insufficientItems.push({
          productId: item.productId,
          requested: item.quantity,
          available: balance,
        });
      }
    }

    if (insufficientItems.length > 0) {
      throw new BusinessRuleException('Insufficient stock for one or more items', {
        items: insufficientItems,
      });
    }

    // Only transition state after all validations pass
    order.confirm();

    // Req 4.6: Decrement stock for each item
    for (const item of order.items) {
      const movement = InventoryMovement.create({
        productId: item.productId,
        type: 'withdrawal',
        quantity: item.quantity,
        reason: `Order ${input.orderId} confirmation`,
      });
      await this.inventoryRepository.save(movement);
    }

    await this.orderRepository.save(order);

    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      confirmedAt: order.updatedAt,
    };
  }
}

import { Injectable, Inject } from '@nestjs/common';
import { OrderRepository, ORDER_REPOSITORY } from '../../domain/repositories/order.repository';
import { NotFoundException } from '@shared/domain/exceptions';
import { LoggerService } from '@shared/infrastructure/logging/logger.service';

export interface UpdateOrderItemQuantityInput {
  orderId: string;
  itemId: string;
  quantity: number;
  correlationId?: string;
}

export interface UpdateOrderItemQuantityOutput {
  orderId: string;
  itemId: string;
  quantity: number;
  subtotal: number;
  totalAmount: number;
  itemCount: number;
}

@Injectable()
export class UpdateOrderItemQuantityUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    private readonly logger: LoggerService,
  ) {}

  async execute(input: UpdateOrderItemQuantityInput): Promise<UpdateOrderItemQuantityOutput> {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      this.logger.logStructured('warn', 'Order not found', {
        context: 'UpdateOrderItemQuantityUseCase',
        correlationId: input.correlationId,
        orderId: input.orderId,
      });
      throw new NotFoundException(`Order with id ${input.orderId} not found`);
    }

    order.updateItemQuantity(input.itemId, input.quantity);
    const updatedItem = order.items.find((item) => item.id === input.itemId);

    await this.orderRepository.save(order);

    this.logger.logStructured('info', 'Order item quantity updated', {
      context: 'UpdateOrderItemQuantityUseCase',
      correlationId: input.correlationId,
      orderId: input.orderId,
      itemId: input.itemId,
      quantity: input.quantity,
      totalAmount: order.totalAmount,
      itemCount: order.items.length,
    });

    return {
      orderId: input.orderId,
      itemId: input.itemId,
      quantity: updatedItem!.quantity,
      subtotal: updatedItem!.subtotal,
      totalAmount: order.totalAmount,
      itemCount: order.items.length,
    };
  }
}

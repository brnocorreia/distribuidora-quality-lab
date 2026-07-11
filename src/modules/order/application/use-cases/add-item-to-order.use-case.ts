import { Injectable, Inject } from '@nestjs/common';
import { OrderRepository, ORDER_REPOSITORY } from '../../domain/repositories/order.repository';
import { ProductRepository } from '../../../product/domain/repositories/product.repository';
import { BusinessRuleException, NotFoundException } from '@shared/domain/exceptions';
import { LoggerService } from '@shared/infrastructure/logging/logger.service';

export interface AddItemToOrderInput {
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  correlationId?: string;
}

export interface AddItemToOrderOutput {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

@Injectable()
export class AddItemToOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    @Inject('ProductRepository')
    private readonly productRepository: ProductRepository,
    private readonly logger: LoggerService,
  ) {}

  async execute(input: AddItemToOrderInput): Promise<AddItemToOrderOutput> {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      this.logger.logStructured('warn', 'Order not found', {
        context: 'AddItemToOrderUseCase',
        correlationId: input.correlationId,
        orderId: input.orderId,
      });
      throw new NotFoundException(`Order with id ${input.orderId} not found`);
    }

    const product = await this.productRepository.findById(input.productId);

    if (!product) {
      this.logger.logStructured('warn', 'Product not found', {
        context: 'AddItemToOrderUseCase',
        correlationId: input.correlationId,
        orderId: input.orderId,
        productId: input.productId,
      });
      throw new NotFoundException(`Product with id ${input.productId} not found`);
    }

    if (product.available === false) {
      this.logger.logStructured('warn', 'Product is unavailable', {
        context: 'AddItemToOrderUseCase',
        correlationId: input.correlationId,
        orderId: input.orderId,
        productId: input.productId,
      });
      throw new BusinessRuleException('Product is unavailable', {
        productId: input.productId,
        reason: 'Product is unavailable and cannot be added to orders',
      });
    }

    const inputPriceInCents = Math.round(input.unitPrice * 100);
    const productPriceInCents = Math.round(product.unitPrice * 100);

    if (inputPriceInCents !== productPriceInCents) {
      this.logger.logStructured('warn', 'Unit price does not match product price', {
        context: 'AddItemToOrderUseCase',
        correlationId: input.correlationId,
        orderId: input.orderId,
        productId: input.productId,
      });
      throw new BusinessRuleException('Unit price does not match product price', {
        productId: input.productId,
        providedUnitPrice: input.unitPrice,
        productUnitPrice: product.unitPrice,
      });
    }

    const item = order.addItem(input.productId, input.quantity, input.unitPrice);

    await this.orderRepository.save(order);

    this.logger.logStructured('info', 'Item added to order', {
      context: 'AddItemToOrderUseCase',
      correlationId: input.correlationId,
      orderId: input.orderId,
      productId: item.productId,
      quantity: item.quantity,
      subtotal: item.subtotal,
    });

    return {
      id: item.id,
      orderId: input.orderId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    };
  }
}

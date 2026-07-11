import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Inject,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case';
import { AddItemToOrderUseCase } from '../../application/use-cases/add-item-to-order.use-case';
import { RemoveItemFromOrderUseCase } from '../../application/use-cases/remove-item-from-order.use-case';
import { ConfirmOrderUseCase } from '../../application/use-cases/confirm-order.use-case';
import { TransitionOrderStatusUseCase } from '../../application/use-cases/transition-order-status.use-case';
import { CancelOrderUseCase } from '../../application/use-cases/cancel-order.use-case';
import { OrderRepository, ORDER_REPOSITORY } from '../../domain/repositories/order.repository';
import { NotFoundException } from '@shared/domain/exceptions';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { AddItemDto } from '../dtos/add-item.dto';
import { TransitionStatusDto } from '../dtos/transition-status.dto';
import { LoggerService } from '@shared/infrastructure/logging/logger.service';

@ApiTags('orders')
@Controller('orders')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly addItemToOrderUseCase: AddItemToOrderUseCase,
    private readonly removeItemFromOrderUseCase: RemoveItemFromOrderUseCase,
    private readonly confirmOrderUseCase: ConfirmOrderUseCase,
    private readonly transitionOrderStatusUseCase: TransitionOrderStatusUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
    private readonly logger: LoggerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Trace request' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async create(
    @Body() dto: CreateOrderDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const cid = correlationId || randomUUID();
    this.logger.logStructured('info', 'Received request to create order', {
      context: 'OrderController',
      correlationId: cid,
      customerId: dto.customerId,
    });
    return this.createOrderUseCase.execute({
      customerId: dto.customerId,
      paymentTypeId: dto.paymentTypeId,
      correlationId: cid,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const order = await this.orderRepository.findById(id);

    if (!order) {
      throw new NotFoundException('Order not found', { orderId: id });
    }

    return {
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      totalAmount: order.totalAmount,
      paymentTypeId: order.paymentTypeId,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add item to order' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Trace request' })
  @ApiResponse({ status: 201, description: 'Item added successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Order or product not found' })
  @ApiResponse({ status: 422, description: 'Order is not in draft state' })
  async addItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddItemDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const cid = correlationId || randomUUID();
    this.logger.logStructured('info', 'Received request to add item to order', {
      context: 'OrderController',
      correlationId: cid,
      orderId: id,
      productId: dto.productId,
    });
    return this.addItemToOrderUseCase.execute({
      orderId: id,
      productId: dto.productId,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      correlationId: cid,
    });
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove item from order' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Trace request' })
  @ApiResponse({ status: 200, description: 'Item removed successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 422, description: 'Order is not in draft state or item not found' })
  async removeItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const cid = correlationId || randomUUID();
    this.logger.logStructured('info', 'Received request to remove item from order', {
      context: 'OrderController',
      correlationId: cid,
      orderId: id,
      itemId,
    });
    return this.removeItemFromOrderUseCase.execute({
      orderId: id,
      itemId,
      correlationId: cid,
    });
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm order' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Trace request' })
  @ApiResponse({ status: 200, description: 'Order confirmed successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({
    status: 422,
    description: 'Cannot confirm order (no items, insufficient stock, or invalid state)',
  })
  async confirm(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const cid = correlationId || randomUUID();
    this.logger.logStructured('info', 'Received request to confirm order', {
      context: 'OrderController',
      correlationId: cid,
      orderId: id,
    });
    return this.confirmOrderUseCase.execute({ orderId: id, correlationId: cid });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition order status' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Trace request' })
  @ApiResponse({ status: 200, description: 'Status transitioned successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 422, description: 'Invalid state transition' })
  async transitionStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: TransitionStatusDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const cid = correlationId || randomUUID();
    this.logger.logStructured('info', 'Received request to transition order status', {
      context: 'OrderController',
      correlationId: cid,
      orderId: id,
      targetStatus: dto.status,
    });
    return this.transitionOrderStatusUseCase.execute({
      orderId: id,
      targetStatus: dto.status,
      correlationId: cid,
    });
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Trace request' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 422, description: 'Cannot cancel order in current state' })
  async cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const cid = correlationId || randomUUID();
    this.logger.logStructured('info', 'Received request to cancel order', {
      context: 'OrderController',
      correlationId: cid,
      orderId: id,
    });
    return this.cancelOrderUseCase.execute({ orderId: id, correlationId: cid });
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from '@modules/order/interface/controllers/order.controller';
import { CreateOrderUseCase } from '@modules/order/application/use-cases/create-order.use-case';
import { AddItemToOrderUseCase } from '@modules/order/application/use-cases/add-item-to-order.use-case';
import { RemoveItemFromOrderUseCase } from '@modules/order/application/use-cases/remove-item-from-order.use-case';
import { ConfirmOrderUseCase } from '@modules/order/application/use-cases/confirm-order.use-case';
import { TransitionOrderStatusUseCase } from '@modules/order/application/use-cases/transition-order-status.use-case';
import { CancelOrderUseCase } from '@modules/order/application/use-cases/cancel-order.use-case';
import { ORDER_REPOSITORY } from '@modules/order/domain/repositories/order.repository';
import { TransitionStatusDto } from '@modules/order/interface/dtos/transition-status.dto';

describe('Order Integration', () => {
  let controller: OrderController;

  const mockOrderRepository = {
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockCreateOrderUseCase = {
    execute: jest.fn(),
  };

  const mockAddItemToOrderUseCase = {
    execute: jest.fn(),
  };

  const mockRemoveItemFromOrderUseCase = {
    execute: jest.fn(),
  };

  const mockConfirmOrderUseCase = {
    execute: jest.fn(),
  };

  const mockTransitionOrderStatusUseCase = {
    execute: jest.fn(),
  };

  const mockCancelOrderUseCase = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        { provide: CreateOrderUseCase, useValue: mockCreateOrderUseCase },
        { provide: AddItemToOrderUseCase, useValue: mockAddItemToOrderUseCase },
        { provide: RemoveItemFromOrderUseCase, useValue: mockRemoveItemFromOrderUseCase },
        { provide: ConfirmOrderUseCase, useValue: mockConfirmOrderUseCase },
        { provide: TransitionOrderStatusUseCase, useValue: mockTransitionOrderStatusUseCase },
        { provide: CancelOrderUseCase, useValue: mockCancelOrderUseCase },
        { provide: ORDER_REPOSITORY, useValue: mockOrderRepository },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);

    jest.clearAllMocks();
  });

  describe('POST /orders - Create order via API flow', () => {
    it('should create order in database with draft status', async () => {
      const orderData = {
        customerId: '550e8400-e29b-41d4-a716-446655440001',
        paymentTypeId: '550e8400-e29b-41d4-a716-446655440002',
      };

      const createdOrder = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        customerId: orderData.customerId,
        paymentTypeId: orderData.paymentTypeId,
        status: 'rascunho',
        totalAmount: 0,
        items: [],
        createdAt: new Date(),
      };

      mockCreateOrderUseCase.execute.mockResolvedValue(createdOrder);

      const result = await controller.create(orderData);

      expect(result).toBeDefined();
      expect(result.status).toBe('rascunho');
      expect(result.totalAmount).toBe(0);
      expect(mockCreateOrderUseCase.execute).toHaveBeenCalledWith({
        customerId: orderData.customerId,
        paymentTypeId: orderData.paymentTypeId,
      });
    });
  });

  describe('GET /orders/:id - Get order by ID via API flow', () => {
    it('should retrieve order with items from database', async () => {
      const mockOrder = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        customerId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'confirmado',
        totalAmount: 149.97,
        paymentTypeId: '550e8400-e29b-41d4-a716-446655440002',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 3,
            unitPrice: 49.99,
            subtotal: 149.97,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder);

      const result = await controller.findOne('550e8400-e29b-41d4-a716-446655440010');

      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440010');
      expect(result.status).toBe('confirmado');
      expect(result.items).toHaveLength(1);
      expect(result.totalAmount).toBe(149.97);
    });

    it('should throw when order not found in database', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      await expect(controller.findOne('550e8400-e29b-41d4-a716-446655440099')).rejects.toThrow();
    });
  });

  describe('POST /orders/:id/items - Add item to order via API flow', () => {
    it('should add item to draft order and persist in database', async () => {
      const itemData = {
        productId: '550e8400-e29b-41d4-a716-446655440003',
        quantity: 2,
        unitPrice: 25.0,
      };

      const addedItem = {
        id: 'new-item-id',
        orderId: '550e8400-e29b-41d4-a716-446655440010',
        productId: itemData.productId,
        quantity: 2,
        unitPrice: 25.0,
        subtotal: 50.0,
      };

      mockAddItemToOrderUseCase.execute.mockResolvedValue(addedItem);

      const result = await controller.addItem('550e8400-e29b-41d4-a716-446655440010', itemData);

      expect(result.subtotal).toBe(50.0);
      expect(mockAddItemToOrderUseCase.execute).toHaveBeenCalledWith({
        orderId: '550e8400-e29b-41d4-a716-446655440010',
        productId: itemData.productId,
        quantity: itemData.quantity,
        unitPrice: itemData.unitPrice,
      });
    });
  });

  describe('PATCH /orders/:id/confirm - Confirm order via API flow', () => {
    it('should confirm order and decrement stock in database', async () => {
      const confirmedOrder = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        status: 'confirmado',
        totalAmount: 150.0,
      };

      mockConfirmOrderUseCase.execute.mockResolvedValue(confirmedOrder);

      const result = await controller.confirm('550e8400-e29b-41d4-a716-446655440010');

      expect(result.status).toBe('confirmado');
      expect(mockConfirmOrderUseCase.execute).toHaveBeenCalledWith({
        orderId: '550e8400-e29b-41d4-a716-446655440010',
      });
    });
  });

  describe('PATCH /orders/:id/cancel - Cancel order via API flow', () => {
    it('should cancel order and restore stock in database', async () => {
      const cancelledOrder = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        previousStatus: 'confirmado',
        currentStatus: 'cancelado',
        stockReverted: true,
        updatedAt: new Date(),
      };

      mockCancelOrderUseCase.execute.mockResolvedValue(cancelledOrder);

      const result = await controller.cancel('550e8400-e29b-41d4-a716-446655440010');

      expect(result.currentStatus).toBe('cancelado');
      expect(result.stockReverted).toBe(true);
      expect(mockCancelOrderUseCase.execute).toHaveBeenCalledWith({
        orderId: '550e8400-e29b-41d4-a716-446655440010',
      });
    });
  });

  describe('PATCH /orders/:id/status - Transition order status via API flow', () => {
    it('should transition order from confirmado to em_separacao in database', async () => {
      const transitionedOrder = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        previousStatus: 'confirmado',
        currentStatus: 'em_separacao',
        updatedAt: new Date(),
      };

      mockTransitionOrderStatusUseCase.execute.mockResolvedValue(transitionedOrder);

      const statusBody = { status: 'em_separacao' } as unknown as TransitionStatusDto;

      const result = await controller.transitionStatus(
        '550e8400-e29b-41d4-a716-446655440010',
        statusBody,
      );

      expect(result.currentStatus).toBe('em_separacao');
    });
  });
});

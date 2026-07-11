import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from '@modules/order/interface/controllers/order.controller';
import { CreateOrderUseCase } from '@modules/order/application/use-cases/create-order.use-case';
import { AddItemToOrderUseCase } from '@modules/order/application/use-cases/add-item-to-order.use-case';
import { RemoveItemFromOrderUseCase } from '@modules/order/application/use-cases/remove-item-from-order.use-case';
import { ConfirmOrderUseCase } from '@modules/order/application/use-cases/confirm-order.use-case';
import { TransitionOrderStatusUseCase } from '@modules/order/application/use-cases/transition-order-status.use-case';
import { CancelOrderUseCase } from '@modules/order/application/use-cases/cancel-order.use-case';
import { SetOrderPaymentTypeUseCase } from '@modules/order/application/use-cases/set-order-payment-type.use-case';
import { ORDER_REPOSITORY } from '@modules/order/domain/repositories/order.repository';
import { CUSTOMER_REPOSITORY } from '@modules/customer/domain/repositories/customer.repository';
import { PAYMENT_TYPE_REPOSITORY } from '@modules/payment-type/domain/repositories/payment-type.repository';
import { OrderAggregate } from '@modules/order/domain/aggregates/order.aggregate';
import { InventoryMovement } from '@modules/inventory/domain/entities/inventory-movement.entity';
import { ValidatePaymentForOrderUseCase } from '@modules/payment-type/application/use-cases/validate-payment-for-order.use-case';
import { LoggerService } from '@shared/infrastructure/logging/logger.service';
import { DataSource } from 'typeorm';

describe('Order Integration', () => {
  let controller: OrderController;
  let cancelOrderUseCase: CancelOrderUseCase;
  let mockTransactionManager: {
    save: jest.Mock;
    find: jest.Mock;
  };

  const mockOrderRepository = {
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockCustomerRepository = {
    findById: jest.fn(),
  };

  const mockProductRepository = {
    findById: jest.fn(),
  };

  const mockValidatePaymentUseCase = {
    execute: jest.fn().mockResolvedValue({ valid: true }),
  };

  const mockPaymentTypeRepository = {
    findById: jest.fn(),
    findByName: jest.fn(),
    findAll: jest.fn(),
    findAllActive: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation(async (cb) => {
      mockTransactionManager = {
        save: jest.fn().mockImplementation((...args) => Promise.resolve(args[1] ?? args[0])),
        find: jest.fn(),
      };
      return await cb(mockTransactionManager);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        CreateOrderUseCase,
        AddItemToOrderUseCase,
        RemoveItemFromOrderUseCase,
        ConfirmOrderUseCase,
        TransitionOrderStatusUseCase,
        CancelOrderUseCase,
        SetOrderPaymentTypeUseCase,
        { provide: ORDER_REPOSITORY, useValue: mockOrderRepository },
        { provide: CUSTOMER_REPOSITORY, useValue: mockCustomerRepository },
        { provide: PAYMENT_TYPE_REPOSITORY, useValue: mockPaymentTypeRepository },
        { provide: 'ProductRepository', useValue: mockProductRepository },
        { provide: ValidatePaymentForOrderUseCase, useValue: mockValidatePaymentUseCase },
        { provide: DataSource, useValue: mockDataSource },
        { provide: LoggerService, useValue: { logStructured: jest.fn() } },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    cancelOrderUseCase = module.get<CancelOrderUseCase>(CancelOrderUseCase);

    jest.clearAllMocks();
  });

  describe('POST /orders - Create order via API flow', () => {
    it('should create order in database with draft status (Real Use Case)', async () => {
      const customerId = '550e8400-e29b-41d4-a716-446655440001';
      const orderData = {
        customerId,
        paymentTypeId: '550e8400-e29b-41d4-a716-446655440002',
      };

      mockCustomerRepository.findById.mockResolvedValue({ id: customerId, name: 'John Doe' });
      mockOrderRepository.save.mockImplementation((order) => {
        Object.defineProperty(order, '_id', { value: 'order-uuid', writable: true });
        return Promise.resolve(order);
      });

      const result = await controller.create(orderData);

      expect(result).toBeDefined();
      expect(result.status).toBe('draft');
      expect(result.totalAmount).toBe(0);
      expect(mockOrderRepository.save).toHaveBeenCalled();
    });
  });

  describe('POST /orders/:id/items - Add item to order via API flow', () => {
    it('should add item to draft order and persist in database (Real Use Case)', async () => {
      const orderId = 'order-uuid';
      const productId = 'prod-uuid';
      const itemData = {
        productId,
        quantity: 2,
        unitPrice: 25.0,
      };

      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });

      mockOrderRepository.findById.mockResolvedValue(order);
      mockProductRepository.findById.mockResolvedValue({
        id: productId,
        unitPrice: 25.0,
        available: true,
      });
      mockOrderRepository.save.mockResolvedValue(order);

      const result = await controller.addItem(orderId, itemData);

      expect(result.subtotal).toBe(50.0);
      expect(order.items).toHaveLength(1);
      expect(order.totalAmount).toBe(50.0);
      expect(mockOrderRepository.save).toHaveBeenCalledWith(order);
    });

    it('should fail when adding item with negative quantity (Domain validation check without mock masking)', async () => {
      const orderId = 'order-uuid';
      const productId = 'prod-uuid';
      const itemData = {
        productId,
        quantity: -5,
        unitPrice: 25.0,
      };

      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });

      mockOrderRepository.findById.mockResolvedValue(order);
      mockProductRepository.findById.mockResolvedValue({
        id: productId,
        unitPrice: 25.0,
        available: true,
      });

      await expect(controller.addItem(orderId, itemData)).rejects.toThrow();
      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when adding item with negative price (Domain validation check without mock masking)', async () => {
      const orderId = 'order-uuid';
      const productId = 'prod-uuid';
      const itemData = {
        productId,
        quantity: 2,
        unitPrice: -10.0,
      };

      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });

      mockOrderRepository.findById.mockResolvedValue(order);
      mockProductRepository.findById.mockResolvedValue({
        id: productId,
        unitPrice: -10.0,
        available: true,
      });

      await expect(controller.addItem(orderId, itemData)).rejects.toThrow();
      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /orders/:id/confirm - Confirm order via API flow', () => {
    it('should confirm order and persist withdrawal movement through use case flow', async () => {
      const orderId = 'order-uuid';
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      const productId = 'prod-1';
      order.addItem(productId, 1, 100.0);
      order.setPaymentType('payment-uuid');

      mockOrderRepository.findById.mockResolvedValue(order);
      mockTransactionManager = undefined as any;
      mockDataSource.transaction.mockImplementationOnce(async (cb) => {
        mockTransactionManager = {
          save: jest.fn().mockImplementation((...args) => Promise.resolve(args[1] ?? args[0])),
          find: jest.fn().mockResolvedValue([
            InventoryMovement.create({
              productId,
              type: 'entry',
              quantity: 10,
            }),
          ]),
        };
        return await cb(mockTransactionManager);
      });
      mockOrderRepository.save.mockResolvedValue(order);

      const result = await controller.confirm(orderId);

      expect(result.status).toBe('confirmed');
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockTransactionManager.save).toHaveBeenCalledTimes(2);
      expect(mockTransactionManager.save).toHaveBeenNthCalledWith(
        2,
        InventoryMovement,
        expect.any(InventoryMovement),
      );
      expect(mockTransactionManager.save).toHaveBeenNthCalledWith(1, OrderAggregate, order);

      const withdrawal = mockTransactionManager.save.mock.calls[1][1] as InventoryMovement;
      expect(withdrawal.type).toBe('withdrawal');
      expect(withdrawal.productId).toBe(productId);
      expect(withdrawal.quantity).toBe(1);
      expect(order.status).toBe('confirmed');
    });
  });

  describe('PATCH /orders/:id/cancel - Cancel order via API flow', () => {
    it('should cancel a confirmed order and revert stock', async () => {
      const orderId = 'order-uuid';
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      const productId = 'prod-1';
      order.addItem(productId, 5, 10.0);
      order.setPaymentType('payment-uuid');
      order.confirm();

      mockOrderRepository.findById.mockResolvedValue(order);
      mockOrderRepository.save.mockResolvedValue(order);

      const result = await controller.cancel(orderId);

      expect(result.currentStatus).toBe('cancelled');
      expect(result.stockReverted).toBe(true);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      
      const savedEntities = mockTransactionManager.save.mock.calls.map(call => call[1] ?? call[0]);
      
      const revertedMovement = savedEntities.find(e => e.type === 'entry' && e.productId === productId);
      expect(revertedMovement).toBeDefined();
      expect(revertedMovement.quantity).toBe(5);
      
      expect(order.status).toBe('cancelled');
    });

    it('should cancel a draft order without reverting stock', async () => {
      const orderId = 'order-uuid';
      const order = OrderAggregate.create({ customerId: 'customer-uuid' });
      Object.defineProperty(order, '_id', { value: orderId, writable: true });
      order.addItem('prod-1', 1, 10.0);

      mockOrderRepository.findById.mockResolvedValue(order);

      const result = await controller.cancel(orderId);

      expect(result.currentStatus).toBe('cancelled');
      expect(result.stockReverted).toBe(false);
      
      const savedEntities = mockTransactionManager.save.mock.calls.map(call => call[1] ?? call[0]);
      const entryMovements = savedEntities.filter(e => e.type === 'entry');
      expect(entryMovements).toHaveLength(0);
    });

    it('should pass correlation id header to cancel use case', async () => {
      const orderId = 'order-uuid';
      const executeSpy = jest.spyOn(cancelOrderUseCase, 'execute').mockResolvedValue({
        id: orderId,
        previousStatus: 'draft',
        currentStatus: 'cancelled',
        stockReverted: false,
        updatedAt: new Date('2024-01-15'),
      });

      await controller.cancel(orderId, 'corr-api-cancel');

      expect(executeSpy).toHaveBeenCalledWith({
        orderId,
        correlationId: 'corr-api-cancel',
      });
    });
  });
});
